import { z } from 'zod';

export const ticketValidationSchema = z.object({
  qrData: z.string().min(10, 'QR data payload is required'),
});

export const tripManifestParamSchema = z.object({
  tripId: z.string().uuid('Invalid trip UUID'),
});

export type TicketValidationInput = z.infer<typeof ticketValidationSchema>;
export type TripManifestParamInput = z.infer<typeof tripManifestParamSchema>;
