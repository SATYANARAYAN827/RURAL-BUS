import { z } from 'zod';

export const offlineCashTicketItemSchema = z.object({
  ticketSequence: z.number().int().positive(),
  ticketCode: z.string().min(6),
  deviceId: z.string().min(1),
  tripId: z.string().uuid(),
  boardingStopId: z.string().uuid(),
  droppingStopId: z.string().uuid(),
  passengerCount: z.number().int().positive().default(1),
  fareAmount: z.number().positive(),
  paymentMethod: z.literal('CASH'),
  issuedAt: z.string().datetime().or(z.string().min(10)),
  prevTicketHash: z.string().min(1),
  ticketHash: z.string().min(1),
});

export const offlineCashTicketBatchSyncSchema = z.object({
  tripId: z.string().uuid(),
  deviceId: z.string().min(1),
  tickets: z.array(offlineCashTicketItemSchema).min(1),
});

export const conductorCashSettlementParamSchema = z.object({
  tripId: z.string().uuid(),
});
