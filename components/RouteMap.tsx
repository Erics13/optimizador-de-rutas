

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L, { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import { Zone } from '../types';

// Fix for default icon issue with bundlers like Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createHomeIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.3"/></filter></defs>
      <path fill="#16a34a" filter="url(#shadow)" d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
      <path fill="#16a34a" filter="url(#shadow)" d="M12 5.432l8.159 8.159c.026.026.05.054.07.084v6.101a2.25 2.25 0 01-2.25 2.25H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75-.75V21a.75.75 0 01-.75.75H5.25a2.25 2.25 0 01-2.25-2.25v-6.101c.02-.03.044-.058.07-.084L12 5.432z" />
    </svg>
  `;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const createNumberedIcon = (number: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs>
      <circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#4f46e5" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="#4f46e5">${number}</text>
    </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const createCabinetIcon = (number: number) => {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
       <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs>
      <circle cx="12" cy="12" r="11" fill="#f97316" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="white">${number}</text>
    </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const createSituationIcon = (number: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.2"/></filter></defs>
      <circle cx="12" cy="12" r="11" fill="#1e293b" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="bold" fill="white">${number}</text>
    </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};


const createAffectedLuminaireIcon = (number: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22">
      <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.5" stdDeviation="0.5" flood-color="black" flood-opacity="0.3"/></filter></defs>
      <circle cx="12" cy="12" r="10" fill="#fecaca" stroke="#b91c1c" stroke-width="1" filter="url(#shadow)"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="10" font-family="Inter, sans-serif" font-weight="bold" fill="#7f1d1d">${number}</text>
    </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
};

const createCabinetLocationIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.4"/></filter></defs>
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#dc2626" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="14" font-family="Inter, sans-serif" font-weight="bold" fill="white">T</text>
    </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};


const translateCategory = (category: string): string => {
    if (!category) return '';
    const lowerCategory = category.toLowerCase().trim();
    const translations: { [key: string]: string } = {
        'unspecific warning': 'Advertencia no específica',
        'broken': 'Roto',
        'unreachable': 'Inaccesible',
        'inconsistent': 'Inconsistente',
    };
    return translations[lowerCategory] || category;
};

interface RouteMapProps {
  zoneData: Zone;
  onMapReady?: (elements: { map: L.Map; polyline: L.Polyline | null }) => void;
}

const MapUpdater: React.FC<{ bounds: L.LatLngBoundsExpression }> = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        const validBounds = L.latLngBounds(bounds);
        if (validBounds.isValid()) {
            map.fitBounds(validBounds, { padding: [25, 25] });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount to set initial view
    return null;
};


export const RouteMap: React.FC<RouteMapProps> = ({ zoneData, onMapReady }) => {
    const route = zoneData.optimizedRoute;
    const polylineRef = useRef<L.Polyline | null>(null);

    const MapInstanceProvider: React.FC = () => {
        const map = useMap();
        useEffect(() => {
            if (map && onMapReady) {
                onMapReady({ map, polyline: polylineRef.current });
            }
        }, [map, onMapReady]);
        return null;
    }

    if (!route || route.length === 0) {
        return ( <div className="w-full h-full bg-slate-200 flex items-center justify-center"><p className="text-slate-500">No hay ruta para mostrar en el mapa.</p></div> );
    }
    
    const depotPosition: LatLngTuple = [zoneData.depot.lat, zoneData.depot.lon];
    
    const allPointsForBounds: LatLngTuple[] = route.map(event => [event.lat, event.lon]);
    if (zoneData.cabinetData) {
        allPointsForBounds.push([zoneData.cabinetData.lat, zoneData.cabinetData.lon]);
    }
    if (allPointsForBounds.length === 0) {
        allPointsForBounds.push(depotPosition);
    }
    
    const bounds = L.latLngBounds(allPointsForBounds);
    const center = bounds.isValid() ? bounds.getCenter() : depotPosition;
    
    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <MapUpdater bounds={bounds} />
            <MapInstanceProvider />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; OSRM'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {zoneData.routePolyline && zoneData.routePolyline.length > 0 && (
                <Polyline ref={polylineRef} positions={zoneData.routePolyline} pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.8 }} />
            )}

            <Marker position={depotPosition} icon={createHomeIcon()} zIndexOffset={1000}>
                <Popup><div style={{ lineHeight: '1.5' }}><strong style={{ fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>Depósito: {zoneData.depot.zoneName}</strong><span>Inicio y Fin de la Ruta</span></div></Popup>
            </Marker>

            {zoneData.cabinetData && (
                 <Marker position={[zoneData.cabinetData.lat, zoneData.cabinetData.lon]} icon={createCabinetLocationIcon()} zIndexOffset={1500}>
                    <Popup><div style={{ lineHeight: '1.5' }}><strong style={{ fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>Tablero: {zoneData.cabinetData.accountNumber}</strong><span>{zoneData.cabinetData.direccion || 'Dirección no disponible'}</span></div></Popup>
                 </Marker>
            )}

            {route.map((event, index) => {
                const situation = event.situation?.trim();
                const hasSituation = situation && situation !== '' && situation !== 'N/A' && situation !== '-';
                
                let icon;
                let zIndexOffset = 0;

                if (zoneData.cabinetData) {
                    icon = createAffectedLuminaireIcon(index + 1);
                    zIndexOffset = 100;
                } else if (hasSituation) {
                    icon = createSituationIcon(index + 1);
                    zIndexOffset = 200;
                } else if (zoneData.isCabinetRoute) {
                    icon = createCabinetIcon(index + 1);
                    zIndexOffset = 500;
                } else {
                    icon = createNumberedIcon(index + 1);
                }

                return (
                    <Marker key={event._internal_id || `marker-${index}`} position={[event.lat, event.lon]} icon={icon} zIndexOffset={zIndexOffset}>
                        <Popup>
                            <div style={{ lineHeight: '1.5' }}>
                                <strong style={{ fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>{index + 1}. {event.luminaireId}</strong>
                                <span>ID OLC: {event.olcId || 'N/A'}</span><br/>
                                <span>Categoría: {translateCategory(event.category) || 'N/A'}</span><br/>
                                <span>Situación: {event.situation || 'N/A'}</span><br/>
                                <span>Potencia: {event.power}W</span><br/>
                                <span>Mensaje: {event.errorMessage || 'N/A'}</span><br/>
                                <span>Fecha: {event.reportedDate || 'N/A'}</span>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
            
        </MapContainer>
    );
};
