

export interface SystemEvent {
  luminaireId: string;
  olcId: string;
  cabinetId?: string | null;
  power: number;
  category: string;
  errorMessage?: string | null;
  lat: number;
  lon: number;
  zoneName?: string | null;
  municipio?: string | null;
  reportedDate?: string | null;
  situation?: string | null;
  _internal_id?: string;
  // Added for cabinet event feature
  nroCuenta?: string | null;
  isCabinetEvent?: boolean;
  affectedEventsCount?: number;
  affectedEvents?: SystemEvent[];
  // New fields for cabinet data
  tarifa?: string | null;
  potContrat?: string | null;
  direccion?: string | null;
  tension?: string | null;
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
    direccion?: string | null;
    tension?: string | null;
    tarifa?: string | null;
    potContrat?: string | null;
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
  situation?: string | null;
}

// Added for cabinet failure feature
export interface Cabinet {
    accountNumber: string;
    lat: number;
    lon: number;
    // New fields
    tarifa?: string | null;
    potContrat?: string | null;
    direccion?: string | null;
    tension?: string | null;
}