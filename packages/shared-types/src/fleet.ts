export type BusStatus = 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export type SeatingType = 'SEATER_2X2' | 'SEATER_3X2' | 'SLEEPER' | 'SEMI_SLEEPER';

export interface Bus {
  id: string;
  tenantId: string;
  operatorName?: string;
  registrationNumber: string;
  model: string;
  totalSeats: number;
  seatingType: SeatingType;
  status: BusStatus;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusInput {
  tenantId: string;
  registrationNumber: string;
  model: string;
  totalSeats: number;
  status?: BusStatus;
  seatingType?: SeatingType;
  amenities?: string[];
}

export interface UpdateBusInput {
  tenantId?: string;
  registrationNumber?: string;
  model?: string;
  totalSeats?: number;
  seatingType?: SeatingType;
  status?: BusStatus;
  amenities?: string[];
}

export interface BusListResponse {
  buses: Bus[];
  total: number;
  activeCount: number;
  maintenanceCount: number;
}

export interface DriverProfile {
  id: string;
  userId: string;
  tenantId: string;
  licenseNumber: string;
  licenseExpiry: string;
  isActive: boolean;
}

export interface ConductorProfile {
  id: string;
  userId: string;
  tenantId: string;
  employeeCode: string;
  isActive: boolean;
}
