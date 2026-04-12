require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app  = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host:             process.env.DB_HOST,
    user:             process.env.DB_USER,
    password:         process.env.DB_PASSWORD,
    database:         process.env.DB_NAME,
    port:             process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0,
    ssl: {
      rejectUnauthorized: false
    }
  });

// ── Helpers ──────────────────────────────────────────────────────────
/** Wrap a query so endpoint errors always return valid JSON. */
async function runQuery(res, queryFn) {
  try {
    const result = await queryFn();
    res.json(result);
  } catch (err) {
    console.error('[API error]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── 1. Global emissions trend ────────────────────────────────────────
app.get('/api/global-trend', (req, res) => runQuery(res, async () => {
  const [rows] = await pool.query(`
    SELECT y.year, SUM(e.emission_amount) AS global_emissions
    FROM emissions e
    JOIN year_dim y ON e.year_id = y.year_id
    GROUP BY y.year
    ORDER BY y.year
  `);
  return rows;
}));

// ── 2. Country comparison ────────────────────────────────────────────
app.get('/api/compare', (req, res) => runQuery(res, async () => {
  const { countries } = req.query;
  if (!countries) return [];
  const list = countries.split(',').map(c => c.trim().toLowerCase());
  const ph   = list.map(() => '?').join(',');
  const [rows] = await pool.query(`
    SELECT c.country_name, y.year, SUM(e.emission_amount) AS total_emissions
    FROM emissions e
    JOIN country  c ON e.country_id = c.country_id
    JOIN year_dim y ON e.year_id    = y.year_id
    WHERE LOWER(c.country_name) IN (${ph})
    GROUP BY c.country_name, y.year
    ORDER BY c.country_name, y.year
  `, list);
  return rows;
}));

// ── 3. GDP vs CO₂  (uses fact_country_year + gdp_data) ──────────────
app.get('/api/gdp-co2', async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          c.country_name, 
          y.year, 
          g.gdp AS gdp, 
          SUM(e.emission_amount) AS total_emissions
        FROM emissions e
        JOIN country c ON e.country_id = c.country_id
        JOIN year_dim y ON e.year_id = y.year_id
        LEFT JOIN gdp_data g ON e.country_id = g.country_id AND e.year_id = g.year_id
        GROUP BY c.country_id, y.year
        ORDER BY y.year, c.country_name
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── 4. Energy mix for a country ──────────────────────────────────────
app.get('/api/energy-mix/:country', (req, res) => runQuery(res, async () => {
    const country = req.params.country.toLowerCase();
    const [rows] = await pool.query(`
      SELECT
        y.year,
        SUM(CASE WHEN es.type = 'renewable' THEN eb.energy_amount ELSE 0 END) AS renewable,
        SUM(CASE WHEN es.type = 'fossil'    THEN eb.energy_amount ELSE 0 END) AS fossil
      FROM energy_breakdown eb
      JOIN energy_source es ON eb.source_id  = es.source_id
      JOIN country       c  ON eb.country_id = c.country_id
      JOIN year_dim      y  ON eb.year_id    = y.year_id
      WHERE LOWER(c.country_name) = ?
      GROUP BY y.year
      ORDER BY y.year
    `, [country]);
    return rows;
  }));

// ── 5. Top 15 emitters per capita for a given year (kpi_metrics) ─────
app.get('/api/per-capita/:year', async (req, res) => {
    const year = parseInt(req.params.year);
    try {
      const [rows] = await pool.query(`
        SELECT 
          c.country_name,
          (SUM(e.emission_amount) * 1000000) / MAX(p.population) AS co2_per_capita_tonnes
        FROM emissions e
        JOIN country c ON e.country_id = c.country_id
        JOIN year_dim y ON e.year_id = y.year_id
        JOIN population_data p ON e.country_id = p.country_id AND e.year_id = p.year_id
        WHERE y.year = ? AND p.population > 0
        GROUP BY c.country_id
        HAVING SUM(e.emission_amount) IS NOT NULL
        ORDER BY co2_per_capita_tonnes DESC
        LIMIT 15
      `, [year]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


// ── 7. Continent total emissions ─────────────────────────────────────
app.get('/api/continent-emissions', (req, res) => runQuery(res, async () => {
  const [rows] = await pool.query(`
    SELECT ct.continent_name, SUM(e.emission_amount) AS total_emissions
    FROM emissions e
    JOIN country   c  ON e.country_id   = c.country_id
    JOIN continent ct ON c.continent_id = ct.continent_id
    GROUP BY ct.continent_name
    ORDER BY total_emissions DESC
  `);
  return rows;
}));

// ── 8. Continent average emissions over time (fact_country_year) ─────
app.get('/api/continent-average/:continent', (req, res) => runQuery(res, async () => {
  const continent = req.params.continent.toLowerCase();
  const [rows] = await pool.query(`
    SELECT y.year, AVG(f.total_emissions) AS avg_emissions
    FROM fact_country_year f
    JOIN country   c  ON f.country_id   = c.country_id
    JOIN continent ct ON c.continent_id = ct.continent_id
    JOIN year_dim  y  ON f.year_id      = y.year_id
    WHERE LOWER(ct.continent_name) = ?
    GROUP BY y.year
    ORDER BY y.year
  `, [continent]);
  return rows;
}));

// ── 9. Global renewable share trend ──────────────────────────────────
app.get('/api/global-renewable-share', (req, res) => runQuery(res, async () => {
  const [rows] = await pool.query(`
    SELECT
      y.year,
      SUM(CASE WHEN es.type = 'renewable' THEN eb.energy_amount ELSE 0 END) AS renewable,
      SUM(eb.energy_amount) AS total
    FROM energy_breakdown eb
    JOIN energy_source es ON eb.source_id = es.source_id
    JOIN year_dim      y  ON eb.year_id   = y.year_id
    GROUP BY y.year
    ORDER BY y.year
  `);
  return rows.map(r => ({
    year:            r.year,
    renewable_share: r.total > 0 ? (r.renewable / r.total) * 100 : 0,
  }));
}));

// ── 10. Top 15 countries by renewable share for a given year ─────────
app.get('/api/top-renewable/:year', (req, res) => runQuery(res, async () => {
  const year = parseInt(req.params.year);
  if (isNaN(year)) return [];
  const [rows] = await pool.query(`
    SELECT
      c.country_name,
      SUM(CASE WHEN es.type = 'renewable' THEN eb.energy_amount ELSE 0 END) /
      NULLIF(SUM(eb.energy_amount), 0) * 100 AS renewable_share
    FROM energy_breakdown eb
    JOIN energy_source es ON eb.source_id  = es.source_id
    JOIN country       c  ON eb.country_id = c.country_id
    JOIN year_dim      y  ON eb.year_id    = y.year_id
    WHERE y.year = ?
    GROUP BY c.country_id
    HAVING SUM(eb.energy_amount) > 0
       AND (SUM(CASE WHEN es.type = 'renewable' THEN eb.energy_amount ELSE 0 END) /
            NULLIF(SUM(eb.energy_amount), 0)) IS NOT NULL
    ORDER BY renewable_share DESC
    LIMIT 15
  `, [year]);
  return rows;
}));

// ── 11. All countries (dropdown) ─────────────────────────────────────
app.get('/api/countries', (req, res) => runQuery(res, async () => {
  const [rows] = await pool.query(
    'SELECT country_name FROM country ORDER BY country_name'
  );
  return rows.map(r => r.country_name);
}));

// ── 12. Countries with their continent ───────────────────────────────
app.get('/api/countries-with-continent', (req, res) => runQuery(res, async () => {
  const [rows] = await pool.query(`
    SELECT c.country_name, ct.continent_name
    FROM country   c
    LEFT JOIN continent ct ON c.continent_id = ct.continent_id
    WHERE c.country_name IN (
      SELECT DISTINCT country
      FROM country_continent_region_mapping_enriched
      WHERE continent IS NOT NULL
    )
    ORDER BY c.country_name
  `);
  return rows;
}));

// ── 13. Continent average renewable share trend ───────────────────────
app.get('/api/continent-renewable/:continent', (req, res) => runQuery(res, async () => {
  const continent = req.params.continent.toLowerCase();
  const [rows] = await pool.query(`
    SELECT
      y.year,
      SUM(CASE WHEN es.type = 'renewable' THEN eb.energy_amount ELSE 0 END) /
      NULLIF(SUM(eb.energy_amount), 0) * 100 AS renewable_share
    FROM energy_breakdown eb
    JOIN energy_source es ON eb.source_id  = es.source_id
    JOIN country       c  ON eb.country_id = c.country_id
    JOIN continent     ct ON c.continent_id = ct.continent_id
    JOIN year_dim      y  ON eb.year_id    = y.year_id
    WHERE LOWER(ct.continent_name) = ?
    GROUP BY y.year
    HAVING SUM(eb.energy_amount) > 0
    ORDER BY y.year
  `, [continent]);
  return rows;
}));

// Emission Intensity Endpoint
app.get('/api/emission-intensity/:year', async (req, res) => {
    const year = parseInt(req.params.year);
    try {
      const [rows] = await pool.query(`
        SELECT 
          (SUM(e.emission_amount) * 1e12) / NULLIF(SUM(g.gdp), 0) AS global_intensity
        FROM emissions e
        JOIN gdp_data g ON e.country_id = g.country_id AND e.year_id = g.year_id
        JOIN year_dim y ON e.year_id = y.year_id
        WHERE y.year = ? AND g.gdp > 0
      `, [year]);
      const intensity = rows[0]?.global_intensity || 0;
      res.json({ intensity });
    } catch (err) {
      console.error('Intensity endpoint error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/per-capita-trend/:country', async (req, res) => {
    const country = req.params.country.toLowerCase();
    try {
      const [rows] = await pool.query(`
        SELECT 
          y.year,
          (SUM(e.emission_amount) * 1000000) / NULLIF(MAX(p.population), 0) AS co2_per_capita_tonnes
        FROM emissions e
        JOIN country c ON e.country_id = c.country_id
        JOIN year_dim y ON e.year_id = y.year_id
        LEFT JOIN population_data p ON e.country_id = p.country_id AND e.year_id = p.year_id
        WHERE LOWER(c.country_name) = ?
        GROUP BY y.year
        HAVING SUM(e.emission_amount) IS NOT NULL
        ORDER BY y.year
      `, [country]);
      // Filter out years where co2_per_capita_tonnes is NULL (no population)
      res.json(rows.filter(r => r.co2_per_capita_tonnes !== null));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.listen(port, () => {
  console.log(`✅  Carbon API running at http://localhost:${port}`);
});