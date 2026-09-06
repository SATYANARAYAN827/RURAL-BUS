export type BookingStatus =
  | 'HELD'
  | 'CONFIRMED'
  | 'BOARDED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Booking {
  id: string;
  tenantId: string;
  tripId: string;
  passengerId: string;
  seatNumber: number;
  boardingStopId: string;
  droppingStopId: string;
  fareAmount: number;
  status: BookingStatus;
  lockedUntil: string | null;
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HoldSeatRequest {
  tripId: string;
  seatNumber: number;
  boardingStopId: string;
  droppingStopId: string;
}

export interface HoldSeatResponse {
  bookingId: string;
  tripId: string;
  seatNumber: number;
  fareAmount: number;
  lockedUntil: string;
  razorpayOrderId?: string;
}
