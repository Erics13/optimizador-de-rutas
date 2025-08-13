
import type { SystemEvent, Depot } from '../types';

export const generateOptimizedRoute = async (depot: Depot, events: SystemEvent[]): Promise<SystemEvent[]> => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  if (events.length === 0) {
    return [];
  }

  // The events array already contains the unique _internal_id from App.tsx.
  // We just need to create a map for easy lookup after getting the API response.
  const eventMap = new Map(events.map(e => [e._internal_id!, e]));

  const systemInstruction = `You are an expert in logistics and route optimization for public lighting maintenance crews. Your task is to solve the Traveling Salesperson Problem (TSP).
You will be given a depot location and a list of events to visit. Each event corresponds to a luminaire that needs maintenance, and has a unique "_internal_id" and its coordinates.
Find the most efficient route that starts at the depot, visits every luminaire location once, and returns to the depot.
The output MUST be a JSON object containing a single key "route". 
This key must hold an array of objects, where each object contains ONLY the "_internal_id" of the luminaire, sorted in the optimal visiting order.
Example format: { "route": [ { "_internal_id": "event-162-0" }, { "_internal_id": "event-162-1" } ] }
Do not include the depot in the returned "route" array. Do not add any other keys or text. The response must be strictly the JSON object.`;

  const prompt = `
    Depot Location: ${JSON.stringify({ lat: depot.lat, lon: depot.lon })}
    
    List of Events to Visit: ${JSON.stringify(events.map(e => ({ _internal_id: e._internal_id, lat: e.lat, lon: e.lon })))}
    
    Please provide the optimized route as a JSON object with the "_internal_id" for each stop.
  `;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr);

    if (parsedData && Array.isArray(parsedData.route)) {
        const orderedEvents: SystemEvent[] = parsedData.route
            .map((item: { _internal_id: string }) => {
                if (!item || typeof item._internal_id === 'undefined') {
                    console.warn("API response contains a route item without an _internal_id.", item);
                    return undefined;
                }
                const event = eventMap.get(item._internal_id);
                if (!event) {
                    console.warn(`API response returned an unknown _internal_id: ${item._internal_id}`);
                }
                return event;
            })
            .filter((item: SystemEvent | undefined): item is SystemEvent => item !== undefined);
        
        if (orderedEvents.length !== events.length) {
            console.warn("La ruta optimizada no contiene todos los eventos originales. Devolviendo la lista sin ordenar.");
            return events;
        }
        
        return orderedEvents;
    } else {
        console.error("La respuesta de la API no tenía el formato esperado:", parsedData);
        throw new Error("Respuesta de la API con formato incorrecto.");
    }

  } catch (error) {
    console.error("Error al llamar a la API de Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error("La clave de API de Gemini no es válida o ha caducado.");
        }
        if (error.message.toLowerCase().includes('quota exceeded')) {
          throw new Error("Límite de cuota de la API excedido. Ha alcanzado el límite diario de solicitudes para este modelo. Por favor, intente de nuevo mañana o revise su plan de uso en Google AI Platform.");
        }
    }
    throw new Error("No se pudo generar la ruta optimizada. Verifique la consola para más detalles.");
  }
};
