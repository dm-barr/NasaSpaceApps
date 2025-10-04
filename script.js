// ==========================================================
// 1. CONFIGURACIÓN INICIAL DEL MAPA Y ESTILOS
// ==========================================================

// Coordenadas de Cajamarca, Perú (Centro aproximado)
const CAJAMARCA_COORDS = [-7.15, -78.51];
const INITIAL_ZOOM = 13;

// Inicializar el mapa con Leaflet
const map = L.map('map').setView(CAJAMARCA_COORDS, INITIAL_ZOOM);

// Añadir capa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Función de estilo para las zonas (Clusters K-Means)
function styleCluster(feature) {
    switch (feature.properties.cluster) {
        case 1: // Baja Prioridad
            return { fillColor: '#4CAF50', color: '#388E3C', weight: 1, opacity: 1, fillOpacity: 0.6 }; 
        case 2: // Riesgo Moderado
            return { fillColor: '#FFC107', color: '#FFA000', weight: 1, opacity: 1, fillOpacity: 0.7 };
        case 3: // Alta Prioridad
            return { fillColor: '#D32F2F', color: '#B71C1C', weight: 1, opacity: 1, fillOpacity: 0.8 };
        default:
            return { fillColor: '#9E9E9E', color: '#757575', weight: 1, opacity: 1, fillOpacity: 0.5 };
    }
}

// Datos de ejemplo para el gráfico de tendencia
const chartData = {
    labels: ['2015', '2017', '2019', '2021', '2023'],
    datasets: [
        {
            label: 'Temp. Superficial Promedio (°C)',
            data: [25.5, 26.1, 26.8, 27.5, 28.2],
            borderColor: '#D32F2F',
            backgroundColor: 'rgba(211, 47, 47, 0.2)',
            yAxisID: 'y'
        },
        {
            label: 'Vegetación Promedio (NDVI)',
            data: [0.65, 0.60, 0.55, 0.50, 0.45],
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            yAxisID: 'y1'
        }
    ]
};

// ==========================================================
// 2. FUNCIÓN DE CARGA DE DATOS (Simulación de Backend)
// ==========================================================
async function loadRiskData() {
    const response = await fetch('./cajamarca_risk_example.json'); 
    const geojsonData = await response.json();
    
    // Calcular KPIs
    updateKPIs(geojsonData.features);

    // Añadir la capa GeoJSON al mapa
    L.geoJson(geojsonData, {
        style: styleCluster,
        onEachFeature: onEachFeature
    }).addTo(map);

    // Inicializar el gráfico
    initChart();
}

function updateKPIs(features) {
    const totalArea = features.length; 
    let highRiskCount = 0;
    
    features.forEach(feature => {
        if (feature.properties.cluster === 3) highRiskCount++;
    });

    const highRiskPercentage = ((highRiskCount / totalArea) * 100).toFixed(1) + '%';
    document.getElementById('kpi-alto').textContent = highRiskPercentage;
    document.getElementById('kpi-ndvi').textContent = '↓ 12% (Últimos 5 años)'; // Simulación
}

// ==========================================================
// 3. INTERACTIVIDAD (Popups y Eventos)
// ==========================================================
let riskChart;

function initChart() {
    const ctx = document.getElementById('riskChart').getContext('2d');
    riskChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Tendencia Histórica de la Zona'
                }
            }
        }
    });
}

function onEachFeature(feature, layer) {
    layer.on({
        click: function(e) {
            const props = feature.properties;
            const riskLevel = props.cluster === 3 ? 'ALTO' : props.cluster === 2 ? 'MODERADO' : 'BAJO';
            
            document.getElementById('selected-metrics').innerHTML = `
                <p><strong>Nivel de Riesgo (IA):</strong> 
                   <span style="color:${styleCluster(feature).color};">${riskLevel}</span></p>
                <p><strong>LST Promedio:</strong> ${props.lst_avg}°C</p>
                <p><strong>NDVI Promedio:</strong> ${props.ndvi_avg}</p>
                <p><strong>Densidad Pop.:</strong> ${props.pop_den} hab/km²</p>
            `;
            
            map.fitBounds(e.target.getBounds());
            
            // Simulación actualización de gráfico
            riskChart.data.datasets[0].data = [
                props.lst_2015, props.lst_2017, props.lst_2019, props.lst_2021, props.lst_2023
            ];
            riskChart.update();
        }
    });
}

// ==========================================================
// 4. LEYENDA
// ==========================================================
const legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const labels = ['Alto Riesgo (Prioridad)', 'Riesgo Moderado', 'Baja Prioridad'];
    const colors = ['#D32F2F', '#FFC107', '#4CAF50'];

    div.innerHTML += '<h4>Vulnerabilidad Urbana</h4>';

    for (let i = 0; i < labels.length; i++) {
        div.innerHTML += `<i style="background:${colors[i]}"></i> ${labels[i]}<br>`;
    }

    return div;
};

legend.addTo(map);

// ==========================================================
// 5. CARGA DE DATOS COMPLEMENTARIOS (WRI API)
// ==========================================================
async function loadWRIData() {
    const wriApiUrl = 'https://datasets.wri.org/api/3/action/package_show?id=gfw-forest-carbon-gross-emissions';
    const wriInfoContainer = document.getElementById('wri-info');
    
    try {
        const response = await fetch(wriApiUrl, { method: "GET" });
        if (!response.ok) throw new Error(`Error de red: ${response.status}`);

        const data = await response.json();
        
        if (data.success && data.result) {
            const result = data.result;
            const datasetTitle = result.title;
            const datasetNotes = result.notes.substring(0, 150) + '...';
            const lastUpdated = new Date(result.metadata_modified).toLocaleDateString('es-ES');
            
            wriInfoContainer.innerHTML = `
                <h4>🌳 Impacto de Carbono Forestal (WRI)</h4>
                <p><strong>Dataset:</strong> ${datasetTitle}</p>
                <p><strong>Última Actualización:</strong> ${lastUpdated}</p>
                <p><strong>Descripción:</strong> ${datasetNotes}</p>
                <small>Datos complementarios del World Resources Institute (WRI).</small>
            `;
        } else {
            wriInfoContainer.innerHTML = `<p class="error">Error al obtener datos del WRI</p>`;
        }
    } catch (error) {
        console.error("Error al cargar datos WRI:", error);
        wriInfoContainer.innerHTML = `<p class="error">No se pudo cargar la API de WRI (posible error CORS).</p>`;
    }
}

// ==========================================================
// 6. EJECUCIÓN
// ==========================================================
loadRiskData();
loadWRIData();
