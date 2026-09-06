import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  dispatchNotification,
  generateThermalReceiptEscPos,
} from '../services/notification.service.js';
import {
  sendNotificationSchema,
  getTicketReceiptParamSchema,
} from '@ruralbus/shared-validators';

export async function notificationRoutes(app: FastifyInstance) {
  // Broadcast / Direct Notification Dispatch (Operator Admin)
  app.post(
    '/api/v1/notifications/send',
    {
      onRequest: [app.authenticate, requireRole(['OPERATOR_ADMIN'])],
    },
    async (request, reply) => {
      const tenantId = request.user!.tenantId!;
      const body = sendNotificationSchema.parse(request.body);

      const result = await dispatchNotification(tenantId, body);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  // Generate ESC/POS Thermal Ticket Receipt (Passenger, Conductor, Operator Admin)
  app.get(
    '/api/v1/tickets/:ticketId/receipt',
    {
      onRequest: [app.authenticate],
    },
    async (request, reply) => {
      const { ticketId } = getTicketReceiptParamSchema.parse(request.params);

      const receipt = await generateThermalReceiptEscPos(ticketId);
      return reply.code(200).send({
        success: true,
        data: receipt,
      });
    }
  );
}
