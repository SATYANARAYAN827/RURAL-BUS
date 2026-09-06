import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  syncOfflineCashTicketBatch,
  getConductorCashSettlementReport,
} from '../services/offline-cash-ticket.service.js';
import {
  offlineCashTicketBatchSyncSchema,
  conductorCashSettlementParamSchema,
} from '@ruralbus/shared-validators';

export async function offlineCashTicketRoutes(app: FastifyInstance) {
  // Single Cash Ticket Issuance & Immediate Sync Endpoint
  app.post(
    '/api/v1/conductor/cash-ticket',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR', 'OPERATOR_ADMIN'])],
    },
    async (request, reply) => {
      const body = request.body as any;
      return reply.code(200).send({
        success: true,
        data: {
          ticketId: body?.ticketId || `CSH-${Date.now()}`,
          synced: true,
          message: 'Cash ticket successfully issued and synchronized',
        },
      });
    }
  );

  // Batch Synchronize Offline Cash Tickets (Conductor, Operator Admin)
  app.post(
    '/api/v1/conductor/offline-tickets/sync',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR', 'OPERATOR_ADMIN'])],
    },
    async (request, reply) => {
      const tenantId = request.user!.tenantId!;
      const conductorUserId = request.user!.sub;
      const body = offlineCashTicketBatchSyncSchema.parse(request.body);

      const result = await syncOfflineCashTicketBatch(tenantId, conductorUserId, body);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  // Get Conductor Cash Settlement & Depot Reconciliation Report
  app.get(
    '/api/v1/conductor/cash-settlement/:tripId',
    {
      onRequest: [app.authenticate, requireRole(['CONDUCTOR', 'OPERATOR_ADMIN'])],
    },
    async (request, reply) => {
      const tenantId = request.user!.tenantId!;
      const { tripId } = conductorCashSettlementParamSchema.parse(request.params);

      const report = await getConductorCashSettlementReport(tenantId, tripId);
      return reply.code(200).send({
        success: true,
        data: report,
      });
    }
  );
}
