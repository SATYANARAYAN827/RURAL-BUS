import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  getDriverActiveDuty,
  startDriverTrip,
  endDriverTrip,
  getDriverHistory,
  getConductorActiveDuty,
  getPassengerManifest,
  updatePassengerBoarding,
  getConductorStats,
} from '../services/duty.service.js';
import {
  tripActionParamSchema,
  boardPassengerParamSchema,
  updateBoardingStatusSchema,
} from '@ruralbus/shared-validators';

export async function dutyRoutes(app: FastifyInstance) {
  // ==========================================
  // DRIVER DUTY ENDPOINTS
  // ==========================================

  app.get(
    '/api/v1/driver/duty',
    {
      onRequest: [app.authenticate, requireRole(['DRIVER']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const driverUserId = request.user!.sub;

      const duty = await getDriverActiveDuty(tenantId, driverUserId);
      return reply.code(200).send({
        success: true,
        data: duty,
      });
    }
  );

  app.post(
    '/api/v1/driver/duty/:tripId/start',
    {
      onRequest: [app.authenticate, requireRole(['DRIVER']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const driverUserId = request.user!.sub;
      const { tripId } = tripActionParamSchema.parse(request.params);

      const trip = await startDriverTrip(tenantId, driverUserId, tripId);
      return reply.code(200).send({
        success: true,
        data: { trip },
      });
    }
  );

  app.post(
    '/api/v1/driver/duty/:tripId/end',
    {
      onRequest: [app.authenticate, requireRole(['DRIVER']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const driverUserId = request.user!.sub;
      const { tripId } = tripActionParamSchema.parse(request.params);

      const trip = await endDriverTrip(tenantId, driverUserId, tripId);
      return reply.code(200).send({
        success: true,
        data: { trip },
      });
    }
  );

  app.get(
    '/api/v1/driver/history',
    {
      onRequest: [app.authenticate, requireRole(['DRIVER']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const driverUserId = request.user!.sub;

      const history = await getDriverHistory(tenantId, driverUserId);
      return reply.code(200).send({
        success: true,
        data: history,
      });
    }
  );

  // ==========================================
  // CONDUCTOR DUTY ENDPOINTS
  // ==========================================

  app.get(
    '/api/v1/conductor/duty',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const conductorUserId = request.user!.sub;

      const duty = await getConductorActiveDuty(tenantId, conductorUserId);
      return reply.code(200).send({
        success: true,
        data: duty,
      });
    }
  );

  app.get(
    '/api/v1/conductor/manifest/:tripId',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const conductorUserId = request.user!.sub;
      const { tripId } = tripActionParamSchema.parse(request.params);

      const manifest = await getPassengerManifest(tenantId, conductorUserId, tripId);
      return reply.code(200).send({
        success: true,
        data: manifest,
      });
    }
  );

  app.put(
    '/api/v1/conductor/manifest/:tripId/board/:ticketId',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const conductorUserId = request.user!.sub;
      const { tripId, ticketId } = boardPassengerParamSchema.parse(request.params);
      const { isBoarded } = updateBoardingStatusSchema.parse(request.body);

      const result = await updatePassengerBoarding(
        tenantId,
        conductorUserId,
        tripId,
        ticketId,
        isBoarded
      );

      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  app.get(
    '/api/v1/conductor/stats',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const conductorUserId = request.user!.sub;

      const stats = await getConductorStats(tenantId, conductorUserId);
      return reply.code(200).send({
        success: true,
        data: stats,
      });
    }
  );
}
