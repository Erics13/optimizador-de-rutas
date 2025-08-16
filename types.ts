
export interface SystemEvent {
  luminaireId: string;
  olcId: string;
  cabinetId?: string;
  power: number;
  category: string;
  errorMessage?: string;
  lat: number;
  lon: number;
  zoneName?: string;
  municipio?: string;
  reportedDate?: string;
  situation?: string;
  _internal_id?: string;
  // Added for cabinet event feature
  nroCuenta?: string;
  isCabinetEvent?: boolean;
  affectedEventsCount?: number;
  affectedEvents?: SystemEvent[];
  // New fields for cabinet data
  tarifa?: string;
  potContrat?: string;
  direccion?: string;
  tension?: string;
}

export interface Depot {
  zoneName: string;
  lat: number;
  lon: number;
}

export interface CabinetSummary {
    accountNumber: string;
    lat: number;
    lon: number;
    direccion?: string;
    tension?: string;
    tarifa?: string;
    potContrat?: string;
    affectedLuminaires: SystemEvent[];
}

export interface Zone {
  id: string;
  name: string;
  depot: Depot;
  events: SystemEvent[];
  optimizedRoute?: SystemEvent[];
  routePolyline?: [number, number][];
  isCabinetRoute?: boolean;
  priority?: number;
  cabinetData?: CabinetSummary;
}

// Added for cabinet failure feature
export interface Cabinet {
    accountNumber: string;
    lat: number;
    lon: number;
    // New fields
    tarifa?: string;
    potContrat?: string;
    direccion?: string;
    tension?: string;
}
