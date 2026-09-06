import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  processGpsPing,
  getTripLiveLocation,
  getFleetRadar,
} from '../services/telemetry.service.js';
import {
  gpsPingSchema,
  tripLocationParamSchema,
} from '@ruralbus/shared-validators';

export async function telemetryRoutes(app: FastifyInstance) {
  // Driver HTTP GPS ping fallback
  app.post(
    '/api/v1/tracking/ping',
    {
      onRequest: [app.authenticate, requireRole(['DRIVER']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const driverUserId = request.user!.sub;
      const payload = gpsPingSchema.parse(request.body);

      const result = await processGpsPing(tenantId, driverUserId, payload);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  // Passenger / Public Trip live location query
  app.get(
    '/api/v1/tracking/trip/:tripId',
    async (request, reply) => {
      const { tripId } = tripLocationParamSchema.parse(request.params);
      const liveRes = await getTripLiveLocation(tripId);

      return reply.code(200).send({
        success: true,
        data: {
          location: liveRes.location,
          freshness: liveRes.freshness,
          receivedAt: liveRes.receivedAt,
        },
      });
    }
  );

  // Operator Admin Live Fleet Radar snapshot
  app.get(
    '/api/v1/tracking/fleet',
    {
      onRequest: [app.authenticate, requireRole(['OPERATOR_ADMIN']), app.requireTenant],
    },
    async (request, reply) => {
      const tenantId = request.tenant!.tenantId;
      const radar = await getFleetRadar(tenantId);

      return reply.code(200).send({
        success: true,
        data: radar,
      });
    }
  );
}
