export interface DigitalTicketPayload {
  ticketId: string;
  bookingId: string;
  tripId: string;
  tenantId: string;
  passengerId: string;
  passengerName: string;
  seatNumber: number;
  origin: string;
  destination: string;
  departureTime: string;
  fareAmount: number;
  status: 'VALID' | 'BOARDED' | 'EXPIRED' | 'CANCELLED';
  qrSignature: string;
  boardedAt?: string | null;
}

export interface TicketValidationRequest {
  qrData: string; // Serialized QR token or JSON payload
}

export interface TicketValidationResponse {
  valid: boolean;
  message: string;
  ticket?: DigitalTicketPayload;
  alreadyBoarded?: boolean;
}

export interface OfflineManifestItem {
  ticketId: string;
  bookingId: string;
  seatNumber: number;
  passengerName: string;
  passengerPhone?: string | null;
  boardingStopName: string;
  droppingStopName: string;
  fareAmount: number;
  status: 'VALID' | 'BOARDED';
  qrSignature: string;
  boardedAt?: string | null;
}

export interface OfflineManifestSyncResponse {
  tripId: string;
  routeCode: string;
  busRegistrationNumber: string;
  origin: string;
  destination: string;
  totalSeats: number;
  totalBooked: number;
  totalBoarded: number;
  passengers: OfflineManifestItem[];
}
