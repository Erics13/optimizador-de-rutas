
import type { Zone } from '../types';

const translateCategory = (category: string): string => {
    if (!category) return 'N/A';
    const lowerCategory = category.toLowerCase().trim();
    const translations: { [key: string]: string } = {
        'unspecific warning': 'Advertencia no específica',
        'broken': 'Roto',
        'unreachable': 'Inaccesible',
        'inconsistent': 'Inconsistente',
    };
    return translations[lowerCategory] || category;
};

const formatSituation = (situation?: string): string => {
    if (!situation || situation === 'N/A') {
        return `<span class="text-slate-500">-</span>`;
    }

    const lowerSit = situation.toLowerCase();
    let colorClasses = 'bg-slate-100 text-slate-800';
    
    if (lowerSit.includes('vandaliza') || lowerSit.includes('hurto') || lowerSit.includes('columna caida')) {
        colorClasses = 'bg-red-100 text-red-800 font-bold';
    } else if (lowerSit.includes('falta poda') || lowerSit.includes('sin energia')) {
        colorClasses = 'bg-yellow-100 text-yellow-800';
    } else if (lowerSit.includes('retirada')) {
        colorClasses = 'bg-blue-100 text-blue-800';
    }

    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses}">${situation}</span>`;
};

// This function will generate the complete HTML content for a self-contained, shareable file.
export const generateStandaloneHTML = (zoneData: Zone): string => {
    const route = zoneData.optimizedRoute || [];

    const tableRowsHTML = route.map((event, index) => {
        // WhatsApp message includes stop number, luminaire ID, OLC ID, and a Google Maps link.
        const gmapsUrl = `https://www.google.com/maps?q=${event.lat},${event.lon}`;
        const message = `Parada: ${index + 1}\nID Luminaria: ${event.luminaireId || 'N/A'}\nID OLC: ${event.olcId || 'N/A'}\nUbicación: ${gmapsUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        const onClickAction = `window.open('${whatsappUrl}', '_blank')`;

        const isCabinet = event.isCabinetEvent;
        const rowClass = isCabinet ? 'cabinet-event' : 'regular-row';

        if (isCabinet) {
            return `
            <tr class="${rowClass}" onclick="${onClickAction}" title="Click para compartir en WhatsApp">
                <td class="px-3 py-3 whitespace-nowrap text-sm font-medium text-amber-900 align-top">${index + 1}</td>
                <td class="px-3 py-3 text-sm font-semibold text-amber-900 align-top">${event.luminaireId}</td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">N/A</td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">N/A</td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">${event.power}</td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">${event.reportedDate || 'N/A'}</td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-200 text-amber-800">
                    ${event.category}
                  </span>
                </td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">N/A</td>
                <td class="px-3 py-3 text-sm text-amber-700 align-top">${event.errorMessage || 'N/A'}</td>
            </tr>`;
        }
        
        return `
        <tr class="${rowClass}" onclick="${onClickAction}" title="Click para compartir en WhatsApp">
            <td class="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-800 align-top">${index + 1}</td>
            <td class="px-3 py-3 text-sm font-bold text-slate-700 align-top">${event.luminaireId || 'N/A'}</td>
            <td class="px-3 py-3 text-sm font-bold text-slate-700 align-top">${event.olcId || 'N/A'}</td>
            <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.cabinetId || 'N/A'}</td>
            <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.power}</td>
            <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.reportedDate || 'N/A'}</td>
            <td class="px-3 py-3 text-sm text-slate-600 align-top">${translateCategory(event.category)}</td>
            <td class="px-3 py-3 text-sm text-slate-600 align-top">${formatSituation(event.situation)}</td>
            <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.errorMessage || 'N/A'}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hoja de Ruta: ${zoneData.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <style>
        body { font-family: Inter, sans-serif; }
        .leaflet-popup-content-wrapper { border-radius: 8px; }
        .leaflet-popup-content { margin: 12px; font-size: 13px; line-height: 1.5; }
        .leaflet-popup-content strong { font-size: 1.1em; display: block; margin-bottom: 4px; }
        tbody tr { transition: background-color 0.15s ease-in-out; }
        tbody tr.regular-row:nth-child(even) { background-color: #f8fafc; /* bg-slate-50 */ }
        tbody tr.regular-row:hover { background-color: #f1f5f9; /* bg-slate-100 */ }
        tbody tr.cabinet-event { background-color: #fffbeb; /* bg-amber-50 */ }
        tbody tr.cabinet-event:hover { background-color: #fef3c7; /* bg-amber-100 */ }
        tbody tr { cursor: pointer; }
    </style>
</head>
<body class="bg-slate-100 text-slate-800">
    <header class="bg-white shadow-md">
      <div class="container mx-auto px-4 py-6 md:px-8">
          <h1 class="text-2xl font-bold text-slate-900">Optimizador de Rutas - Hoja Compartida</h1>
          <p class="text-slate-500">Este es un informe de ruta optimizada que ha sido generado para ser compartido.</p>
      </div>
    </header>

    <main class="container mx-auto p-4 md:p-8">
        <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="p-6 bg-slate-50 border-b border-slate-200">
                <h3 class="text-xl font-bold text-indigo-700">${zoneData.name}</h3>
                <p class="text-sm text-slate-500 mt-1">Total de eventos en esta hoja de ruta: ${route.length}</p>
            </div>
            
            <div class="p-6 grid grid-cols-1 gap-8">
                <div>
                    <h4 class="flex items-center gap-2 text-lg font-semibold text-slate-700 mb-3">Hoja de Ruta</h4>
                    <div class="overflow-x-auto rounded-lg border border-slate-200">
                        <table class="min-w-full divide-y divide-slate-200 table-fixed">
                            <thead class="bg-slate-100">
                                <tr>
                                    <th scope="col" class="w-12 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                                    <th scope="col" class="w-44 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Luminaria / Tablero</th>
                                    <th scope="col" class="w-44 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Antena</th>
                                    <th scope="col" class="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Gabinete</th>
                                    <th scope="col" class="w-24 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Potencia (W)</th>
                                    <th scope="col" class="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha Reporte</th>
                                    <th scope="col" class="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                                    <th scope="col" class="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Situación</th>
                                    <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mensaje de Error</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-slate-200">${tableRowsHTML}</tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 class="flex items-center gap-2 text-lg font-semibold text-slate-700 mb-3">Mapa de la Hoja de Ruta</h4>
                    <div id="map" class="h-[600px] bg-slate-200 rounded-lg overflow-hidden border border-slate-200"></div>
                </div>
            </div>
        </div>
    </main>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const zoneData = ${JSON.stringify(zoneData)};
            const route = zoneData.optimizedRoute || [];
            if (route.length === 0 && !zoneData.depot) {
                document.getElementById('map').innerHTML = '<p class="text-center p-8 text-slate-500">No hay datos de ruta para mostrar.</p>';
                return;
            }

            const createIcon = (svg) => \`data:image/svg+xml;base64,\${btoa(svg)}\`;

            const createHomeIcon = () => {
              const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.3"/></filter></defs><path fill="#16a34a" filter="url(#shadow)" d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path fill="#16a34a" filter="url(#shadow)" d="M12 5.432l8.159 8.159c.026.026.05.054.07.084v6.101a2.25 2.25 0 01-2.25 2.25H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.25a2.25 2.25 0 01-2.25-2.25v-6.101c.02-.03.044-.058.07-.084L12 5.432z" /></svg>';
              return new L.Icon({ iconUrl: createIcon(svg), iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
            };
            const createNumberedIcon = (number) => {
              const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs><circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#4f46e5" stroke-width="1.5" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="#4f46e5">\${number}</text></svg>\`;
              return new L.Icon({ iconUrl: createIcon(svg), iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
            };
            const createCabinetIcon = (number) => {
              const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs><circle cx="12" cy="12" r="11" fill="#f97316" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="white">\${number}</text></svg>\`;
              return new L.Icon({ iconUrl: createIcon(svg), iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
            };
            const translateCategoryForScript = (category) => {
                if (!category) return '';
                const lowerCategory = category.toLowerCase().trim();
                const translations = { 'unspecific warning': 'Advertencia no específica', 'broken': 'Roto', 'unreachable': 'Inaccesible', 'inconsistent': 'Inconsistente' };
                return translations[lowerCategory] || category;
            };

            const depotPosition = [zoneData.depot.lat, zoneData.depot.lon];
            const eventPositions = route.map(event => [event.lat, event.lon]);
            const allPointsForBounds = [depotPosition, ...eventPositions];
            const map = L.map('map').setView(depotPosition, 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            if (zoneData.routePolyline && zoneData.routePolyline.length > 0) {
                L.polyline(zoneData.routePolyline, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(map);
            }
            
            L.marker(depotPosition, { icon: createHomeIcon(), zIndexOffset: 1000 }).addTo(map)
                .bindPopup('<strong>Depósito: ${zoneData.depot.zoneName}</strong><br/>Inicio y Fin de la Ruta');

            route.forEach((event, index) => {
                const popupContent = \`<strong>\${index + 1}. \${event.luminaireId}</strong><br/>
                    ID OLC: \${event.olcId || 'N/A'}<br/>
                    Categoría: \${translateCategoryForScript(event.category) || 'N/A'}<br/>
                    Situación: \${event.situation || 'N/A'}<br/>
                    Potencia: \${event.power}W<br/>
                    Mensaje: \${event.errorMessage || 'N/A'}<br/>
                    Fecha: \${event.reportedDate || 'N/A'}\`;
                L.marker([event.lat, event.lon], { icon: event.isCabinetEvent ? createCabinetIcon(index + 1) : createNumberedIcon(index + 1) })
                    .addTo(map)
                    .bindPopup(popupContent);
            });
            
            if (allPointsForBounds.length > 0) {
              const bounds = L.latLngBounds(allPointsForBounds);
              if (bounds.isValid()) {
                  map.fitBounds(bounds, { padding: [25, 25] });
              }
            }
        });
    </script>
</body>
</html>`;
};
