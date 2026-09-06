export type TicketStatus = 'VALID' | 'BOARDED' | 'EXPIRED' | 'CANCELLED';

export interface DigitalTicket {
  id: string;
  bookingId: string;
  tenantId: string;
  tripId: string;
  passengerId: string;
  passengerName: string;
  seatNumber: number;
  originStopName: string;
  destinationStopName: string;
  departureTime: string;
  qrSignature: string;
  status: TicketStatus;
  issuedAt: string;
}

export interface QRManifestPayload {
  ticketId: string;
  tripId: string;
  tenantId: string;
  seatNumber: number;
  issuedAt: number;
  exp: number;
  sig: string; // Ed25519 signature
}

export interface OfflineTicketValidationResult {
  isValid: boolean;
  ticketId: string;
  seatNumber?: number;
  passengerName?: string;
  message: string;
  previouslyBoardedAt?: string;
}
