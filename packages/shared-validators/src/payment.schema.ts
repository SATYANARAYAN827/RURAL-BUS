import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  bookingId: z.string().uuid('Invalid booking UUID'),
});

export const verifyPaymentSchema = z.object({
  bookingId: z.string().uuid('Invalid booking UUID'),
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
