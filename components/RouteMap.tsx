
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L, { LatLngExpression, LatLngBoundsExpression, LatLngTuple } from 'leaflet';
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
      <path fill="#16a34a" filter="url(#shadow)" d="M12 5.432l8.159 8.159c.026.026.05.054.07.084v6.101a2.25 2.25 0 01-2.25 2.25H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.25a2.25 2.25 0 01-2.25-2.25v-6.101c.02-.03.044-.058.07-.084L12 5.432z" />
    </svg>
  `;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};


// Function to create a numbered icon for regular events
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

// Function to create a distinct numbered icon for cabinet events
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

// Component to automatically adjust map view to fit all markers
interface MapUpdaterProps {
  bounds: LatLngBoundsExpression;
}

const MapUpdater: React.FC<MapUpdaterProps> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    const animationFrameId = requestAnimationFrame(() => {
      try {
        if (map.getContainer()) {
          map.invalidateSize();
          if (bounds) {
            const validBounds = Array.isArray(bounds) ? L.latLngBounds(bounds) : bounds;
            if (validBounds.isValid()) {
                map.fitBounds(validBounds, { padding: [25, 25] });
            }
          }
        }
      } catch(e) {
        console.error("Error al actualizar el mapa:", e);
      }
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [map, bounds]);
  return null;
};

interface RouteMapProps {
  zoneData: Zone;
  onMapReady?: (map: L.Map) => void;
}

export const RouteMap: React.FC<RouteMapProps> = ({ zoneData, onMapReady }) => {
    const route = zoneData.optimizedRoute;

    // A separate component to get the map instance and pass it up
    const MapInstanceProvider: React.FC = () => {
        const map = useMap();
        useEffect(() => {
            if (map && onMapReady) {
                onMapReady(map);
            }
        }, [map, onMapReady]);
        return null;
    }

    if (!route || route.length === 0) {
        return (
             <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                <p className="text-slate-500">No hay ruta para mostrar en el mapa.</p>
             </div>
        );
    }

    const eventPositions: LatLngTuple[] = route.map(event => [event.lat, event.lon]);
    const depotPosition: LatLngTuple = [zoneData.depot.lat, zoneData.depot.lon];
    const allPointsForBounds: LatLngBoundsExpression = [depotPosition, ...eventPositions];
    const centerPosition: LatLngTuple = eventPositions.length > 0 ? eventPositions[0] : depotPosition;
    
    return (
        <MapContainer center={centerPosition} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <MapInstanceProvider />
            <MapUpdater bounds={allPointsForBounds} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; OSRM'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {zoneData.routePolyline && zoneData.routePolyline.length > 0 && (
                <Polyline 
                    positions={zoneData.routePolyline} 
                    pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.8 }}
                />
            )}

            <Marker
                position={depotPosition}
                icon={createHomeIcon()}
                zIndexOffset={1000}
            >
                <Popup>
                    <div style={{ lineHeight: '1.5' }}>
                        <strong style={{ fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>
                            Depósito: {zoneData.depot.zoneName}
                        </strong>
                        <span>Inicio y Fin de la Ruta</span>
                    </div>
                </Popup>
            </Marker>

            {route.map((event, index) => (
                <Marker 
                    key={event._internal_id || `marker-${index}`} 
                    position={[event.lat, event.lon]}
                    icon={event.isCabinetEvent ? createCabinetIcon(index + 1) : createNumberedIcon(index + 1)}
                >
                    <Popup>
                        <div style={{ lineHeight: '1.5' }}>
                            <strong style={{ fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>
                                {index + 1}. {event.luminaireId}
                            </strong>
                            <span>ID OLC: {event.olcId || 'N/A'}</span><br/>
                            <span>Categoría: {translateCategory(event.category) || 'N/A'}</span><br/>
                            <span>Situación: {event.situation || 'N/A'}</span><br/>
                            <span>Potencia: {event.power}W</span><br/>
                            <span>Mensaje: {event.errorMessage || 'N/A'}</span><br/>
                            <span>Fecha: {event.reportedDate || 'N/A'}</span>
                        </div>
                    </Popup>
                </Marker>
            ))}
            
        </MapContainer>
    );
};
