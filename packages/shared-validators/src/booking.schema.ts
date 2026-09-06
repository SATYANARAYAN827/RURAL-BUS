import { z } from 'zod';

export const seatHoldSchema = z.object({
  tripId: z.string().uuid({ message: 'tripId must be a valid UUID' }),
  seatNumber: z.number().int().min(1).max(100, { message: 'Seat number must be between 1 and 100' }),
  boardingStopId: z.string().uuid({ message: 'boardingStopId must be a valid UUID' }),
  droppingStopId: z.string().uuid({ message: 'droppingStopId must be a valid UUID' }),
});

export const tripSeatMapParamSchema = z.object({
  tripId: z.string().uuid({ message: 'tripId must be a valid UUID' }),
});

export const bookingActionParamSchema = z.object({
  bookingId: z.string().uuid({ message: 'bookingId must be a valid UUID' }),
});
