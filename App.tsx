

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Header } from './components/Header';
import { FileUploadButton } from './components/FileUploadButton';
import { ZoneOptimizer } from './components/ZoneOptimizer';
import { SituationSummary } from './components/SituationSummary';
import { UploadIcon, CogIcon, CheckCircleIcon, InfoIcon, ArrowUturnLeftIcon, ExclamationTriangleIcon, ExportIcon, MagnifyingGlassIcon } from './components/icons';
import type { Zone, SystemEvent, Depot, Cabinet } from './types';
import { optimizeRouteLocally } from './services/localRouteOptimizer';
import { fetchRoutePolyline } from './services/routingService';
import { generateStandaloneHTML } from './services/htmlGenerator';

// --- DATOS FIJOS ---
const HARDCODED_DEPOTS: Depot[] = [
    { zoneName: 'Zona A', lat: -34.5281407, lon: -56.2734951 },
    { zoneName: 'Zona B', lat: -34.720164,  lon: -56.23157   },
    { zoneName: 'Zona B1', lat: -34.8400139, lon: -56.0039155 },
    { zoneName: 'Zona B2', lat: -34.7660652, lon: -55.7644965 },
    { zoneName: 'Zona B3', lat: -34.7621895, lon: -55.6433907 },
    { zoneName: 'Zona C', lat: -34.7064606, lon: -55.9566228 },
    { zoneName: 'Zona D', lat: -34.3389178, lon: -55.7686404 }
];

const HARDCODED_ZONE_MAPPING: { [key: string]: string } = {
    // Zona A
    'aguas corrientes': 'Zona A',
    'santa lucia': 'Zona A',
    'los cerrillos': 'Zona A',
    'juanico': 'Zona A',
    'canelones': 'Zona A',
    // Zona B
    'la paz': 'Zona B',
    'las piedras': 'Zona B',
    '18 de mayo': 'Zona B',
    'progreso': 'Zona B',
    // Zona B1
    'nicolich': 'Zona B1',
    'paso carrasco': 'Zona B1',
    'ciudad de la costa': 'Zona B1',
    // Zona B2
    'atlantida': 'Zona B2',
    'parque del plata': 'Zona B2',
    'salinas': 'Zona B2',
    // Zona B3
    'soca': 'Zona B3',
    'la floresta': 'Zona B3',
    // Zona C
    'pando': 'Zona C',
    'barros blancos': 'Zona C',
    'sauce': 'Zona C',
    'empalme olmos': 'Zona C',
    'toledo': 'Zona C',
    'del andaluz': 'Zona C',
    'suarez': 'Zona C',
    // Zona D
    'tala': 'Zona D',
    'san ramon': 'Zona D',
    'montes': 'Zona D',
    'migues': 'Zona D',
    'san antonio': 'Zona D',
    'santa rosa': 'Zona D',
    'san jacinto': 'Zona D',
    'san bautista': 'Zona D'
};
const CABINET_FAILURE_THRESHOLD = 10;
const MAX_EVENTS_PER_ROUTE = 10;
// --------------------

// --- HELPERS ---
interface Point {
    lat: number;
    lon: number;
}

const normalizeString = (str: string): string => {
    if (!str) return '';
    return str
        .trim()
        .toLowerCase()
        .normalize("NFD") // Decomposes combined characters into base characters and diacritics
        .replace(/[\u0300-\u036f]/g, ""); // Removes the diacritics
};


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

const isCohesiveGroup = (events: SystemEvent[], maxDistanceMeters: number): boolean => {
    if (events.length < 2) return true; // A single point is always cohesive.

    const distanceThresholdKm = maxDistanceMeters / 1000;
    const visited = new Set<string>();
    const stack: SystemEvent[] = [events[0]];
    if (events[0]._internal_id) {
      visited.add(events[0]._internal_id);
    }

    while (stack.length > 0) {
        const current = stack.pop()!;
        
        for (const neighbor of events) {
            if (neighbor._internal_id && !visited.has(neighbor._internal_id)) {
                if (getDistance(current, neighbor) <= distanceThresholdKm) {
                    visited.add(neighbor._internal_id);
                    stack.push(neighbor);
                }
            }
        }
    }

    // If the number of visited events is the same as the total number of events,
    // it means they are all part of a single connected component.
    return visited.size === events.length;
};


const parseReportedDate = (dateStr?: string | null): Date => {
    if (!dateStr) return new Date(0); // Treat missing dates as very old (epoch)
    
    // Handles formats like "dd/MM/yyyy HH:mm" or "dd/MM/yy HH:mm"
    const dateTimeRegex = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s(\d{1,2}):(\d{1,2})/;
    const match = String(dateStr).match(dateTimeRegex);
    
    if (match) {
        let [, day, month, year, hours, minutes] = match.map(Number);
        
        // Handle 2-digit years, assuming they are in the 21st century
        if (year >= 0 && year < 100) {
            year += 2000;
        }

        // new Date(year, monthIndex, day, ...) month is 0-indexed
        const date = new Date(year, month - 1, day, hours, minutes);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Fallback for other potential date formats that Date.parse can handle
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
        return new Date(parsed);
    }
    
    return new Date(0); // Return oldest date if parsing fails
};

const generateRouteFilename = (zoneData: Zone): string => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${day}_${month}_${year}`;

    const nameMatch = zoneData.name.match(/Hoja de Ruta (\d+)/);
    const routeNumber = nameMatch ? nameMatch[1] : 'N/A';
    
    if (zoneData.cabinetData) {
        const accountNumber = zoneData.cabinetData.accountNumber;
        return `HR_${routeNumber}_Posible_falla_en_Tablero_Cuenta_${accountNumber}_${dateString}`;
    }
    
    if (zoneData.name.includes('POSIBLE FALLA DE RAMAL/FASE')) {
        const accountMatch = zoneData.name.match(/Cuenta: (\w+)/);
        const accountNumber = accountMatch ? accountMatch[1] : 'SIN_CUENTA';
        return `HR_${routeNumber}_POSIBLE_FALLA_RAMAL_Cuenta_${accountNumber}_${dateString}`;
    }

    if (zoneData.isCabinetRoute) {
        const accountMatch = zoneData.name.match(/Cuenta: (\w+)/);
        const accountNumber = accountMatch ? accountMatch[1] : 'SIN_CUENTA';
        
        if (zoneData.name.includes('Evento de Voltaje')) {
            return `HR_${routeNumber}_Evento_de_Voltaje_Cuenta_${accountNumber}_${dateString}`;
        }
        if (zoneData.name.includes('Acumulación de fallas en un circuito')) {
            return `HR_${routeNumber}_Acumulacion_Fallas_Circuito_Cuenta_${accountNumber}_${dateString}`;
        }

        // Fallback just in case
        return `HR_${routeNumber}_Evento_de_Tablero_Cuenta_${accountNumber}_${dateString}`;
    } else {
        const zoneNameMatch = zoneData.name.match(/-\s*(.*?)(?:\s\(|$)/);
        const zoneName = zoneNameMatch ? zoneNameMatch[1].trim() : `Zona Desconocida`;
        const situationMatch = zoneData.name.match(/\((.*?)\)/);
        const situation = situationMatch ? `_${situationMatch[1].replace(/\s+/g, '_')}` : '';
        return `HR ${routeNumber} - ${zoneName}${situation} - ${dateString}`;
    }
};

const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        if (file.name.toLowerCase().endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(new Error(`Error al leer archivo CSV: ${err.message}`)),
            });
        } else if (file.name.toLowerCase().endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (!e.target?.result) throw new Error("No se pudo leer el contenido del archivo.");
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { dateNF: 'dd/MM/yyyy' });
                    resolve(json);
                } catch (err) {
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo.'));
            reader.readAsArrayBuffer(file);
        } else {
            reject(new Error('Formato de archivo no soportado. Use .csv o .xlsx'));
        }
    });
};

const findValue = (row: any, aliases: string[]): any | undefined => {
  if (!row) return undefined;
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const foundKey = rowKeys.find(key => key.toLowerCase().trim() === alias.toLowerCase());
    if (foundKey && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return row[foundKey];
    }
  }
  return undefined;
};

const formatShortDate = (dateValue: any): string | null => {
    if (!dateValue) return null;

    const date = new Date(dateValue);
    if (date instanceof Date && !isNaN(date.valueOf())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    
    return String(dateValue); // Fallback for values that aren't valid dates
};

const App: React.FC = () => {
  const [events, setEvents] = useState<SystemEvent[] | null>(null);
  const [localCabinets, setLocalCabinets] = useState<Cabinet[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [situationSummary, setSituationSummary] = useState<{situation: string; count: number}[]>([]);
  const [generationSummary, setGenerationSummary] = useState<{ total: number; byZone: Record<string, number>; byType: { cabinet: number; regular: number } } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isParsingCabinets, setIsParsingCabinets] = useState<boolean>(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [showFileInfo, setShowFileInfo] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<{ zoneId: string | null; status: 'idle' | 'found' | 'not-found' }>({ zoneId: null, status: 'idle' });
  const searchResultTimeoutRef = useRef<number | null>(null);

  const handleReset = useCallback(() => {
    setEvents(null);
    setLocalCabinets(null);
    setZones([]);
    setSituationSummary([]);
    setGenerationSummary(null);
    setError(null);
    setIsLoading(false);
    setStatusMessage('');
    setIsParsing(false);
    setIsParsingCabinets(false);
    setSelectedZone('all');
    setShowFileInfo(false);
    setSearchQuery('');
    setSearchResult({ zoneId: null, status: 'idle' });
    
    const eventsInput = document.getElementById('events-upload') as HTMLInputElement;
    if (eventsInput) eventsInput.value = '';
    const cabinetsInput = document.getElementById('cabinets-upload') as HTMLInputElement;
    if (cabinetsInput) cabinetsInput.value = '';
  }, []);

  const processEventsFile = async (file: File) => {
    setIsParsing(true);
    setError(null);
    setEvents(null);

    try {
        const jsonData = await parseFile(file);
        const nonEmptyRows = jsonData.filter((row: any) => row && Object.values(row).some(val => val !== null && val !== ''));
        const validatedData = nonEmptyRows.map((d: any, index: number): SystemEvent => {
          const luminaireId = String(findValue(d, ['Luminaire/ID externo', 'luminaireId', 'Streetlight/ID externo']) || `Evento-${index}`);
          const olcId = String(findValue(d, ['olcId', 'OLC/Dirección de hardware', 'OLC/DirecciÃ³n de hardware']) || '');
          const cabinetId = findValue(d, ['cabinetId', 'Cabinet/ID externo']);
          const powerStr = String(findValue(d, ['power', 'Luminaire type/Potencia nominal']) || '0');
          const category = String(findValue(d, ['category', 'Fault/Categoría', 'Fault/CategorÃ­a', 'Event monitor/Categoría', 'Evento/Categoría']) || '');
          const errorMessage = findValue(d, ['errorMessage', 'Fault/Mensaje de error', 'Event monitor/Mensaje de error', 'Evento/Mensaje de error']);
          const latStr = String(findValue(d, ['lat', 'Streetlight/Latitud', 'latitud']) || '0');
          const lonStr = String(findValue(d, ['lon', 'Streetlight/Longitud', 'longitud']) || '0');
          const zoneName = findValue(d, ['zoneName', 'zona']);
          const municipio = findValue(d, ['municipio', 'Streetlight/Municipio']);
          const rawReportedDate = findValue(d, ['fecha', 'fecha de reporte', 'fecha informada', 'Fault/Fecha de la primera ocurrencia', 'fault/informado por primera vez el', 'Event monitor/Informado por primera vez el', 'Evento/Fecha de la primera ocurrencia', 'evento/informado por primera vez el']);
          const nroCuenta = findValue(d, ['Streetlight/Nro_CUENTA', 'nro_cuenta', 'cuenta']);
          const situation = findValue(d, ['situacion', 'situación', 'Streetlight/Situación', 'Streetlight/SituaciÃ³n']);
          
          const reportedDate = formatShortDate(rawReportedDate);

          const lat = parseFloat(String(latStr).replace(',', '.'));
          const lon = parseFloat(String(lonStr).replace(',', '.'));
          const power = parseFloat(String(powerStr).replace(',', '.'));

          if (isNaN(lat) || isNaN(lon)) throw new Error(`Fila inválida (${luminaireId}): Latitud o Longitud no son números.`);

          return { 
              luminaireId, 
              olcId, 
              cabinetId: cabinetId !== undefined ? String(cabinetId) : null,
              power: isNaN(power) ? 0 : power, 
              category: String(category), 
              errorMessage: errorMessage !== undefined ? String(errorMessage) : null, 
              lat, 
              lon, 
              zoneName: zoneName !== undefined ? String(zoneName) : null, 
              municipio: municipio !== undefined ? String(municipio) : null, 
              reportedDate: reportedDate !== undefined ? reportedDate : null,
              situation: situation !== undefined ? String(situation) : null,
              nroCuenta: nroCuenta !== undefined ? String(nroCuenta) : null
          };
        });
        
        const excludedMunicipios = ['DESAFECTADOS', 'OBRA NUEVA'];
        const filteredData = validatedData.filter(event => {
            if (!event.municipio) {
                return true;
            }
            const municipioUpper = event.municipio.trim().toUpperCase();
            return !excludedMunicipios.includes(municipioUpper);
        });

        if (filteredData.length === 0) {
            throw new Error(`El archivo de eventos está vacío, no tiene el formato correcto, o todos los eventos fueron filtrados (ej. DESAFECTADOS, OBRA NUEVA).`);
        }
        setEvents(filteredData);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : `Ocurrió un error inesperado.`;
        setError(`Error al procesar el archivo de eventos: ${errorMessage}`);
        setEvents(null);
    } finally {
        setIsParsing(false);
    }
  };

  const processCabinetsFile = async (file: File) => {
    setIsParsingCabinets(true);
    setError(null);
    setLocalCabinets(null);

    try {
        const jsonData = await parseFile(file);
        const nonEmptyRows = jsonData.filter((row: any) => row && Object.values(row).some(val => val !== null && val !== ''));
        const validatedData = nonEmptyRows.map((d: any): Cabinet => {
            const accountNumber = String(findValue(d, ['Num_Cuenta', 'Nro_CUENTA', 'nro_cuenta', 'cuenta']) || '');
            const latStr = String(findValue(d, ['POINT_Y', 'lat', 'latitud']) || '0');
            const lonStr = String(findValue(d, ['POINT_X', 'lon', 'longitud']) || '0');
            const tarifa = findValue(d, ['tarifa']);
            const potContrat = findValue(d, ['potcontrat']);
            const direccion = findValue(d, ['direccion', 'dirección']);
            const tension = findValue(d, ['tension', 'tensión']);
            
            const lat = parseFloat(String(latStr).replace(',', '.'));
            const lon = parseFloat(String(lonStr).replace(',', '.'));

            if (!accountNumber) throw new Error('Fila de tablero inválida: Falta el Nro_CUENTA.');
            if (isNaN(lat) || isNaN(lon)) throw new Error(`Fila de tablero inválida (Cuenta: ${accountNumber}): Latitud o Longitud no son números.`);

            return { 
                accountNumber, 
                lat, 
                lon,
                tarifa: tarifa !== undefined ? String(tarifa) : null,
                potContrat: potContrat !== undefined ? String(potContrat) : null,
                direccion: direccion !== undefined ? String(direccion) : null,
                tension: tension !== undefined ? String(tension) : null
            };
        });

        if (validatedData.length === 0) {
            throw new Error(`El archivo de tableros está vacío o no tiene el formato correcto.`);
        }
        setLocalCabinets(validatedData);
    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : `Ocurrió un error inesperado.`;
        setError(`Error al procesar el archivo de tableros: ${errorMessage}`);
        setLocalCabinets(null);
    } finally {
        setIsParsingCabinets(false);
    }
  };
  
  const handleEventsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processEventsFile(file);
    }
  };

  const handleCabinetsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processCabinetsFile(file);
    }
  };

  const handleGenerateRoutes = useCallback(async (targetZoneName: string = 'all') => {
    if (!events) {
      setError("Por favor, cargue el listado de eventos para continuar.");
      return;
    }
    if (!localCabinets) {
      setError("Por favor, cargue el listado de servicios para continuar.");
      return;
    }
    
    setIsLoading(true);
    setStatusMessage('Generando hojas de ruta...');
    setError(null);
    setZones([]);
    setSituationSummary([]);
    setGenerationSummary(null);

    try {
        const depotMap = new Map<string, Depot>();
        HARDCODED_DEPOTS.forEach(depot => {
            depotMap.set(depot.zoneName.toUpperCase().trim(), depot);
        });

        const normalizedZoneMap = new Map<string, string>();
        for (const [municipio, zone] of Object.entries(HARDCODED_ZONE_MAPPING)) {
            normalizedZoneMap.set(normalizeString(municipio), zone);
        }

        const getEventZoneNameKey = (event: SystemEvent): string | undefined => {
            if (event.zoneName) {
                const normalizedEventZone = event.zoneName.toUpperCase().trim();
                if (depotMap.has(normalizedEventZone)) {
                    return normalizedEventZone;
                }
            }
            if (event.municipio) {
                const normalizedMunicipio = normalizeString(event.municipio.trim());
                const mappedZone = normalizedZoneMap.get(normalizedMunicipio);
                if (mappedZone && depotMap.has(mappedZone.toUpperCase().trim())) {
                    return mappedZone.toUpperCase().trim();
                }
            }
            return undefined;
        };
        
        const eventsWithIds = events.map((event, index) => ({
          ...event,
          _internal_id: event._internal_id || `event-${Date.now()}-${index}`
        }));
        
        let remainingEvents: SystemEvent[] = [...eventsWithIds];
        const cabinetRoutes: Zone[] = [];

        if (localCabinets) {
            const eventsByAccount = new Map<string, SystemEvent[]>();
            eventsWithIds.forEach(event => {
                if (event.nroCuenta) {
                    const account = event.nroCuenta.trim();
                    if (!eventsByAccount.has(account)) eventsByAccount.set(account, []);
                    eventsByAccount.get(account)!.push(event);
                }
            });
            
            const cabinetMap = new Map<string, Cabinet>();
            localCabinets.forEach(cab => cabinetMap.set(cab.accountNumber.trim(), cab));

            const cabinetRouteJobs: { priority: number; group: SystemEvent[]; accountNumber: string; }[] = [];
            
            for (const [accountNumber, group] of eventsByAccount.entries()) {
                const unreachableEvents = group.filter(e => normalizeString(e.category) === 'unreachable' || normalizeString(e.category) === 'inaccesible');
                const unreachableCount = unreachableEvents.length;

                if (unreachableCount >= CABINET_FAILURE_THRESHOLD) {
                    cabinetRouteJobs.push({ priority: 1, group, accountNumber });
                    continue;
                }

                if (unreachableCount >= 5 && unreachableCount < CABINET_FAILURE_THRESHOLD) {
                    if (isCohesiveGroup(unreachableEvents, 40)) {
                        cabinetRouteJobs.push({ priority: 1.5, group: unreachableEvents, accountNumber });
                        continue;
                    }
                }

                const voltageCount = group.filter(e => (normalizeString(e.errorMessage || '').includes('voltaje') || normalizeString(e.errorMessage || '').includes('voltage'))).length;
                if (voltageCount >= CABINET_FAILURE_THRESHOLD) {
                    cabinetRouteJobs.push({ priority: 2, group, accountNumber });
                    continue;
                }
                
                if (group.length >= CABINET_FAILURE_THRESHOLD) {
                    cabinetRouteJobs.push({ priority: 3, group, accountNumber });
                }
            }
            
            const processedEventIds = new Set<string>();

            const createCabinetRoutesForGroup = async (
                group: SystemEvent[], 
                priority: number, 
                nameTemplate: string,
                depot: Depot
            ) => {
                const routes: Zone[] = [];
                let partNumber = 1;
                const eventsToChunk = [...group];
                
                const chunkSize = priority === 3 ? 15 : MAX_EVENTS_PER_ROUTE;
                const totalParts = Math.ceil(group.length / chunkSize);

                while (eventsToChunk.length > 0) {
                    const chunk = eventsToChunk.splice(0, chunkSize);
                    const optimizedChunk = await optimizeRouteLocally(depot, chunk);
                    const polyline = await fetchRoutePolyline(depot, optimizedChunk);

                    const routeName = nameTemplate + (totalParts > 1 ? ` - Parte ${partNumber}` : '');
                    
                    routes.push({
                        id: '', 
                        name: routeName,
                        depot,
                        events: optimizedChunk,
                        optimizedRoute: optimizedChunk,
                        routePolyline: polyline,
                        isCabinetRoute: true,
                        priority,
                    });
                    partNumber++;
                }
                return routes;
            };

            for (const job of cabinetRouteJobs) {
                const firstEventInGroup = job.group[0];
                const cabinetInfo = cabinetMap.get(job.accountNumber.trim());
                let depotForCabinet: Depot | undefined;
                
                let assignedZoneKey = getEventZoneNameKey(firstEventInGroup);
                
                // Fallback: Find nearest depot based on cabinet's coordinates if zone is still unknown
                if (!assignedZoneKey && cabinetInfo) {
                    let minDistance = Infinity;
                    let nearestDepot: Depot | null = null;
                    
                    HARDCODED_DEPOTS.forEach(depot => {
                        const distance = getDistance(cabinetInfo, depot);
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestDepot = depot;
                        }
                    });

                    if (nearestDepot) {
                        assignedZoneKey = nearestDepot.zoneName.toUpperCase().trim();
                    }
                }
                
                if (assignedZoneKey) depotForCabinet = depotMap.get(assignedZoneKey);

                if (!depotForCabinet) {
                    console.warn(`No se pudo determinar un depósito para el evento del tablero de la cuenta ${job.accountNumber}.`);
                    continue; // Skip this job if no depot can be assigned
                }

                const belongsToTargetZone = targetZoneName === 'all' || depotForCabinet.zoneName === targetZoneName;
                if (!belongsToTargetZone) continue;
                
                job.group.forEach(e => { if (e._internal_id) processedEventIds.add(e._internal_id); });
                
                if (job.priority === 1) { // Special handling for MAX PRIORITY
                    if (!cabinetInfo) {
                        console.warn(`No se encontró información del tablero para la cuenta ${job.accountNumber}. Se omitirá la creación de la ruta de tablero.`);
                        continue;
                    }
                    
                    const optimizedGroup = await optimizeRouteLocally(depotForCabinet, job.group);
                    const polyline = await fetchRoutePolyline(depotForCabinet, optimizedGroup);

                    cabinetRoutes.push({
                        id: '',
                        name: `Posible falla en Tablero (${depotForCabinet.zoneName}) - Cuenta: ${job.accountNumber}`,
                        depot: depotForCabinet,
                        events: optimizedGroup,
                        optimizedRoute: optimizedGroup,
                        routePolyline: polyline,
                        isCabinetRoute: true,
                        priority: 1,
                        cabinetData: {
                            accountNumber: cabinetInfo.accountNumber,
                            lat: cabinetInfo.lat,
                            lon: cabinetInfo.lon,
                            direccion: cabinetInfo.direccion,
                            tension: cabinetInfo.tension,
                            tarifa: cabinetInfo.tarifa,
                            potContrat: cabinetInfo.potContrat,
                            affectedLuminaires: job.group,
                        }
                    });
                } else { // Priorities 1.5, 2 and 3 keep splitting logic
                    let name = '';
                    if (job.priority === 1.5) {
                        name = `POSIBLE FALLA DE RAMAL/FASE (${depotForCabinet.zoneName}) - Cuenta: ${job.accountNumber}`;
                    } else if (job.priority === 2) {
                        name = `Evento de Voltaje (${depotForCabinet.zoneName}) - Cuenta: ${job.accountNumber}`;
                    } else if (job.priority === 3) {
                        name = `Acumulación de fallas en un circuito (${depotForCabinet.zoneName}) - Cuenta: ${job.accountNumber}`;
                    }

                    const newRoutes = await createCabinetRoutesForGroup(job.group, job.priority, name, depotForCabinet);
                    cabinetRoutes.push(...newRoutes);
                }
            }

            if (processedEventIds.size > 0) {
                remainingEvents = eventsWithIds.filter(f => !f._internal_id || !processedEventIds.has(f._internal_id));
            }
        }
        
        const eventsForSummaryAndRegularRoutes = targetZoneName === 'all' 
            ? remainingEvents
            : remainingEvents.filter(event => {
                const zoneKey = getEventZoneNameKey(event);
                if (!zoneKey) return false;
                const depot = depotMap.get(zoneKey);
                return depot?.zoneName === targetZoneName;
            });
        
        const situationSummaryCounts = new Map<string, number>();
        const eventsBySituation: Record<string, SystemEvent[]> = {};
        const regularEvents: SystemEvent[] = [];

        eventsForSummaryAndRegularRoutes.forEach(event => {
            const situation = event.situation?.trim();
            if (situation && situation !== 'N/A' && situation !== '-') {
                if (!eventsBySituation[situation]) {
                    eventsBySituation[situation] = [];
                }
                eventsBySituation[situation].push(event);
                situationSummaryCounts.set(situation, (situationSummaryCounts.get(situation) || 0) + 1);
            } else {
                regularEvents.push(event);
            }
        });

        const situationSummaryData = Array.from(situationSummaryCounts.entries())
            .map(([situation, count]) => ({ situation, count }))
            .sort((a, b) => b.count - a.count);
        setSituationSummary(situationSummaryData);

        const allNonCabinetRoutes: Zone[] = [];
        
        const processEventListIntoRoutes = async (eventList: SystemEvent[]): Promise<Partial<Zone>[]> => {
            const routes: Partial<Zone>[] = [];
            const zonesData: { [key: string]: { depot: Depot; eventsByMunicipio: { [key: string]: { displayName: string, events: SystemEvent[] } } } } = {};
            
            depotMap.forEach((depot, normalizedZoneName) => {
                zonesData[normalizedZoneName] = { depot, eventsByMunicipio: {} };
            });

            eventList.forEach((event) => {
                const assignedZoneKey = getEventZoneNameKey(event);
                if (assignedZoneKey) {
                    const municipioKey = normalizeString(event.municipio || 'Sin Municipio Asignado');
                    if (!zonesData[assignedZoneKey].eventsByMunicipio[municipioKey]) {
                        zonesData[assignedZoneKey].eventsByMunicipio[municipioKey] = {
                            displayName: event.municipio || 'Sin Municipio Asignado',
                            events: []
                        };
                    }
                    zonesData[assignedZoneKey].eventsByMunicipio[municipioKey].events.push(event);
                }
            });

            for (const zoneNameKey of Object.keys(zonesData)) {
                const zoneInfo = zonesData[zoneNameKey];
                const { depot, eventsByMunicipio } = zoneInfo;

                for (const municipioKey of Object.keys(eventsByMunicipio)) {
                    let unassignedEvents = [...eventsByMunicipio[municipioKey].events];
                    const municipioDisplayName = eventsByMunicipio[municipioKey].displayName;

                    if (unassignedEvents.length === 0) continue;
                    
                    while (unassignedEvents.length > 0) {
                        const chunk: SystemEvent[] = [];
                        const sortedByDate = unassignedEvents.sort((a, b) => parseReportedDate(a.reportedDate).getTime() - parseReportedDate(b.reportedDate).getTime());
                        let currentEvent = sortedByDate[0];
                        chunk.push(currentEvent);
                        unassignedEvents = unassignedEvents.filter(f => f._internal_id !== currentEvent._internal_id);

                        while (chunk.length < MAX_EVENTS_PER_ROUTE && unassignedEvents.length > 0) {
                            let nearestIndex = -1;
                            let minDistance = Infinity;
                            unassignedEvents.forEach((event, index) => {
                                const distance = getDistance(currentEvent, event);
                                if (distance < minDistance) {
                                    minDistance = distance;
                                    nearestIndex = index;
                                }
                            });

                            if (nearestIndex !== -1) {
                                const nearestEvent = unassignedEvents.splice(nearestIndex, 1)[0];
                                chunk.push(nearestEvent);
                                currentEvent = nearestEvent;
                            } else {
                                break;
                            }
                        }

                        const optimizedChunk = await optimizeRouteLocally(depot, chunk);
                        const polyline = await fetchRoutePolyline(depot, chunk);
                        
                        routes.push({
                            name: `${depot.zoneName} - ${municipioDisplayName}`,
                            depot: depot,
                            events: optimizedChunk, 
                            optimizedRoute: optimizedChunk, 
                            routePolyline: polyline,
                        });
                    }
                }
            }
            return routes;
        };
        
        const regularRoutesPartials = await processEventListIntoRoutes(regularEvents);
        allNonCabinetRoutes.push(...regularRoutesPartials.map(r => ({ ...r, isCabinetRoute: false, priority: 4, id: '' } as Zone)));

        for (const situation in eventsBySituation) {
            const situationRoutesPartials = await processEventListIntoRoutes(eventsBySituation[situation]);
            allNonCabinetRoutes.push(...situationRoutesPartials.map(r => ({ ...r, isCabinetRoute: false, priority: 5, situation, id: '' } as Zone)));
        }
        
        const allRoutes = [...cabinetRoutes, ...allNonCabinetRoutes].filter(r => {
             const belongsToTargetZone = targetZoneName === 'all' || r.depot.zoneName === targetZoneName;
             return belongsToTargetZone;
        });
        
        if (allRoutes.length === 0) {
          setError("No se encontraron eventos para procesar en la zona seleccionada. Verifique que los municipios en su archivo coincidan con la configuración interna.");
          setIsLoading(false);
          return;
        }

        const routesByZone = allRoutes.reduce((acc, route) => {
            const zoneName = route.depot.zoneName;
            if (!acc[zoneName]) {
                acc[zoneName] = [];
            }
            acc[zoneName].push(route);
            return acc;
        }, {} as Record<string, Zone[]>);

        const finalZones: Zone[] = [];
        const summary = {
            total: 0,
            byZone: {} as Record<string, number>,
            byType: { cabinet: 0, regular: 0 }
        };
        
        const sortedZoneNames = Object.keys(routesByZone).sort((a, b) => a.localeCompare(b));

        for (const zoneName of sortedZoneNames) {
            const zoneRoutes = routesByZone[zoneName];
            
            zoneRoutes.sort((a, b) => {
                const priorityA = a.priority ?? 99;
                const priorityB = b.priority ?? 99;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
            });

            zoneRoutes.forEach((zone, index) => {
                const baseName = zone.name;
                const finalName = `Hoja de Ruta ${index + 1} - ${baseName}${zone.situation ? ` (${zone.situation})` : ''}`;
                
                finalZones.push({
                    ...zone,
                    id: `zone-${Date.now()}-${zoneName.replace(/\s+/g, '-')}-${index}`,
                    name: finalName,
                });

                summary.total++;
                summary.byZone[zoneName] = (summary.byZone[zoneName] || 0) + 1;
                if (zone.isCabinetRoute) {
                    summary.byType.cabinet++;
                } else {
                    summary.byType.regular++;
                }
            });
        }
        setGenerationSummary(summary);
        setZones(finalZones);
       
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido al generar las rutas.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  }, [events, localCabinets]);

  const handleBulkDownload = async () => {
    if (zones.length === 0 || isBulkDownloading) return;
    setIsBulkDownloading(true);
    setError(null);
    try {
        const zip = new JSZip();
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const dateStringForZip = `${day}-${month}-${year}`;

        for (const zoneData of zones) {
            const htmlContent = generateStandaloneHTML(zoneData);
            const filename = `${generateRouteFilename(zoneData)}.html`;
            zip.file(filename, htmlContent);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: "DEFLATE" });
        
        const zipFilename = `Hojas_de_Ruta_${dateStringForZip}.zip`;

        const url = URL.createObjectURL(zipBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("Error durante la descarga masiva en ZIP:", error);
        setError("Ocurrió un error al intentar generar el archivo ZIP.");
    } finally {
        setIsBulkDownloading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchResultTimeoutRef.current) {
        clearTimeout(searchResultTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
        setSearchResult({ zoneId: null, status: 'idle' });
        return;
    }

    const query = searchQuery.trim().toLowerCase();
    let foundZoneId: string | null = null;

    for (const zone of zones) {
        const foundEvent = zone.events.find(event => 
            String(event.luminaireId).toLowerCase() === query || 
            String(event.olcId).toLowerCase() === query
        );
        if (foundEvent) {
            foundZoneId = zone.id;
            break;
        }
    }

    if (foundZoneId) {
        setSearchResult({ zoneId: foundZoneId, status: 'found' });
        const element = document.getElementById(foundZoneId);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        searchResultTimeoutRef.current = window.setTimeout(() => {
            setSearchResult({ zoneId: null, status: 'idle' });
        }, 4000);
    } else {
        setSearchResult({ zoneId: null, status: 'not-found' });
         searchResultTimeoutRef.current = window.setTimeout(() => {
            setSearchResult({ zoneId: null, status: 'idle' });
        }, 4000);
    }
  };

  useEffect(() => {
    return () => {
        if (searchResultTimeoutRef.current) {
            clearTimeout(searchResultTimeoutRef.current);
        }
    };
  }, []);

  const canGenerate = events !== null && localCabinets !== null;

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <main className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-8">
          <div>
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">1. Cargar Archivos</h2>
                {(events !== null || localCabinets !== null) && (
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        title="Empezar de nuevo con otros archivos"
                    >
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                        Empezar de Nuevo
                    </button>
                )}
            </div>
            <div className="flex justify-between items-center mt-1">
                <p className="text-slate-500">
                    Cargue el listado de eventos y el de servicios/tableros para generar las rutas.
                </p>
                <button
                    onClick={() => setShowFileInfo(!showFileInfo)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md p-2 transition-colors flex-shrink-0"
                    title="Mostrar/ocultar información sobre formatos de archivo"
                >
                    <InfoIcon className="h-5 w-5" />
                    <span className="hidden sm:inline">{showFileInfo ? 'Ocultar Información' : 'Formato de Archivos'}</span>
                </button>
            </div>
            
            {showFileInfo && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
                  <h4 className="flex items-center text-sm font-semibold text-blue-800">
                      <InfoIcon className="h-5 w-5 mr-2" />
                      Información sobre los Archivos
                  </h4>
                  <div className="mt-2 text-xs text-blue-700 space-y-3">
                      <div>
                          <p className="font-bold">Archivo de Eventos (Requerido):</p>
                          <p>Debe ser un archivo <strong>.csv</strong> o <strong>.xlsx</strong>. El sistema es flexible y busca columnas con nombres comunes. A continuación los campos más importantes y sus posibles nombres en el archivo:</p>
                          <ul className="list-disc pl-5 mt-1 space-y-0.5">
                              <li><strong>ID de Luminaria:</strong> <code>Luminaire/ID externo</code>, <code>Streetlight/ID externo</code></li>
                              <li><strong>Latitud:</strong> <code>Streetlight/Latitud</code>, <code>lat</code>, <code>latitud</code></li>
                              <li><strong>Longitud:</strong> <code>Streetlight/Longitud</code>, <code>lon</code>, <code>longitud</code></li>
                              <li><strong>Fecha de Reporte:</strong> <code>Event monitor/Informado por primera vez el</code>, <code>Fault/Fecha de la primera ocurrencia</code></li>
                              <li><strong>Categoría de Evento:</strong> <code>Event monitor/Categoría</code>, <code>Fault/Categoría</code>, <code>Evento/Categoría</code></li>
                              <li><strong>Municipio:</strong> <code>Streetlight/Municipio</code> (para asignación de zona)</li>
                              <li><strong>Nro. de Cuenta:</strong> <code>Streetlight/Nro_CUENTA</code> (para detectar eventos de tablero)</li>
                              <li><strong>Situación:</strong> <code>Streetlight/Situación</code> (para detalles adicionales)</li>
                          </ul>
                      </div>
                       <div>
                          <p className="font-bold">Archivo de Tableros / Servicios (Requerido):</p>
                          <p>Debe ser <strong>.csv</strong> o <strong>.xlsx</strong>. Usado para identificar la ubicación de eventos masivos. Columnas requeridas:</p>
                          <ul className="list-disc pl-5 mt-1 space-y-0.5">
                              <li><strong>Nro. de Cuenta:</strong> <code>Num_Cuenta</code>, <code>Nro_CUENTA</code>, <code>nro_cuenta</code></li>
                              <li><strong>Latitud:</strong> <code>POINT_Y</code>, <code>lat</code>, <code>latitud</code></li>
                              <li><strong>Longitud:</strong> <code>POINT_X</code>, <code>lon</code>, <code>longitud</code></li>
                              <li><strong>Datos Adicionales:</strong> <code>Direccion</code>, <code>Tarifa</code>, <code>PotContrat</code>, <code>TENSION</code></li>
                          </ul>
                      </div>
                  </div>
              </div>
            )}

            <div className="mt-4 flex flex-col md:flex-row gap-4 justify-center">
                <div className="w-full md:w-1/2">
                    <FileUploadButton 
                        label="Cargar Listado de Eventos" 
                        onFileChange={handleEventsFileChange}
                        isLoaded={events !== null}
                        isLoading={isParsing}
                        icon={<UploadIcon />}
                        id="events-upload"
                    />
                </div>
                 <div className="w-full md:w-1/2">
                    <FileUploadButton 
                        label="Cargar Listado de Servicios" 
                        onFileChange={handleCabinetsFileChange}
                        isLoaded={localCabinets !== null}
                        isLoading={isParsingCabinets}
                        icon={<UploadIcon />}
                        id="cabinets-upload"
                    />
                </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-800">2. Generar Hojas de Ruta</h2>
            <p className="text-slate-500 mt-1">Seleccione una zona (o todas) y genere las hojas de ruta.</p>
            <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
               <select
                id="zone-select"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                disabled={isLoading || isParsing || isParsingCabinets}
                className="block w-full md:w-auto md:flex-grow px-3 py-3 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                aria-label="Seleccionar zona para generar rutas"
              >
                <option value="all">Todas las Zonas</option>
                {HARDCODED_DEPOTS.map(d => <option key={d.zoneName} value={d.zoneName}>{d.zoneName}</option>)}
              </select>
              <button
                onClick={() => handleGenerateRoutes(selectedZone)}
                disabled={!canGenerate || isLoading || isParsing || isParsingCabinets}
                className="w-full md:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                {isLoading ? (
                  <>
                    <CogIcon className="animate-spin h-5 w-5" />
                    {statusMessage || 'Procesando...'}
                  </>
                ) : (
                  <>
                    <CogIcon className="h-5 w-5" />
                    Generar Hojas de Ruta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="max-w-7xl mx-auto mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && zones.length > 0 && (
          <div className="max-w-7xl mx-auto mt-8">
            {generationSummary && (
                <div className="mb-6 p-6 bg-white rounded-xl shadow-lg border border-slate-200 animate-fade-in">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Resumen de Generación</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Total de Hojas de Ruta</p>
                    <p className="text-4xl font-bold text-indigo-600 mt-1">{generationSummary.total}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-500 uppercase text-center mb-2">Detalle por Tipo</p>
                    <div className="space-y-1 text-center">
                        <p className="text-sm"><span className="font-bold text-slate-700 text-base">{generationSummary.byType.cabinet}</span> Rutas de Tablero</p>
                        <p className="text-sm"><span className="font-bold text-slate-700 text-base">{generationSummary.byType.regular}</span> Rutas Regulares</p>
                    </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-500 uppercase text-center mb-2">Detalle por Zona</p>
                    <ul className="space-y-1 text-center text-sm">
                        {Object.entries(generationSummary.byZone).sort(([zoneA], [zoneB]) => zoneA.localeCompare(zoneB)).map(([zone, count]) => (
                        <li key={zone}>
                            <span className="font-semibold">{zone}:</span> <span className="font-bold text-slate-700">{count}</span>
                        </li>
                        ))}
                    </ul>
                    </div>
                </div>
                </div>
            )}

             {(() => {
                const cabinetRoutes = zones.filter(z => z.priority && z.priority < 4);
                if (cabinetRoutes.length > 0) {
                  return (
                    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 rounded-md mb-6 flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">¡Alerta! Se detectaron {cabinetRoutes.length} hoja(s) de ruta crítica(s) de tablero.</p>
                        <p>Se han generado hojas de ruta prioritarias para estos casos, que se muestran primero en la lista.</p>
                      </div>
                    </div>
                  );
                }
                return null;
             })()}

            
            {situationSummary.length > 0 && (
                <SituationSummary 
                    summary={situationSummary} 
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <form onSubmit={handleSearch} className="w-full md:w-auto md:flex-grow">
                <div className="relative">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (searchResult.status !== 'idle') {
                            setSearchResult({ zoneId: null, status: 'idle' });
                        }
                    }}
                    placeholder="Buscar por ID de Luminaria u OLC..."
                    className="block w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
                 {searchResult.status === 'not-found' && (
                    <p className="mt-2 text-sm text-red-600 animate-fade-in">No se encontró la luminaria u OLC.</p>
                 )}
              </form>
              <div className="w-full md:w-auto flex flex-col-reverse md:flex-row gap-4 items-center">
                <button
                    onClick={handleBulkDownload}
                    disabled={isBulkDownloading}
                    className="w-full md:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                    {isBulkDownloading ? (
                        <>
                            <CogIcon className="animate-spin h-5 w-5" />
                            Descargando...
                        </>
                    ) : (
                        <>
                            <ExportIcon className="h-5 w-5" />
                            Descargar Todos los HTML
                        </>
                    )}
                </button>
              </div>
            </div>

            <div className="space-y-8">
              {zones.map(zone => (
                <ZoneOptimizer key={zone.id} zoneData={zone} isHighlighted={searchResult.zoneId === zone.id} searchQuery={searchQuery} />
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;