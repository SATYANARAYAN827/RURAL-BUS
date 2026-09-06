import type { TripStatus } from './schedules.js';
import type { SeatingType } from './fleet.js';

export interface RouteStopDutyInfo {
  stopId: string;
  stopName: string;
  sequenceNumber: number;
  distanceFromStartKm: number;
  estimatedMinutesFromStart: number;
  latitude: number;
  longitude: number;
}

export interface DriverDutyTrip {
  id: string;
  routeId: string;
  routeCode: string;
  origin: string;
  destination: string;
  busId: string;
  busRegistrationNumber: string;
  busModel: string;
  totalSeats: number;
  seatingType: SeatingType;
  conductorId: string | null;
  conductorName?: string | null;
  conductorPhone?: string | null;
  departureTime: string;
  scheduledArrival: string;
  actualDeparture: string | null;
  actualArrival: string | null;
  status: TripStatus;
  availableSeats: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  stops: RouteStopDutyInfo[];
}

export interface DriverDutyResponse {
  activeTrip: DriverDutyTrip | null;
  upcomingTrips: DriverDutyTrip[];
}

export interface DriverHistoryTrip {
  id: string;
  routeCode: string;
  origin: string;
  destination: string;
  busRegistrationNumber: string;
  actualDeparture: string | null;
  actualArrival: string | null;
  totalDistanceKm: number;
  status: TripStatus;
}

export interface DriverHistoryResponse {
  trips: DriverHistoryTrip[];
  totalCompleted: number;
  totalDistanceDrivenKm: number;
}

export interface ManifestPassengerEntry {
  ticketId: string;
  bookingId: string;
  ticketNumber: string;
  seatNumber: string;
  passengerName: string;
  passengerPhone: string | null;
  fromStopName: string;
  toStopName: string;
  fare: number;
  isBoarded: boolean;
  status: 'CONFIRMED' | 'BOARDED' | 'CANCELLED';
}

export interface ConductorDutyResponse {
  activeTrip: DriverDutyTrip | null;
  totalBookedSeats: number;
  totalBoardedSeats: number;
  totalAwaitingSeats: number;
  totalSeats: number;
}

export interface ConductorManifestResponse {
  tripId: string;
  routeCode: string;
  origin: string;
  destination: string;
  busRegistrationNumber: string;
  totalSeats: number;
  totalBookedSeats: number;
  totalBoardedSeats: number;
  totalAwaitingSeats: number;
  passengers: ManifestPassengerEntry[];
}

export interface ConductorStatsResponse {
  totalTripsHandled: number;
  totalPassengersBoarded: number;
  totalShiftCollections: number;
}
