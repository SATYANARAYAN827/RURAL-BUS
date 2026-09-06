import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  createStaffSchema,
  updateStaffStatusSchema,
  resetStaffPasswordSchema,
  updateOperatorProfileSchema,
  staffQuerySchema,
} from '@ruralbus/shared-validators';
import {
  getOperatorProfile,
  updateOperatorProfile,
  listStaffMembers,
  provisionStaffMember,
  updateStaffStatus,
  resetStaffPassword,
  getOperatorRevenueSummary,
} from '../services/staff.service.js';

export const operatorRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All operator routes require authenticated OPERATOR_ADMIN with tenant context
  const operatorGuards = {
    preHandler: [app.authenticate, requireRole(['OPERATOR_ADMIN']), app.requireTenant],
  };

  // 1. Get Operator Company Profile
  app.get(
    '/api/v1/operator/profile',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const profile = await getOperatorProfile(tenantId);
      return reply.status(200).send({
        success: true,
        data: { profile },
      });
    }
  );

  // 2. Update Operator Company Profile
  app.put(
    '/api/v1/operator/profile',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsed = updateOperatorProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid operator profile data',
          },
        });
      }

      const profile = await updateOperatorProfile(tenantId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: { profile },
      });
    }
  );

  // 3. List Staff Members (Drivers & Conductors)
  app.get(
    '/api/v1/operator/staff',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsedQuery = staffQuerySchema.safeParse(request.query);
      const query = parsedQuery.success ? parsedQuery.data : undefined;

      const result = await listStaffMembers(tenantId, query);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // 4. Provision New Staff Member (Driver or Conductor)
  app.post(
    '/api/v1/operator/staff',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsed = createStaffSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid staff details',
          },
        });
      }

      const staffMember = await provisionStaffMember(tenantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: { staff: staffMember },
      });
    }
  );

  // 5. Update Staff Member Status (Activate / Suspend)
  app.put<{ Params: { staffId: string } }>(
    '/api/v1/operator/staff/:staffId/status',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { staffId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { staffId } = request.params;
      const parsed = updateStaffStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid status data',
          },
        });
      }

      const updated = await updateStaffStatus(tenantId, staffId, parsed.data.isActive);
      return reply.status(200).send({
        success: true,
        data: { staff: updated },
      });
    }
  );

  // 6. Reset Staff Password
  app.post<{ Params: { staffId: string } }>(
    '/api/v1/operator/staff/:staffId/reset-password',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { staffId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { staffId } = request.params;
      const parsed = resetStaffPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid password data',
          },
        });
      }

      const result = await resetStaffPassword(
        tenantId,
        staffId,
        parsed.data.newPassword
      );
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // 7. Get Operator Revenue Analytics & Breakdown
  app.get(
    '/api/v1/operator/revenue',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const summary = await getOperatorRevenueSummary(tenantId);
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    }
  );

  // 8. Get Operator Fleet & Operations Stats
  app.get(
    '/api/v1/operator/stats',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const summary = await getOperatorRevenueSummary(tenantId);
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    }
  );
};
