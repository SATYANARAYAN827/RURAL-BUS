import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  getTripSeatMap,
  holdSeat,
  releaseSeatHold,
  getPassengerBookings,
} from '../services/booking.service.js';
import {
  seatHoldSchema,
  tripSeatMapParamSchema,
  bookingActionParamSchema,
} from '@ruralbus/shared-validators';

export async function bookingRoutes(app: FastifyInstance) {
  // Public / Passenger Trip Seat Map
  app.get('/api/v1/bookings/trips/:tripId/seats', async (request, reply) => {
    const { tripId } = tripSeatMapParamSchema.parse(request.params);
    let currentPassengerId: string | undefined;

    // Optional auth check for YOUR_HOLD distinction
    try {
      await app.authenticate(request, reply);
      currentPassengerId = request.user?.sub;
    } catch {
      // Unauthenticated visitor
    }

    const seatMap = await getTripSeatMap(tripId, currentPassengerId);
    return reply.code(200).send({
      success: true,
      data: seatMap,
    });
  });

  // Authoritative Seat Hold (Passenger)
  app.post(
    '/api/v1/bookings/hold',
    {
      onRequest: [app.authenticate, requireRole(['PASSENGER'])],
    },
    async (request, reply) => {
      const passengerId = request.user!.sub;
      const payload = seatHoldSchema.parse(request.body);

      const holdResult = await holdSeat(passengerId, payload);
      return reply.code(200).send({
        success: true,
        data: holdResult,
      });
    }
  );

  // Release Seat Hold (Passenger)
  app.delete(
    '/api/v1/bookings/:bookingId/hold',
    {
      onRequest: [app.authenticate, requireRole(['PASSENGER'])],
    },
    async (request, reply) => {
      const passengerId = request.user!.sub;
      const { bookingId } = bookingActionParamSchema.parse(request.params);

      const result = await releaseSeatHold(passengerId, bookingId);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  // My Bookings History (Passenger)
  app.get(
    '/api/v1/bookings/my-bookings',
    {
      onRequest: [app.authenticate, requireRole(['PASSENGER'])],
    },
    async (request, reply) => {
      const passengerId = request.user!.sub;
      const history = await getPassengerBookings(passengerId);

      return reply.code(200).send({
        success: true,
        data: history,
      });
    }
  );
}
