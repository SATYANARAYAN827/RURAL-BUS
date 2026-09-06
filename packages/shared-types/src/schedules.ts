export type TripStatus =
  | 'SCHEDULED'
  | 'BOARDING'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DELAYED';

export interface Schedule {
  id: string;
  tenantId: string;
  routeId: string;
  departureTime: string; // HH:mm:ss
  arrivalTime: string; // HH:mm:ss
  daysOfWeek: number[]; // [0,1,2,3,4,5,6] (0=Sun)
  baseFare: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  routeId: string;
  departureTime: string; // HH:mm or HH:mm:ss
  arrivalTime: string; // HH:mm or HH:mm:ss
  daysOfWeek: number[];
  baseFare: number;
}

export interface UpdateScheduleInput {
  departureTime?: string;
  arrivalTime?: string;
  daysOfWeek?: number[];
  baseFare?: number;
  isActive?: boolean;
}

export interface ScheduleListResponse {
  schedules: Schedule[];
  total: number;
}

export interface Trip {
  id: string;
  tenantId: string;
  routeId: string;
  busId: string;
  driverId: string | null;
  conductorId: string | null;
  departureTime: string;
  scheduledArrival: string;
  actualDeparture?: string | null;
  actualArrival?: string | null;
  status: TripStatus;
  availableSeats: number;
  totalSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripWithDetails extends Trip {
  routeCode: string;
  origin: string;
  destination: string;
  busRegistrationNumber: string;
  busModel: string;
  driverName?: string | null;
  driverPhone?: string | null;
  conductorName?: string | null;
  conductorPhone?: string | null;
}

export interface DispatchTripInput {
  routeId: string;
  busId: string;
  driverId?: string;
  conductorId?: string;
  departureTime: string; // ISO String
  scheduledArrival: string; // ISO String
}

export interface UpdateTripStatusInput {
  status: TripStatus;
}

export interface TripListResponse {
  trips: TripWithDetails[];
  total: number;
  scheduledCount: number;
  inTransitCount: number;
  completedCount: number;
}
