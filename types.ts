
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
}

export interface Depot {
  zoneName: string;
  lat: number;
  lon: number;
}

export interface Zone {
  name: string;
  depot: Depot;
  events: SystemEvent[];
  optimizedRoute?: SystemEvent[];
  routePolyline?: [number, number][];
}

// Added for cabinet failure feature
export interface Cabinet {
    accountNumber: string;
    lat: number;
    lon: number;
}
