import { z } from 'zod';

export const tripActionParamSchema = z.object({
  tripId: z.string().uuid(),
});

export const boardPassengerParamSchema = z.object({
  tripId: z.string().uuid(),
  ticketId: z.string().uuid(),
});

export const updateBoardingStatusSchema = z.object({
  isBoarded: z.boolean(),
});

export type TripActionParam = z.infer<typeof tripActionParamSchema>;
export type BoardPassengerParam = z.infer<typeof boardPassengerParamSchema>;
export type UpdateBoardingStatusInput = z.infer<typeof updateBoardingStatusSchema>;
