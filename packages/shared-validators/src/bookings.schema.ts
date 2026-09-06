import { z } from 'zod';

export const holdSeatSchema = z.object({
  tripId: z.string().uuid(),
  seatNumber: z.number().int().min(1).max(100),
  boardingStopId: z.string().uuid(),
  droppingStopId: z.string().uuid(),
});

export type HoldSeatInput = z.infer<typeof holdSeatSchema>;

export const verifyPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  razorpayOrderId: z.string().min(5),
  razorpayPaymentId: z.string().min(5),
  razorpaySignature: z.string().min(10),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const validateTicketQrSchema = z.object({
  ticketId: z.string().uuid(),
  tripId: z.string().uuid(),
  tenantId: z.string().uuid(),
  seatNumber: z.number().int(),
  issuedAt: z.number().int(),
  exp: z.number().int(),
  sig: z.string().min(10),
});

export type ValidateTicketQrInput = z.infer<typeof validateTicketQrSchema>;
