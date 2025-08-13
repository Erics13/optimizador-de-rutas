
import type { SystemEvent, Depot } from '../types';

interface Point {
    lat: number;
    lon: number;
}

const deg2rad = (deg: number): number => deg * (Math.PI / 180);

const getDistance = (p1: Point, p2: Point): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(p2.lat - p1.lat);
  const dLon = deg2rad(p2.lon - p1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(p1.lat)) * Math.cos(deg2rad(p2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};


/**
 * Optimizes a route using the Nearest Neighbor heuristic.
 * This function is designed to replace an external API call for solving the TSP.
 * It's efficient for small numbers of points (e.g., < 15-20).
 * @param depot The starting and ending point of the route.
 * @param events The list of events (stops) to visit.
 * @returns A promise that resolves to an ordered list of events representing the optimized route.
 */
export const optimizeRouteLocally = async (depot: Depot, events: SystemEvent[]): Promise<SystemEvent[]> => {
    return new Promise((resolve) => {
        if (!events || events.length === 0) {
            resolve([]);
            return;
        }

        // If there's only one event, no need to optimize.
        if (events.length === 1) {
            resolve(events);
            return;
        }

        const orderedRoute: SystemEvent[] = [];
        const unvisitedEvents = [...events];
        
        let currentLocation: Point = depot;

        while (unvisitedEvents.length > 0) {
            let nearestEventIndex = -1;
            let minDistance = Infinity;

            unvisitedEvents.forEach((event, index) => {
                const distance = getDistance(currentLocation, event);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEventIndex = index;
                }
            });

            const nearestEvent = unvisitedEvents.splice(nearestEventIndex, 1)[0];
            orderedRoute.push(nearestEvent);
            currentLocation = nearestEvent;
        }

        resolve(orderedRoute);
    });
};