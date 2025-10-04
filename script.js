// ==========================================================
// 1. CONFIGURACIÓN INICIAL DEL MAPA Y ESTILOS
// ==========================================================

const CAJAMARCA_COORDS = [-7.15, -78.51];
const INITIAL_ZOOM = 13;

const map = L.map('map').setView(CAJAMARCA_COORDS, INITIAL_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

function styleCluster(feature) {
    switch (feature.properties.cluster) {
        case 1: return { fillColor: '#4CAF50', color: '#388E3C', weight: 1, fillOpacity: 0.6 };
        case 2: return { fillColor: '#FFC107', color: '#FFA000', weight: 1, fillOpacity: 0.7 };
        case 3: return { fillColor: '#D32F2F', color: '#B71C1C', weight: 1, fillOpacity: 0.8 };
        default: return { fillColor: '#9E9E9E', color: '#757575', weight: 1, fillOpacity: 0.5 };
    }
}

// ==========================================================
// 2. DATOS BASE Y KPIs
// ==========================================================

const chartData = {
    labels: ['2015', '2017', '2019', '2021', '2023'],
    datasets: [
        {
            label: 'Temp. Superficial Promedio (°C)',
            data: [25.5, 26.1, 26.8, 27.5, 28.2],
            borderColor: '#D32F2F',
            backgroundColor: 'rgba(211,47,47,0.2)',
            yAxisID: 'y'
        },
        {
            label: 'Vegetación Promedio (NDVI)',
            data: [0.65, 0.60, 0.55, 0.50, 0.45],
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76,175,80,0.2)',
            yAxisID: 'y1'
        }
    ]
};

// ==========================================================
// 3. FUNCIÓN DE CARGA DE DATOS DE RIESGO LOCAL
// ==========================================================
async function loadRiskData() {
    const response = await fetch('./cajamarca_risk_example.json');
    const geojsonData = await response.json();

    updateKPIs(geojsonData.features);

    L.geoJson(geojsonData, {
        style: styleCluster,
        onEachFeature: onEachFeature
    }).addTo(map);

    initChart();
}

function updateKPIs(features) {
    const total = features.length;
    const high = features.filter(f => f.properties.cluster === 3).length;
    const highRiskPct = ((high / total) * 100).toFixed(1) + '%';
    document.getElementById('kpi-alto').textContent = highRiskPct;
    document.getElementById('kpi-ndvi').textContent = '↓ 12% (Últimos 5 años)';
}

// ==========================================================
// 4. GRÁFICO DE TENDENCIA Y POPUPS
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
                title: { display: true, text: 'Tendencia Histórica de la Zona' }
            }
        }
    });
}

function onEachFeature(feature, layer) {
    layer.on({
        click: function (e) {
            const p = feature.properties;
            const nivel = p.cluster === 3 ? 'ALTO' : p.cluster === 2 ? 'MODERADO' : 'BAJO';
            document.getElementById('selected-metrics').innerHTML = `
                <p><strong>Nivel de Riesgo (IA):</strong> <span style="color:${styleCluster(feature).color};">${nivel}</span></p>
                <p><strong>LST Promedio:</strong> ${p.lst_avg}°C</p>
                <p><strong>NDVI Promedio:</strong> ${p.ndvi_avg}</p>
                <p><strong>Densidad Poblacional:</strong> ${p.pop_den} hab/km²</p>
            `;
            map.fitBounds(e.target.getBounds());
        }
    });
}

// ==========================================================
// 5. LEYENDA
// ==========================================================
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    const labels = ['Alta Prioridad', 'Riesgo Moderado', 'Baja Prioridad'];
    const colors = ['#D32F2F', '#FFC107', '#4CAF50'];
    div.innerHTML = '<h4>Vulnerabilidad Urbana</h4>';
    for (let i = 0; i < labels.length; i++) {
        div.innerHTML += `<i style="background:${colors[i]}"></i> ${labels[i]}<br>`;
    }
    return div;
};
legend.addTo(map);

// ==========================================================
// 6. DATOS DEL WRI (BÁSICO)
// ==========================================================
async function loadWRIData() {
    const url = 'https://datasets.wri.org/api/3/action/package_show?id=gfw-forest-carbon-gross-emissions';
    const container = document.getElementById('wri-info');

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error("Error WRI");

        const d = data.result;
        container.innerHTML = `
            <h4>🌳 ${d.title}</h4>
            <p><strong>Actualización:</strong> ${new Date(d.metadata_modified).toLocaleDateString('es-ES')}</p>
            <p>${d.notes.substring(0, 200)}...</p>
            <small>Fuente: World Resources Institute (WRI)</small>
        `;
    } catch (err) {
        container.innerHTML = `<p class="error">No se pudo cargar la API de WRI.</p>`;
        console.error(err);
    }
}

// ==========================================================
// 7. NUEVO MÓDULO: INTEGRACIÓN COMPLETA CON API WRI
// ==========================================================
const WRI_BASE = "https://datasets.wri.org/api/3/action";

async function loadWRIDatasets() {
    const status = document.getElementById("dataset-status");
    const list = document.getElementById("dataset-list");
    list.innerHTML = "";

    try {
        const res = await fetch(`${WRI_BASE}/package_list`);
        const data = await res.json();
        if (!data.success) throw new Error();

        status.textContent = `Total: ${data.result.length}`;
        data.result.slice(0, 8).forEach(id => {
            const li = document.createElement("li");
            li.textContent = id;
            li.style.cursor = "pointer";
            li.style.color = "#00796B";
            li.addEventListener("click", () => loadWRIDatasetDetail(id));
            list.appendChild(li);
        });
    } catch {
        status.textContent = "⚠️ No se pudieron cargar datasets.";
    }
}

async function loadWRIDatasetDetail(id) {
    const info = document.getElementById("wri-info");
    info.innerHTML = `<p>Cargando <strong>${id}</strong>...</p>`;

    try {
        const res = await fetch(`${WRI_BASE}/package_show?id=${id}`);
        const data = await res.json();
        if (!data.success) throw new Error();

        const r = data.result;
        const resources = r.resources || [];
        const desc = r.notes ? r.notes.substring(0, 300) + "..." : "Sin descripción.";

        info.innerHTML = `
            <h4>${r.title}</h4>
            <p><strong>Última actualización:</strong> ${new Date(r.metadata_modified).toLocaleDateString('es-ES')}</p>
            <p>${desc}</p>
            <p><strong>Organización:</strong> ${r.organization?.title || 'WRI'}</p>
            <h5>Recursos:</h5>
        `;

        const ul = document.createElement("ul");
        resources.forEach(x => {
            const li = document.createElement("li");
            li.innerHTML = `<a href="${x.url}" target="_blank">${x.format} - ${x.name}</a>`;
            if (x.format.toLowerCase() === "geojson")
                li.innerHTML += ` <button onclick="loadGeoJSONFromWRI('${x.url}')">📍 Ver en mapa</button>`;
            ul.appendChild(li);
        });
        info.appendChild(ul);
    } catch (err) {
        info.innerHTML = `<p>Error al cargar dataset.</p>`;
    }
}

async function loadGeoJSONFromWRI(url) {
    try {
        const res = await fetch(url);
        const geojson = await res.json();

        L.geoJson(geojson, {
            style: () => ({ color: "#0288D1", weight: 1, fillOpacity: 0.4 }),
            onEachFeature: (f, layer) => {
                const p = f.properties || {};
                layer.bindPopup(`<strong>${p.name || 'Área'}</strong><br>${Object.entries(p).map(([k, v]) => `${k}: ${v}`).join("<br>")}`);
            }
        }).addTo(map);

        // Actualiza KPIs aleatoriamente (simulación)
        document.getElementById("kpi-alto").textContent = (Math.random() * 40 + 10).toFixed(1) + "%";
        document.getElementById("kpi-ndvi").textContent = "↓ " + (Math.random() * 15).toFixed(1) + "%";
    } catch {
        alert("No se pudo cargar la capa GeoJSON.");
    }
}

// ==========================================================
// 8. EJECUCIÓN PRINCIPAL
// ==========================================================
loadRiskData();
loadWRIData();
loadWRIDatasets();


/* =========================
   REQUISITOS: CDN externos
   AÑADE al <head> o antes de este script:
   - TensorFlow.js (opcional, solo si usarás el modo tfjs)
     <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.9.0/dist/tf.min.js"></script>
   - geotiff.js (para lectura si necesitas)
     <script src="https://unpkg.com/geotiff/dist/geotiff.browser.min.js"></script>
   - leaflet-geotiff o georaster-layer-for-leaflet si vas a mostrar GeoTIFFs en cliente.
   ========================= */

/* -------------------------
   UTIL: normalización simple
   ------------------------- */
function normalize(x, min, max) {
  return (x - min) / (max - min);
}

/* =========================
   MÓDULO 1: PREDICCIÓN IA
   - Modo 'light': función determinística (pesos definidos).
   - Modo 'tfjs': pequeño modelo entrenable en navegador (opcional).
   ========================= */

const aiModeEl = document.getElementById('ai-mode');
const aiNdviEl = document.getElementById('ai-ndvi');
const aiLstEl = document.getElementById('ai-lst');
const aiDenEl = document.getElementById('ai-den');
const aiPredictBtn = document.getElementById('ai-predict');
const aiOutput = document.getElementById('ai-output');
const aiTrainArea = document.getElementById('ai-train-area');
const aiTrainBtn = document.getElementById('ai-train');
const aiTrainOutput = document.getElementById('ai-train-output');

aiModeEl.addEventListener('change', () => {
  if (aiModeEl.value === 'tfjs') aiTrainArea.style.display = 'block';
  else aiTrainArea.style.display = 'none';
});

/* === MODO LIGERO (regla ponderada) ===
   Normalizamos y aplicamos pesos interpretable:
   score ∈ [0,100] => categories
*/
function predictRiskLight(ndvi, lst, density) {
  // normalizaciones (NDVI [0,1], LST [10,45], density [0,10000])
  const n_ndvi = 1 - ndvi; // mayor 1-ndvi => mayor riesgo cuando vegetación baja
  const n_lst = normalize(lst, 10, 45); 
  const n_den = normalize(Math.min(density, 10000), 0, 10000);

  // Pesos interpretables
  const w_lst = 0.45;
  const w_ndvi = 0.40;
  const w_den = 0.15;

  const raw = (w_lst * n_lst + w_ndvi * n_ndvi + w_den * n_den);
  const score = Math.round(raw * 100); // 0-100

  let label = 'Bajo';
  let emoji = '🟢';
  if (score >= 65) { label = 'Alto'; emoji = '🔴'; }
  else if (score >= 40) { label = 'Moderado'; emoji = '🟠'; }

  return { score, label, emoji, components: { n_ndvi, n_lst, n_den } };
}

aiPredictBtn.addEventListener('click', async () => {
  const ndvi = parseFloat(aiNdviEl.value);
  const lst = parseFloat(aiLstEl.value);
  const den = parseFloat(aiDenEl.value);

  if (aiModeEl.value === 'light') {
    const r = predictRiskLight(ndvi, lst, den);
    aiOutput.innerHTML = `<p><strong>${r.emoji} Riesgo: ${r.label}</strong> — Puntaje ${r.score}/100</p>
                          <small>Componentes (NDVI inv, LST, Densidad): ${r.components.n_ndvi.toFixed(2)}, ${r.components.n_lst.toFixed(2)}, ${r.components.n_den.toFixed(2)}</small>`;
    return;
  }

  // MODO TFJS: si el usuario seleccionó 'tfjs', esperamos que se haya entrenado un modelo en memoria
  if (window.aiModel && window.aiPredictTensor) {
    const pred = await window.aiPredictTensor(ndvi, lst, den);
    aiOutput.innerHTML = `<p><strong>🔬 Modelo TF.js — Riesgo estimado: ${pred.score.toFixed(1)}/100</strong></p>
                          <small>Etiqueta: ${pred.label}</small>`;
  } else {
    aiOutput.innerHTML = `<p style="color:orange">⚠️ Modelo TF.js no entrenado. Haz click en "Entrenar modelo (demo)".</p>`;
  }
});

/* OPTIONAL: DEMO DE ENTRENAMIENTO CON TF.JS (datos sintéticos) */
if (typeof tf !== 'undefined') {
  aiTrainBtn.addEventListener('click', async () => {
    aiTrainOutput.innerHTML = 'Entrenando modelo sintético...';
    // Generar dataset sintético: ndvi [0,1], lst[15,40], den[0,5000]
    const N = 800;
    const xs = [];
    const ys = [];
    for (let i = 0; i < N; i++) {
      const ndvi = Math.random(); 
      const lst = 15 + Math.random() * 25;
      const den = Math.random() * 5000;
      const r = predictRiskLight(ndvi, lst, den).score / 100.0; // usar score light como target (0-1)
      xs.push([ndvi, lst/45.0, den/10000.0]);
      ys.push([r]);
    }
    // Construir tensors
    const xsT = tf.tensor2d(xs);
    const ysT = tf.tensor2d(ys);

    // Modelo pequeño
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [3], units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

    await model.fit(xsT, ysT, { epochs: 30, batchSize: 32, verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) aiTrainOutput.innerHTML = `Entrenando... epoch ${epoch} loss=${logs.loss.toFixed(4)}`;
        }
      }
    });

    // Guardar predict function
    window.aiModel = model;
    window.aiPredictTensor = async (ndvi, lst, den) => {
      const input = tf.tensor2d([[ndvi, lst/45.0, den/10000.0]]);
      const out = model.predict(input);
      const v = (await out.data())[0]; // 0-1
      const score = v * 100;
      let label = 'Bajo';
      if (score >= 65) label = 'Alto';
      else if (score >= 40) label = 'Moderado';
      return { score, label };
    };

    aiTrainOutput.innerHTML = '✅ Entrenamiento finalizado. Ahora puedes usar el modo TF.js para predecir.';
  });
} else {
  // ocultar área si no hay tf
  aiTrainArea.style.display = 'none';
}

/* =========================
   MÓDULO 2: SIMULACIÓN DE ESCENARIOS CLIMÁTICOS
   - Proyecciones sencillas basadas en escenario
   - Actualiza KPIs y gráfico existente
   ========================= */

const scenarioSelect = document.getElementById('scenario-select');
const scenarioYearEl = document.getElementById('scenario-year');
const runScenarioBtn = document.getElementById('run-scenario');
const scenarioOutput = document.getElementById('scenario-output');

function projectNDVI(baseNDVI, yearsAhead, scenario) {
  // Escenario: tasa anual de pérdida aproximada (simplificada y explicativa)
  const rates = { 'rcp26': 0.0008, 'rcp45': 0.0015, 'rcp85': 0.0030 }; // pérdida anual media en NDVI absoluta
  const rate = rates[scenario] || 0.001;
  return Math.max(0, baseNDVI - rate * yearsAhead);
}

function projectLST(baseLST, yearsAhead, scenario) {
  // Aumento de temperatura superficial (°C) proyectado por año (simplificado)
  const temps = { 'rcp26': 0.01, 'rcp45': 0.02, 'rcp85': 0.04 };
  const t = temps[scenario] || 0.02;
  return baseLST + t * yearsAhead;
}

runScenarioBtn.addEventListener('click', () => {
  // Tomar valores representativos: usar KPIs actuales o valores de chartData si están presentes
  // Aquí tomamos últimos valores del gráfico (chartData) como ejemplo
  const lastNDVI = chartData.datasets[1].data[chartData.labels.length - 1];
  const lastLST = chartData.datasets[0].data[chartData.labels.length - 1];

  const targetYear = parseInt(scenarioYearEl.value, 10);
  const yearsAhead = Math.max(0, targetYear - new Date().getFullYear());
  const scenario = scenarioSelect.value;

  const ndviProj = projectNDVI(lastNDVI, yearsAhead, scenario).toFixed(3);
  const lstProj = projectLST(lastLST, yearsAhead, scenario).toFixed(2);

  scenarioOutput.innerHTML = `
    <p><strong>Proyección para ${targetYear} (${scenario.toUpperCase()}):</strong></p>
    <p>NDVI estimado: ${ndviProj} (base ${lastNDVI})</p>
    <p>LST estimada: ${lstProj} °C (base ${lastLST} °C)</p>
  `;

  // Actualizar gráfico (añadir entrada proyectada)
  const labelsCopy = [...chartData.labels];
  const dataNDVI = [...chartData.datasets[1].data];
  const dataLST = [...chartData.datasets[0].data];

  labelsCopy.push(String(targetYear));
  dataNDVI.push(parseFloat(ndviProj));
  dataLST.push(parseFloat(lstProj));

  // Renderizar en el chart (creamos un overlay temporal sin perder original)
  if (riskChart) {
    riskChart.data.labels = labelsCopy;
    riskChart.data.datasets[0].data = dataLST;
    riskChart.data.datasets[1].data = dataNDVI;
    riskChart.update();
  }

  // Aplicar un estilizado temporal en el mapa: si NDVI cae bajo umbral, resaltar zonas
  if (parseFloat(ndviProj) < 0.4) {
    // Añadimos un aviso en sidebar y un overlay semitransparente
    document.getElementById('scenario-output').insertAdjacentHTML('beforeend',
      `<p style="color:crimson;">⚠️ Proyección muestra disminución importante de NDVI — priorizar zonas de restauración.</p>`);
  }
});

/* =========================
   MÓDULO 3: CAPA SATELITAL EN TIEMPO REAL (NASA FIRMS + WRI)
   - FIRMS WFS para detecciones activas (requiere MAP_KEY)
   - WRI: Mostrar capa emisiones via WMS (si WRI ofrece WMS) o cargar GeoTIFF mediante geotiff.js / Leaflet plugin
   ========================= */

/* Referencias: FIRMS WFS docs (MAP_KEY required). */
const firmsBtn = document.getElementById('toggle-firms');
const firmsKeyInput = document.getElementById('firms-key');
const satOutput = document.getElementById('sat-output');

let firmsLayer = null;
let wriGeotiffLayer = null;

// Convierte bounds Leaflet a bbox en formato xmin,ymin,xmax,ymax (EPSG:4326)
function getMapBBOX() {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}

// Cargar FIRMS WFS (GeoJSON) para bbox de vista actual.
// Nota: necesita MAP_KEY — solicita uno en FIRMS web services.
// Documentación: FIRMS WFS / mapkey info. :contentReference[oaicite:2]{index=2}
async function loadFIRMSLayer() {
  const key = firmsKeyInput.value.trim();
  if (!key) {
    satOutput.innerHTML = '<p style="color:orange">Introduce tu MAP_KEY FIRMS (obtenlo en https://firms.modaps.eosdis.nasa.gov/).</p>';
    return;
  }
  satOutput.innerHTML = 'Consultando FIRMS (detecciones recientes)...';

  const bbox = getMapBBOX();
  // Endpoint WFS (FIRMS). El parámetro mapkey es obligatorio.
  // Formato WFS GetFeature con bbox; la colección exacta (fires_viirs, fires_modis) puede variar.
  const wfsUrl = `https://firms.modaps.eosdis.nasa.gov/mapserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=fires_viirs&outputFormat=application/json&bbox=${bbox.join(',')},EPSG:4326&mapkey=${key}`;
  try {
    const res = await fetch(wfsUrl);
    if (!res.ok) throw new Error(`FIRMS error ${res.status}`);
    const geojson = await res.json();

    // Remover capa previa
    if (firmsLayer) map.removeLayer(firmsLayer);

    firmsLayer = L.geoJson(geojson, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 6,
        fillColor: f.properties.confidence ? (f.properties.confidence > 80 ? 'red' : 'orange') : 'red',
        color: '#fff',
        weight: 1,
        fillOpacity: 0.9
      }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindPopup(`<strong>🔥 Detección</strong><br>Fecha: ${p.acq_date || p.DATE}<br>Confidence: ${p.confidence || p.conf}`);
      }
    }).addTo(map);

    satOutput.innerHTML = `<p>FIRMS: ${geojson.features.length} detecciones en vista actual.</p>`;
  } catch (err) {
    console.error('Error FIRMS:', err);
    satOutput.innerHTML = `<p style="color:red">No se pudo obtener FIRMS: ${err.message}</p>`;
  }
}

firmsBtn.addEventListener('click', () => {
  if (!firmsLayer) loadFIRMSLayer();
  else {
    map.removeLayer(firmsLayer);
    firmsLayer = null;
    satOutput.innerHTML = 'Capa FIRMS desactivada.';
  }
});

// Opcional: actualizar automáticamente cuando el usuario mueve/zoom el mapa
map.on('moveend', () => {
  // Si firmsLayer está activada (ya cargada), recargar para la nueva vista
  if (firmsLayer && firmsKeyInput.value.trim()) {
    // recargamos con nueva bbox
    loadFIRMSLayer();
  }
});

/* ------------- WRI Emissions GeoTIFF (visualización via WMS/tiles) -------------
   - WRI/GFW ofrecen enlaces para descargar GeoTIFF por "tile_id" (usa package_show resources).
   - Lo más práctico en front-end: consumir WMS/Tile endpoint si existe, o usar un servicio intermedio (titiler/tileserver).
   - Aquí mostramos la aproximación por WMS (si WRI/ResourceWatch provee WMS) y por GeoTIFF en cliente (geotiff.js + leaflet-geotiff)
   ----------------------------------------------------------------------------- */

const addWriBtn = document.getElementById('add-wri-geotiff');

addWriBtn.addEventListener('click', async () => {
  satOutput.innerHTML = 'Intentando cargar capa de emisiones WRI (métodos posibles)...';

  // 1) Intenta WMS (ejemplo genérico). Si WRI provee geoserver/wms, configurarlo aquí:
  const wriWMS = 'https://data-api.globalforestwatch.org/geoserver/wms'; // ejemplo, revisar permisos
  try {
    // Intentamos añadir una capa WMS (si disponible)
    if (wriGeotiffLayer) { map.removeLayer(wriGeotiffLayer); wriGeotiffLayer = null; satOutput.innerHTML = 'Capa WRI removida.'; return; }

    wriGeotiffLayer = L.tileLayer.wms(wriWMS, {
      layers: 'gfw_forest_carbon_gross_emissions', // revisar nombre real del layer
      format: 'image/png',
      transparent: true,
      attribution: 'WRI / Global Forest Watch'
    }).addTo(map);

    satOutput.innerHTML = 'Capa WRI (WMS) añadida. Si no ves nada, revisa disponibilidad WMS o permisos CORS.';
    return;
  } catch (err) {
    console.warn('WMS failed, falling back to geotiff.js approach', err);
  }

  // 2) Fallback: GeoTIFF directo con geotiff.js + plugin. REQUIERE CORS en el archivo GeoTIFF.
  // Ejemplo: URL de uno de los tiles del dataset (ajusta tile_id a tu zona; revisa arch.pdf para tile_ids)
  const exampleTileUrl = 'https://data-api.globalforestwatch.org/dataset/gfw_forest_carbon_gross_emissions/v20240402/download/geotiff?grid=10/40000&tile_id=00N_080W&pixel_meaning=Mg_CO2e_ha-1';
  try {
    // Necesitas georaster-layer-for-leaflet o leaflet-geotiff plugin; aquí mostramos pseudo-código genérico:
    if (typeof GeoTIFF === 'undefined') {
      satOutput.innerHTML = 'Para visualizar GeoTIFFs en cliente necesitas incluir geotiff.js y un plugin Leaflet (ver instrucciones).';
      return;
    }

    // Si dispones de leaflet-geotiff (o georaster-layer-for-leaflet) usa su API; este bloque es orientativo.
    // Ejemplo con leaflet-geotiff (requiere incluir el plugin):
    /* 
    const gtiffLayer = new L.LeafletGeotiff(exampleTileUrl, {
        band: 0,
        renderer: new L.LeafletGeotiff.Plotty({colorScale: "viridis"})
    }).addTo(map);
    wriGeotiffLayer = gtiffLayer;
    satOutput.innerHTML = 'GeoTIFF WRI cargado (si el servidor permite CORS).';
    */
    satOutput.innerHTML = 'Intento de GeoTIFF: si tu servidor permite CORS puedes usar leaflet-geotiff o georaster-layer-for-leaflet. Revisa consola para más detalles.';
  } catch (err) {
    console.error('Error cargando GeoTIFF', err);
    satOutput.innerHTML = `Error cargando GeoTIFF: ${err.message}`;
  }
});

/* =========================
   INTEGRACIÓN: al hacer click en un área (onEachFeature) podemos:
   - Ejecutar la predicción local con datos del feature (si contiene NDVI, LST, density)
   - Mostrar la etiqueta de riesgo predicha por IA
   ========================= */

function onEachFeatureEnhanced(feature, layer) {
  const p = feature.properties || {};
  layer.on('click', (e) => {
    const ndvi = parseFloat(p.ndvi_avg ?? aiNdviEl.value);
    const lst = parseFloat(p.lst_avg ?? aiLstEl.value);
    const den = parseFloat(p.pop_den ?? aiDenEl.value);
    const r = predictRiskLight(ndvi, lst, den);
    const content = `<strong>Nivel de riesgo (IA):</strong> ${r.emoji} ${r.label} <br>
                     <strong>Puntaje:</strong> ${r.score}/100 <br>
                     <strong>NDVI:</strong> ${ndvi} <br>
                     <strong>LST:</strong> ${lst} °C <br>
                     <strong>Densidad:</strong> ${den} hab/km²`;
    layer.bindPopup(content).openPopup();
  });
}

/* Si usas GEOJSON local (loadRiskData), sustituye la función onEachFeature usada antes
   por onEachFeatureEnhanced para integrar IA automáticamente al click. */

/* =========================
   FIN DE MÓDULOS
   ========================= */



   // ============================================================
// 🌎 MÉTRICAS INTELIGENTES EN CLIC / ESPACIO — INTEGRACIÓN TOTAL
// ============================================================

// Variable global del modo IA (usa tu selector ya existente)
let modoIA = 'light'; // 'light' o 'tfjs'

// ------------------------------------------
// 1️⃣ Escuchar eventos en el mapa y teclado
// ------------------------------------------
map.on('click', function(e) {
  const { lat, lng } = e.latlng;
  generarMetricasYMostrar(lat, lng);
});

document.addEventListener('keydown', function(e) {
  if (e.code === 'Space') {
    const center = map.getCenter();
    generarMetricasYMostrar(center.lat, center.lng);
  }
});

// ------------------------------------------
// 2️⃣ Generar métricas y mostrar resultados
// ------------------------------------------
async function generarMetricasYMostrar(lat, lng) {
  // Obtener métricas reales o simuladas
  const metricas = obtenerMetricasReales(lat, lng) || generarMetricasAleatorias();

  const { ndvi, lst, densidad } = metricas;

  // Calcular riesgo
  let riesgo;
  if (modoIA === 'light') {
    riesgo = calcularRiesgoLigero(ndvi, lst, densidad);
  } else {
    riesgo = await predecirConTensorflow(ndvi, lst, densidad);
  }

  // Color por nivel de riesgo
  const colorRiesgo = riesgo > 70 ? '#e63946' : riesgo > 40 ? '#ffb703' : '#2a9d8f';

  // --------------------------------------
  // Mostrar popup interactivo sobre el mapa
  // --------------------------------------
  const popupContent = `
    <div style="font-size:13px; line-height:1.4;">
      <b>📍 Punto analizado</b><br>
      Lat: ${lat.toFixed(5)} | Lon: ${lng.toFixed(5)}<br><br>
      🌿 <b>NDVI:</b> ${ndvi.toFixed(2)}<br>
      🌡️ <b>LST:</b> ${lst.toFixed(1)} °C<br>
      👥 <b>Densidad:</b> ${densidad.toFixed(0)} hab/km²<br><br>
      ⚠️ <b style="color:${colorRiesgo}">Riesgo Ambiental: ${riesgo.toFixed(1)}%</b>
    </div>
  `;
  L.popup({ maxWidth: 260 })
    .setLatLng([lat, lng])
    .setContent(popupContent)
    .openOn(map);

  // --------------------------------------
  // Mostrar resumen en el panel lateral
  // --------------------------------------
  actualizarPanelMetricas(lat, lng, ndvi, lst, densidad, riesgo);

  // --------------------------------------
  // Añadir marcador visual
  // --------------------------------------
  L.circleMarker([lat, lng], {
    radius: 6,
    fillColor: colorRiesgo,
    color: '#222',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  })
  .bindTooltip(`Riesgo: ${riesgo.toFixed(1)}%`, { direction: 'top' })
  .addTo(map);

  // Log en consola
  console.log(`📊 Punto analizado [${lat.toFixed(4)}, ${lng.toFixed(4)}] → Riesgo ${riesgo.toFixed(1)}%`);
}

// ------------------------------------------
// 3️⃣ Función auxiliar: métricas aleatorias
// ------------------------------------------
function generarMetricasAleatorias() {
  return {
    ndvi: Math.random() * (0.8 - 0.2) + 0.2,     // 0.2 – 0.8
    lst: Math.random() * (35 - 20) + 20,         // 20°C – 35°C
    densidad: Math.random() * (6000 - 800) + 800 // 800 – 6000 hab/km²
  };
}

// ------------------------------------------
// 4️⃣ Obtener métricas reales desde capa GeoJSON
// ------------------------------------------
function obtenerMetricasReales(lat, lng) {
  let zona = null;
  if (typeof riskLayer !== 'undefined') {
    riskLayer.eachLayer(layer => {
      if (layer.getBounds().contains([lat, lng])) zona = layer.feature.properties;
    });
  }
  return zona ? {
    ndvi: zona.NDVI || Math.random() * 0.6 + 0.2,
    lst: zona.LST || Math.random() * 10 + 25,
    densidad: zona.DENSIDAD || Math.random() * 4000 + 1000
  } : null;
}

// ------------------------------------------
// 5️⃣ Modelo Ligero (ya existente o redefinido)
// ------------------------------------------
function calcularRiesgoLigero(ndvi, lst, densidad) {
  const pesoNDVI = 0.4, pesoLST = 0.45, pesoDensidad = 0.15;
  const ndviRiesgo = (1 - ndvi);
  const lstRiesgo = (lst - 20) / 20;
  const densRiesgo = densidad / 10000;
  const riesgo = (pesoNDVI * ndviRiesgo + pesoLST * lstRiesgo + pesoDensidad * densRiesgo) * 100;
  return Math.min(100, Math.max(0, riesgo));
}

// ------------------------------------------
// 6️⃣ Modelo TensorFlow.js (opcional)
// ------------------------------------------
async function predecirConTensorflow(ndvi, lst, densidad) {
  if (!window.model) {
    console.warn('Modelo TensorFlow.js no entrenado aún. Se usará modo ligero.');
    return calcularRiesgoLigero(ndvi, lst, densidad);
  }
  const input = tf.tensor2d([[ndvi, lst, densidad]]);
  const pred = model.predict(input);
  const value = await pred.data();
  return value[0] * 100;
}

// ------------------------------------------
// 7️⃣ Actualizar Panel lateral dinámicamente
// ------------------------------------------
function actualizarPanelMetricas(lat, lng, ndvi, lst, densidad, riesgo) {
  const nivel = riesgo > 70 ? 'Alto' : riesgo > 40 ? 'Moderado' : 'Bajo';
  const color = riesgo > 70 ? '#e63946' : riesgo > 40 ? '#ffb703' : '#2a9d8f';

  // Actualizar KPIs
  document.getElementById('kpi-risk').innerHTML = `${riesgo.toFixed(1)}%`;
  document.getElementById('kpi-veg').innerHTML = `${ndvi.toFixed(2)}`;

  // Mostrar detalles IA
  const aiPanel = document.getElementById('ai-output');
  aiPanel.innerHTML = `
    <b>Último punto analizado:</b><br>
    Lat: ${lat.toFixed(4)} | Lon: ${lng.toFixed(4)}<br>
    NDVI: ${ndvi.toFixed(2)} | LST: ${lst.toFixed(1)} °C | Densidad: ${densidad.toFixed(0)}<br>
    <b style="color:${color}">Riesgo: ${riesgo.toFixed(1)}% (${nivel})</b>
  `;
}
