
import type { SystemEvent, Depot } from '../types';

/**
 * Decodes a polyline string into an array of [lat, lng] coordinates.
 * Sourced from the standard polyline algorithm implementation.
 * @param str The encoded polyline string.
 * @param precision The precision of the encoding.
 * @returns An array of [latitude, longitude] tuples.
 */
function decodePolyline(str: string, precision: number = 5): [number, number][] {
  let index = 0,
      lat = 0,
      lng = 0,
      coordinates: [number, number][] = [],
      shift = 0,
      result = 0,
      byte = null,
      latitude_change,
      longitude_change,
      factor = Math.pow(10, precision);

  while (index < str.length) {
    byte = null;
    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change;
    lng += longitude_change;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
};

/**
 * Fetches a route polyline from the OSRM demo server.
 * @param depot The starting and ending point.
 * @param route The ordered list of events to visit.
 * @returns A promise that resolves to an array of [lat, lon] tuples for the map polyline.
 */
export const fetchRoutePolyline = async (depot: Depot, route: SystemEvent[]): Promise<[number, number][]> => {
    if (!route || route.length === 0) {
        return [];
    }

    // OSRM expects coordinates as `lon,lat`
    const points = [depot, ...route, depot];
    const coordinatesString = points.map(p => `${p.lon},${p.lat}`).join(';');
    
    // Using OSRM's public demo server. For production, a dedicated instance is recommended.
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=polyline`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`OSRM API error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`OSRM API error: ${response.status}`);
        }
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const encodedPolyline = data.routes[0].geometry;
            return decodePolyline(encodedPolyline);
        } else {
            console.warn('OSRM could not find a route:', data.message || data.code);
            return [];
        }
    } catch (error) {
        console.error('Error fetching route from OSRM:', error);
        // Return empty array to allow the app to function without the polyline
        return [];
    }
};
