export interface OfflineCashTicketPayload {
  ticketSequence: number;
  ticketCode: string; // TKT-<OPERATOR>-<DEVICE>-<TRIP>-<SEQ>
  deviceId: string;
  tripId: string;
  boardingStopId: string;
  droppingStopId: string;
  passengerCount: number;
  fareAmount: number;
  paymentMethod: 'CASH';
  issuedAt: string;
  prevTicketHash: string;
  ticketHash: string;
}

export interface OfflineCashTicketBatchSyncRequest {
  tripId: string;
  deviceId: string;
  tickets: OfflineCashTicketPayload[];
}

export interface OfflineCashTicketBatchSyncResponse {
  syncedCount: number;
  totalCashAmount: number;
  processedTickets: Array<{
    ticketCode: string;
    ticketId: string;
    status: 'SYNCED' | 'DUPLICATE' | 'INVALID';
  }>;
}

export interface ConductorCashSettlementReport {
  tripId: string;
  conductorId: string;
  conductorName: string;
  routeCode: string;
  busRegistration: string;
  digitalTicketCount: number;
  digitalRevenueAmount: number;
  cashTicketCount: number;
  cashRevenueAmount: number;
  totalPassengers: number;
  totalRevenue: number;
  generatedAt: string;
}
