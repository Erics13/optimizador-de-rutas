import type { Zone } from '../types';

const normalizeForMatch = (str: string): string => {
    if (!str) return '';
    return str
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const getTroubleshootingInfo = (event: { category: string, errorMessage?: string | null }): { action: string, solution: string } => {
    const category = normalizeForMatch(event.category);
    const message = normalizeForMatch(event.errorMessage || '');

    if (category === 'unreachable') {
        if (message.includes('el olc no informa los registros por hora') || message.includes('el olc no esta accesible')) {
            return {
                action: 'Revisar código de OLC, revisar energía, que no sea un problema electrico, llave térmica, conectores, probar luminaria con puente, etc. Aplicar reseteo de OLC.',
                solution: 'Corregir código de OLC en Interact. Reparar posible problema eléctrico.'
            };
        }
    }
    
    if (category === 'broken') {
        if (message.includes('corte de luz parcial')) {
            return {
                action: 'Medir consumo de luminaria, posible placa de led rota o algunos led quemados. Revisar posible vandalismo.',
                solution: 'Posible cambio de Luminaria.'
            };
        }
        if (message.includes('posible falla en el driver')) {
            return {
                action: 'Medir consumo de luminaria en sitio, comparar con el consumo medido en Interact (RTP).',
                solution: 'Posible cambio de Luminaria.'
            };
        }
        if (message.includes('la corriente medida es menor que lo esperado') || message.includes('la corriente medida para la combinacion de driver y lampara es mayor')) {
            return {
                action: 'Medir consumo de luminaria en sitio, comparar con el consumo medido en Interact (RTP).',
                solution: 'Posible cambio de Luminaria.'
            };
        }
        if (message.includes('el chip del gps en el nodo esta roto')) {
            return {
                action: 'Cambio de OLC.',
                solution: 'Cambio de OLC.'
            };
        }
        if (message.includes('el componente de medicion de energia esta roto')) {
            return {
                action: 'Cambio de OLC.',
                solution: 'Cambio de OLC.'
            };
        }
    }

    if (category === 'configuration error') {
        if (message.includes('error de coincidencia del id de segmento')) {
            return {
                action: 'La OLC instalada no se puede comunicar con el gabinete porque ya esta vinculada con otro gabinete. Cambio de OLC.',
                solution: 'Cambio de OLC.'
            };
        }
    }
    
    if (category === 'hardware failure') {
        if (message.includes('posible falla del rele en el olc')) {
            return {
                action: 'El relé de la OLC.',
                solution: 'Cambio de OLC.'
            };
        }
    }
    
    if (category === 'unspecific warning') {
        if (message.includes('el voltaje de la red electrica de entrada detectado del sistema es muy bajo o muy alto')) {
            return {
                action: 'Medir voltaje en llave térmica individual de la luminaria, comparar con el consumo medido en Interact (RTP). Posible falla en térmica o conectores.',
                solution: 'Cambio de llave térmica o conectores.'
            };
        }
    }

    return { action: '', solution: '' };
};

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

const formatTension = (tension?: string): string => {
    if (!tension) return 'N/A';
    const tensionStr = String(tension).trim();
    if (tensionStr.match(/v$/i)) {
        return tensionStr;
    }
    return `${tensionStr}V`;
};

const formatSituation = (situation?: string): string => {
    if (!situation || situation === 'N/A' || situation.trim() === '-') {
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
    const isMaxPriority = zoneData.priority === 1 && zoneData.cabinetData;
    const isHighPriority = zoneData.isCabinetRoute && !isMaxPriority;

    let tableHeadersHTML = '';
    let tableBodyHTML = '';
    let tableTitle = 'Hoja de Ruta';
    let tableTheadClass = 'bg-slate-100';
    let headerTextClass = 'text-slate-500';
    let titleClass = 'text-indigo-700';

    if (isMaxPriority && zoneData.cabinetData) {
        const cabinet = zoneData.cabinetData;
        const gmapsUrl = `https://www.google.com/maps?q=${cabinet.lat},${cabinet.lon}`;
        const message = `Posible falla en Tablero\nCuenta: ${cabinet.accountNumber}\nDirección: ${cabinet.direccion || 'N/A'}\nUbicación: ${gmapsUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

        tableTitle = 'Resumen del Tablero Afectado';
        tableTheadClass = 'bg-red-100';
        headerTextClass = 'text-red-800';
        titleClass = 'text-red-700';

        tableHeadersHTML = `
            <tr>
                <th scope="col" class="w-1/3 px-4 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Propiedad</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Valor</th>
                <th scope="col" class="w-24 px-4 py-3 text-center text-xs font-medium ${headerTextClass} uppercase tracking-wider">Compartir</th>
            </tr>`;

        const whatsappButtonHTML = `
            <td class="px-4 py-3 text-sm align-middle text-center action-cell" rowspan="6">
                <a href="${whatsappUrl}" target="_blank" onclick="event.stopPropagation()" title="Compartir en WhatsApp" class="inline-block p-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.586-1.45L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 4.315 1.731 6.069l.161.287-1.175 4.284 4.36-1.162.269.159z"/></svg>
                </a>
            </td>
        `;
        
        tableBodyHTML = `
            <tr class="cabinet-summary-row" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">Nro. de Cuenta</td>
                <td class="px-4 py-3 text-sm font-bold text-slate-900">${cabinet.accountNumber}</td>
                ${whatsappButtonHTML}
            </tr>
            <tr class="cabinet-summary-row-alt" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">Dirección</td>
                <td class="px-4 py-3 text-sm text-slate-600">${cabinet.direccion || 'N/A'}</td>
            </tr>
            <tr class="cabinet-summary-row" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">Tensión</td>
                <td class="px-4 py-3 text-sm text-slate-600">${formatTension(cabinet.tension)}</td>
            </tr>
            <tr class="cabinet-summary-row-alt" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">Tarifa</td>
                <td class="px-4 py-3 text-sm text-slate-600">${cabinet.tarifa || 'N/A'}</td>
            </tr>
            <tr class="cabinet-summary-row" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">Pot. Contratada</td>
                <td class="px-4 py-3 text-sm text-slate-600">${cabinet.potContrat || 'N/A'}</td>
            </tr>
            <tr class="cabinet-summary-row-alt" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">Luminarias Afectadas</td>
                <td class="px-4 py-3 text-sm font-bold text-red-600">${cabinet.affectedLuminaires.length}</td>
            </tr>
        `;

    } else {
        if (isHighPriority) {
            headerTextClass = 'text-amber-800';
            titleClass = 'text-amber-800';
            tableTheadClass = 'bg-amber-100';
        }
        
        tableHeadersHTML = `
            <tr>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">#</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">ID Luminaria / OLC</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">ID Gabinete</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Potencia</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Fecha Reporte</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Categoría</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Situación</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Mensaje de Error</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Acción</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider">Posible Solución</th>
                <th scope="col" class="px-3 py-3 text-center text-xs font-medium ${headerTextClass} uppercase tracking-wider">Compartir</th>
            </tr>`;

        tableBodyHTML = route.map((event, index) => {
            const { action, solution } = getTroubleshootingInfo(event);
            const gmapsUrl = `https://www.google.com/maps?q=${event.lat},${event.lon}`;
            const message = `Ubicación: ${gmapsUrl}\n\nLuminaria: ${event.luminaireId || 'N/A'}\nOLC: ${event.olcId || 'N/A'}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            const rowClass = isHighPriority ? 'cabinet-row' : 'regular-row';
            
            return `
            <tr class="${rowClass}" onclick="window.open('${gmapsUrl}', '_blank')" title="Click para abrir en Google Maps">
                <td class="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-800 align-top">${index + 1}</td>
                <td class="px-3 py-3 text-sm font-bold text-slate-700 align-top">${event.luminaireId || 'N/A'}<div class="mt-1 text-sm font-bold text-slate-700">${event.olcId || 'N/A'}</div></td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.cabinetId || 'N/A'}</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.power} W</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.reportedDate || 'N/A'}</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${translateCategory(event.category)}</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${formatSituation(event.situation)}</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${event.errorMessage || 'N/A'}</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${action}</td>
                <td class="px-3 py-3 text-sm text-slate-600 align-top">${solution}</td>
                <td class="px-3 py-3 text-sm align-top text-center action-cell">
                    <a href="${whatsappUrl}" target="_blank" onclick="event.stopPropagation()" title="Compartir en WhatsApp" class="inline-block p-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.586-1.45L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 4.315 1.731 6.069l.161.287-1.175 4.284 4.36-1.162.269.159z"/></svg>
                    </a>
                </td>
            </tr>`;
        }).join('');
    }


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
        tbody tr.regular-row { transition: background-color 0.15s ease-in-out; cursor: pointer; }
        tbody tr.regular-row:nth-child(even) { background-color: #f8fafc; }
        tbody tr.regular-row:hover { background-color: #f1f5f9; }
        tbody tr.cabinet-row { transition: background-color 0.15s ease-in-out; cursor: pointer; background-color: #fffbeb; }
        tbody tr.cabinet-row:hover { background-color: #fef3c7; }
        tbody tr .action-cell:hover { background-color: transparent !important; }
        tr.cabinet-summary-row, tr.cabinet-summary-row-alt { cursor: pointer; transition: background-color 0.15s ease-in-out; }
        tr.cabinet-summary-row { background-color: #fee2e2; }
        tr.cabinet-summary-row-alt { background-color: #fef2f2; }
        tr.cabinet-summary-row:hover, tr.cabinet-summary-row-alt:hover { background-color: #fecaca; }
        td, th { vertical-align: top; }
    </style>
</head>
<body class="bg-slate-100 text-slate-800">
    <header class="bg-white shadow-md"><div class="container mx-auto px-4 py-6 md:px-8"><h1 class="text-2xl font-bold text-slate-900">Optimizador de Rutas - Hoja Compartida</h1><p class="text-slate-500">Este es un informe de ruta optimizada que ha sido generado para ser compartido.</p></div></header>
    <main class="container mx-auto p-4 md:p-8">
        <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="p-6 bg-slate-50 border-b border-slate-200">
                <h3 class="text-xl font-bold ${titleClass}">${zoneData.name}</h3>
                <p class="text-sm text-slate-500 mt-1">Total de luminarias en esta hoja de ruta: ${route.length}</p>
            </div>
            <div class="p-6 grid grid-cols-1 gap-8">
                <div>
                    <h4 class="flex items-center gap-2 text-lg font-semibold text-slate-700 mb-3">${tableTitle}</h4>
                    <div class="overflow-x-auto rounded-lg border border-slate-200">
                        <table class="min-w-full divide-y divide-slate-200">
                            <thead class="${tableTheadClass}">${tableHeadersHTML}</thead>
                            <tbody class="bg-white divide-y divide-slate-200">${tableBodyHTML}</tbody>
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
            const zoneData = ${JSON.stringify(zoneData, null, 2)};
            const route = zoneData.optimizedRoute || [];
            if (route.length === 0 && !zoneData.depot) {
                document.getElementById('map').innerHTML = '<p class="text-center p-8 text-slate-500">No hay datos de ruta para mostrar.</p>';
                return;
            }

            const createIcon = (svg) => \`data:image/svg+xml;base64,\${btoa(svg)}\`;
            const createHomeIcon = () => { const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.3"/></filter></defs><path fill="#16a34a" filter="url(#shadow)" d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path fill="#16a34a" filter="url(#shadow)" d="M12 5.432l8.159 8.159c.026.026.05.054.07.084v6.101a2.25 2.25 0 01-2.25 2.25H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.25a2.25 2.25 0 01-2.25-2.25v-6.101c.02-.03.044-.058.07-.084L12 5.432z" /></svg>'; return new L.Icon({ iconUrl: createIcon(svg), iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] }); };
            const createNumberedIcon = (n) => { const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs><circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#4f46e5" stroke-width="1.5" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="#4f46e5">\${n}</text></svg>\`; return new L.Icon({ iconUrl: createIcon(svg), iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }); };
            const createCabinetIcon = (n) => { const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs><circle cx="12" cy="12" r="11" fill="#f97316" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="white">\${n}</text></svg>\`; return new L.Icon({ iconUrl: createIcon(svg), iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }); };
            const createSituationIcon = (n) => { const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs><circle cx="12" cy="12" r="11" fill="#1e293b" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="white">\${n}</text></svg>\`; return new L.Icon({ iconUrl: createIcon(svg), iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }); };
            const createAffectedLuminaireIcon = (n) => { const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.5" stdDeviation="0.5" flood-color="black" flood-opacity="0.3"/></filter></defs><circle cx="12" cy="12" r="10" fill="#fecaca" stroke="#b91c1c" stroke-width="1" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="10" font-family="Inter, sans-serif" font-weight="bold" fill="#7f1d1d">\${n}</text></svg>\`; return new L.Icon({ iconUrl: createIcon(svg), iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11] }); };
            const createCabinetLocationIcon = () => { const svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.4"/></filter></defs><rect x="2" y="2" width="20" height="20" rx="3" fill="#dc2626" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="14" font-family="Inter, sans-serif" font-weight="bold" fill="white">T</text></svg>\`; return new L.Icon({ iconUrl: createIcon(svg), iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36] }); };
            
            const translateCategoryForScript = (c) => { const t = { 'unspecific warning': 'Advertencia no específica', 'broken': 'Roto', 'unreachable': 'Inaccesible', 'inconsistent': 'Inconsistente' }; return t[c.toLowerCase().trim()] || c; };

            const depotPosition = [zoneData.depot.lat, zoneData.depot.lon];
            const allPointsForBounds = [depotPosition, ...route.map(e => [e.lat, e.lon])];
            if (zoneData.cabinetData) allPointsForBounds.push([zoneData.cabinetData.lat, zoneData.cabinetData.lon]);

            const map = L.map('map').setView(depotPosition, 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);

            if (zoneData.routePolyline && zoneData.routePolyline.length > 0) { L.polyline(zoneData.routePolyline, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(map); }
            
            L.marker(depotPosition, { icon: createHomeIcon(), zIndexOffset: 1000 }).addTo(map).bindPopup('<strong>Depósito: ${zoneData.depot.zoneName}</strong><br/>Inicio y Fin de la Ruta');

            if (zoneData.cabinetData) { L.marker([zoneData.cabinetData.lat, zoneData.cabinetData.lon], { icon: createCabinetLocationIcon(), zIndexOffset: 1500 }).addTo(map).bindPopup('<strong>Tablero: ' + zoneData.cabinetData.accountNumber + '</strong><br/>' + (zoneData.cabinetData.direccion || "Dirección no disponible")); }

            route.forEach((event, index) => {
                const popupContent = \`<strong>\${index + 1}. \${event.luminaireId}</strong><br/>ID OLC: \${event.olcId || 'N/A'}<br/>Categoría: \${translateCategoryForScript(event.category || '')}<br/>Situación: \${event.situation || 'N/A'}\`;
                const situation = event.situation ? event.situation.trim() : '';
                const hasSituation = situation && situation !== '' && situation !== 'N/A' && situation !== '-';
                let icon, zIndexOffset = 0;

                if (zoneData.cabinetData) { icon = createAffectedLuminaireIcon(index + 1); zIndexOffset = 100; }
                else if (hasSituation) { icon = createSituationIcon(index + 1); zIndexOffset = 200; }
                else if (zoneData.isCabinetRoute) { icon = createCabinetIcon(index + 1); zIndexOffset = 500; }
                else { icon = createNumberedIcon(index + 1); }
                
                L.marker([event.lat, event.lon], { icon: icon, zIndexOffset: zIndexOffset }).addTo(map).bindPopup(popupContent);
            });
            
            if (allPointsForBounds.length > 1) { const bounds = L.latLngBounds(allPointsForBounds); if (bounds.isValid()) map.fitBounds(bounds, { padding: [25, 25] }); }
        });
    </script>
</body>
</html>`;
};