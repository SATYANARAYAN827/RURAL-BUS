import { z } from 'zod';

export const sendNotificationSchema = z.object({
  tripId: z.string().uuid().optional(),
  recipientUserId: z.string().uuid().optional(),
  type: z.enum(['TRIP_UPDATE', 'BOOKING_CONFIRMED', 'DELAY_ALERT', 'GATE_ANNOUNCEMENT', 'EMERGENCY_BROADCAST']),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(500),
  channel: z.enum(['PUSH', 'SMS', 'IN_APP']).optional().default('PUSH'),
});

export const getTicketReceiptParamSchema = z.object({
  ticketId: z.string().uuid(),
});
