// ================== CONFIGURATION ==================
const API_BASE = 'http://localhost:3001/api';  // Your backend URL

// ================== HELPER FUNCTION ==================
async function fetchData(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

// ================== POPULATE DROPDOWNS ==================
async function populateCountryDropdowns() {
  const countries = await fetchData('/countries');
  
  const multiSelect = document.getElementById('countrySelect');
  const energySelect = document.getElementById('energyCountrySelect');
  
  countries.forEach(country => {
    const option1 = document.createElement('option');
    option1.value = country;
    option1.textContent = country;
    multiSelect.appendChild(option1);
    
    const option2 = document.createElement('option');
    option2.value = country;
    option2.textContent = country;
    energySelect.appendChild(option2);
  });
}

// ================== 1. GLOBAL TREND ==================
async function drawGlobalTrend() {
  const data = await fetchData('/global-trend');
  const ctx = document.getElementById('globalTrendChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        label: 'Global CO₂ Emissions (million tonnes)',
        data: data.map(d => d.global_emissions),
        borderColor: '#d32f2f',
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Global Emissions 1960–2020' }
      }
    }
  });
}

// ================== 2. COUNTRY COMPARISON ==================
let comparisonChart;
async function drawComparison(selectedCountries) {
  if (selectedCountries.length === 0) {
    alert('Please select at least one country');
    return;
  }
  
  const query = selectedCountries.join(',');
  const data = await fetchData(`/compare?countries=${query}`);
  
  // Group by country
  const grouped = {};
  data.forEach(d => {
    if (!grouped[d.country_name]) grouped[d.country_name] = [];
    grouped[d.country_name].push({ x: d.year, y: d.total_emissions });
  });
  
  const datasets = Object.entries(grouped).map(([country, points]) => ({
    label: country,
    data: points,
    borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
    fill: false
  }));
  
  const ctx = document.getElementById('comparisonChart').getContext('2d');
  if (comparisonChart) comparisonChart.destroy();
  comparisonChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Year' } },
        y: { title: { display: true, text: 'Emissions (million tonnes)' } }
      }
    }
  });
}

// ================== 3. GDP vs CO2 SCATTER ==================
async function drawGdpCo2Scatter() {
  const data = await fetchData('/gdp-co2');
  const ctx = document.getElementById('gdpCo2Chart').getContext('2d');
  
  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'GDP vs CO₂',
        data: data.map(d => ({ x: d.gdp, y: d.total_emissions })),
        backgroundColor: 'rgba(33, 150, 243, 0.5)'
      }]
    },
    options: {
      scales: {
        x: { type: 'linear', title: { display: true, text: 'GDP (USD)' } },
        y: { title: { display: true, text: 'CO₂ Emissions (million tonnes)' } }
      }
    }
  });
}

// ================== 4. ENERGY MIX ==================
let energyMixChart;
async function drawEnergyMix(country) {
  const data = await fetchData(`/energy-mix/${country}`);
  const ctx = document.getElementById('energyMixChart').getContext('2d');
  
  if (energyMixChart) energyMixChart.destroy();
  energyMixChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.year),
      datasets: [
        { label: 'Fossil', data: data.map(d => d.fossil), backgroundColor: '#d32f2f' },
        { label: 'Renewable', data: data.map(d => d.renewable), backgroundColor: '#2e7d32' }
      ]
    },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

// ================== 5. PER CAPITA TOP 15 ==================
async function drawPerCapita() {
  const data = await fetchData('/per-capita/2020');
  const ctx = document.getElementById('perCapitaChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.country_name),
      datasets: [{
        label: 'CO₂ per capita (tonnes)',
        data: data.map(d => d.co2_per_capita),
        backgroundColor: '#ff9800'
      }]
    },
    options: {
      indexAxis: 'y',  // horizontal bar chart
      responsive: true
    }
  });
}

// ================== 6. CONTINENT COMPARISON ==================
async function drawContinentChart() {
  const data = await fetchData('/continent-emissions');
  const ctx = document.getElementById('continentChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.continent_name),
      datasets: [{
        data: data.map(d => d.total_emissions),
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336']
      }]
    }
  });
}

// ================== INITIALISE EVERYTHING ==================
async function init() {
  await populateCountryDropdowns();
  
  drawGlobalTrend();
  drawGdpCo2Scatter();
  drawPerCapita();
  drawContinentChart();
  
  // Event listeners
  document.getElementById('compareBtn').addEventListener('click', () => {
    const selected = Array.from(document.getElementById('countrySelect').selectedOptions)
                          .map(opt => opt.value);
    drawComparison(selected);
  });
  
  document.getElementById('energyCountrySelect').addEventListener('change', (e) => {
    drawEnergyMix(e.target.value);
  });
  
  // Default energy mix for the first country in dropdown
  const firstCountry = document.getElementById('energyCountrySelect').options[0]?.value;
  if (firstCountry) drawEnergyMix(firstCountry);
}

init();