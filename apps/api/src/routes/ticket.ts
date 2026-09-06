import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  getTicketDetail,
  validateAndBoardTicket,
  getOfflineConductorManifest,
} from '../services/ticket.service.js';
import {
  ticketValidationSchema,
  tripManifestParamSchema,
} from '@ruralbus/shared-validators';

export async function ticketRoutes(app: FastifyInstance) {
  // Get Digital Ticket Details (Passenger, Conductor, Operator Admin)
  app.get(
    '/api/v1/tickets/:ticketId',
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { ticketId } = request.params as { ticketId: string };

      const ticket = await getTicketDetail(user.sub, user.role, user.tenantId ?? null, ticketId);
      return reply.code(200).send({
        success: true,
        data: ticket,
      });
    }
  );

  // Validate QR and Board Passenger (Conductor)
  app.post(
    '/api/v1/tickets/validate-qr',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR', 'OPERATOR_ADMIN'])],
    },
    async (request, reply) => {
      const conductorUserId = request.user!.sub;
      const tenantId = request.user!.tenantId!;
      const { qrData } = ticketValidationSchema.parse(request.body);

      const result = await validateAndBoardTicket(conductorUserId, tenantId, qrData);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  // Pre-departure Offline Manifest Download (Conductor)
  app.get(
    '/api/v1/tickets/manifest/offline/:tripId',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR', 'OPERATOR_ADMIN'])],
    },
    async (request, reply) => {
      const conductorUserId = request.user!.role === 'CONDUCTOR' ? request.user!.sub : undefined;
      const tenantId = request.user!.tenantId!;
      const { tripId } = tripManifestParamSchema.parse(request.params);

      const manifest = await getOfflineConductorManifest(tenantId, tripId, conductorUserId);
      return reply.code(200).send({
        success: true,
        data: manifest,
      });
    }
  );
}
