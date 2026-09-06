import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import { getTripTrajectory } from '../services/trajectory.service.js';
import { tripSeatMapParamSchema } from '@ruralbus/shared-validators';

export async function trajectoryRoutes(app: FastifyInstance) {
  // Get Trip Trajectory History (Operator Admin, Driver, Conductor)
  app.get(
    '/api/v1/trips/:tripId/trajectory',
    {
      onRequest: [app.authenticate, requireRole(['OPERATOR_ADMIN', 'DRIVER', 'CONDUCTOR'])],
    },
    async (request, reply) => {
      const tenantId = request.user!.tenantId!;
      const { tripId } = tripSeatMapParamSchema.parse(request.params);

      const trajectory = await getTripTrajectory(tenantId, tripId);
      return reply.code(200).send({
        success: true,
        data: trajectory,
      });
    }
  );
}
