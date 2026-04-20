# EarthLens

**Full‑Stack ESG Analytics Platform**

EarthLens is an interactive carbon intelligence dashboard that enables users to explore global CO₂ emissions, analyze country‑level data, track the renewable energy transition, and examine the relationship between economic output (GDP) and carbon footprint. The platform is built with a normalized MySQL database, a Node.js/Express REST API, and a responsive Chart.js frontend, and is deployed on free cloud infrastructure.

![EarthLens Dashboard](https://i.ibb.co/WvDtC9dn/Screenshot-2026-04-20-at-9-02-11-PM.png)

## Live Demo

| Service       | URL                                                       |
|---------------|-----------------------------------------------------------|
| **Frontend**  | [https://carbon-footprint-chi.vercel.app](https://carbon-footprint-chi.vercel.app) |
| **Backend API** | [https://carbon-api-7its.onrender.com/api](https://carbon-api-7its.onrender.com/api) |

## Features

### Overview Dashboard (`index.html`)
- Global CO₂ trend line chart (1965–2023)
- Multi‑country comparison (up to 5 countries) with a **searchable checkbox selector** and removable colour‑coded tags
- **Emission intensity heatmap** (country × decade) – click any cell to drill down
- Energy mix stacked bar chart (selectable country)
- Top 15 CO₂ per capita horizontal bar chart
- Emissions by continent doughnut chart
- **Decade filter** (All Years, 1960s–2020s) that updates all charts and KPIs
- Dynamic KPI cards: Global Emissions, Per Capita Avg, Emission Intensity, Renewable Share
- Insight panel with key takeaways

### Country Deep‑Dive (`country.html`)
- Single‑country view driven by URL parameter (`?country=india`)
- **Country dropdown** and **decade filter** for seamless switching
- CO₂ emissions trend and per‑capita trend line charts
- Energy mix over time (stacked bar)
- GDP vs Emissions log‑log scatter plot
- Country vs continent average comparison line chart
- Country‑specific KPIs (Total Emissions, Per Capita, Renewable Share, Emission Intensity)
- Dynamic insight panel (pre‑written for India, China, USA; generic fallback)

### Energy Transition (`energy-transition.html`)
- Global renewable share over time (line chart)
- Top 15 countries by renewable share (vertical bar chart)
- **Renewable share comparison** for user‑selected countries (max 5)
- **Fossil vs renewable growth** – aggregated across selected countries
- KPI cards: Global Renewable Share, Top Country Share, Comparison Countries Count, Global Fossil Share
- Insight panel summarising global energy trends

### GDP Correlation (`gdp-correlation.html`)
- **Dual‑axis line chart**: CO₂ emissions (solid lines, left axis) vs GDP (dashed lines, right axis) for selected entities
- **Entity mode toggle**: switch between Countries and Continents
- **Searchable entity selector** with removable tags (max 5)
- Total emissions by continent (horizontal bar chart)
- Top 15 countries by emission intensity (tonnes CO₂ per $M GDP), coloured by continent
- Insight panel explaining the GDP–CO₂ relationship

### Global Design & UX
- Fully responsive (mobile/tablet/desktop)
- Floating, blurred navigation bar
- "Earth & Data" custom theme: warm sand background, forest green accent, clay and moss tones
- Typography: **Fraunces** (serif headings) + **Work Sans** (sans‑serif body)
- Loading spinners and graceful error messages

## Tech Stack

| Layer          | Technologies                                                                                 |
|----------------|----------------------------------------------------------------------------------------------|
| **Frontend**   | HTML5, CSS3, JavaScript (ES6), [Chart.js 4.4](https://www.chartjs.org/), [Font Awesome 6](https://fontawesome.com/) |
| **Backend**    | [Node.js](https://nodejs.org/), [Express 5](https://expressjs.com/), [mysql2](https://www.npmjs.com/package/mysql2) (Promise), [cors](https://www.npmjs.com/package/cors), [dotenv](https://www.npmjs.com/package/dotenv) |
| **Database**   | [TiDB Cloud](https://tidbcloud.com/) (MySQL‑compatible, serverless)                           |
| **Deployment** | [Vercel](https://vercel.com/) (frontend), [Render](https://render.com/) (backend), TiDB Cloud (database) |
| **Data Source**| [Our World in Data](https://ourworldindata.org/) (OWID) – 60+ years of energy & emissions data |

## Database Design

The database follows a **star‑like normalized schema** (3NF) with dimension tables (descriptive attributes) and fact tables (measurable numeric data).

### Dimension Tables
| Table          | Description                                       |
|----------------|---------------------------------------------------|
| `continent`    | Unique continent names (`asia`, `europe`, …)       |
| `country`      | Country names, ISO codes, linked to a continent    |
| `year_dim`     | Years and pre‑calculated `decade` column           |
| `energy_source`| Energy sources (`coal`, `solar`, …) and type (`fossil`/`renewable`) |
| `region`       | Geographic regions (future‑use)                    |

### Fact Tables
| Table               | Description                                                       |
|---------------------|-------------------------------------------------------------------|
| `emissions`         | CO₂ emissions per country, year, and source (normalised long format) |
| `gdp_data`          | GDP (total and per capita) per country‑year                        |
| `population_data`   | Population per country‑year                                        |
| `energy_breakdown`  | Energy consumption per country, year, and source                   |
| `energy_consumption`| Total primary energy per country‑year (reserved for future features) |

### Views (Pre‑aggregated)
| View               | Purpose                                                                                   |
|--------------------|-------------------------------------------------------------------------------------------|
| `fact_country_year`| Aggregates `emissions` to `total_emissions` per country‑year                               |
| `energy_share`     | Pre‑computes `renewable_energy` and `fossil_energy` per country‑year                        |
| `kpi_metrics`      | Calculates `co2_per_capita` and `emission_intensity` by joining `fact_country_year` with `population_data` and `gdp_data` |

**Key Design Choices:**
- **Surrogate integer keys** (`country_id`, `year_id`, etc.) for fast joins and stability.
- **Foreign keys** with referential integrity.
- **Unique constraints** to prevent duplicate fact rows.
- **Check constraints** (e.g., `energy_amount >= 0`).
- **`NULLIF`** in views to avoid division‑by‑zero errors.

## API Endpoints (14 Total)

| Method | Endpoint                                      | Description                                                                 |
|--------|-----------------------------------------------|-----------------------------------------------------------------------------|
| GET    | `/api/global-trend`                           | Yearly global CO₂ emissions                                                  |
| GET    | `/api/compare?countries=...`                  | Yearly emissions for selected countries (comma‑separated)                     |
| GET    | `/api/gdp-co2`                                | Yearly GDP and emissions for all countries                                   |
| GET    | `/api/energy-mix/:country`                    | Fossil vs renewable energy per year for a given country                       |
| GET    | `/api/per-capita/:year`                       | Top 15 countries by CO₂ per capita for a specific year                        |
| GET    | `/api/per-capita-trend/:country`              | Yearly per‑capita CO₂ for a single country                                   |
| GET    | `/api/continent-emissions`                    | Total emissions aggregated by continent                                      |
| GET    | `/api/continent-average/:continent`           | Average emissions per year for a given continent                             |
| GET    | `/api/global-renewable-share`                 | Global renewable energy percentage per year                                  |
| GET    | `/api/top-renewable/:year`                    | Top 15 countries by renewable share for a specific year                       |
| GET    | `/api/countries`                              | Alphabetical list of all country names (for dropdowns)                       |
| GET    | `/api/countries-with-continent`               | Country names with their continent (for colour mapping)                       |
| GET    | `/api/continent-renewable/:continent`         | Renewable share trend for a given continent (available, less used)            |
| GET    | `/api/emission-intensity/:year`               | Global emission intensity (tonnes CO₂ per $M GDP) for a specific year         |

All endpoints return JSON and include CORS headers (via `cors()` middleware). Errors return `{ error: "message" }` with HTTP 500.

## Getting Started (Local Development)

### Prerequisites
- **Node.js** (v16 or later)
- **MySQL** (local instance, or TiDB Cloud connection)
- **Git**
