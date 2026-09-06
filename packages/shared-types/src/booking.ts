import type { BookingStatus } from './bookings.js';

export interface SeatHoldRequest {
  tripId: string;
  seatNumber: number;
  boardingStopId: string;
  droppingStopId: string;
}

export interface SeatHoldResponse {
  bookingId: string;
  tripId: string;
  seatNumber: number;
  fareAmount: number;
  status: 'HELD';
  lockedUntil: string;
  expiresInSeconds: number;
}

export interface SeatMapEntry {
  seatNumber: number;
  status: 'AVAILABLE' | 'HELD' | 'CONFIRMED' | 'YOUR_HOLD';
  isAvailable: boolean;
}

export interface TripSeatMapResponse {
  tripId: string;
  totalSeats: number;
  seatingType: string;
  seats: SeatMapEntry[];
  heldSeatCount: number;
  confirmedSeatCount: number;
  availableSeatCount: number;
}

export interface PassengerBookingSummary {
  id: string;
  tripId: string;
  routeCode: string;
  origin: string;
  destination: string;
  operatorName: string;
  busRegistrationNumber: string;
  departureTime: string;
  seatNumber: number;
  fareAmount: number;
  status: BookingStatus;
  lockedUntil: string | null;
  createdAt: string;
  ticketId?: string | null;
  qrSignature?: string | null;
}

export interface PassengerBookingsResponse {
  bookings: PassengerBookingSummary[];
  totalCount: number;
}
