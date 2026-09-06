import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import * as schema from '@ruralbus/database';
import { requireRole } from '../plugins/rbac.js';
import { createOperatorSchema } from '@ruralbus/shared-validators';
import {
  createOperatorAndOwner,
  listOperatorsWithDetails,
} from '../services/staff.service.js';

export const tenantRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Get Authenticated Tenant Context
  app.get(
    '/api/v1/tenant/context',
    {
      preHandler: [app.authenticate, app.requireTenant],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({
        success: true,
        data: {
          tenant: request.tenant,
        },
      });
    }
  );

  // 2. Get Fleet Buses for Current Tenant (Demonstrating RLS Isolation)
  app.get(
    '/api/v1/tenant/buses',
    {
      preHandler: [app.authenticate, app.requireTenant],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const buses = await request.withTenant(async (tx) => {
        return tx.select().from(schema.buses);
      });

      return reply.status(200).send({
        success: true,
        data: {
          buses,
        },
      });
    }
  );

  // 3. Get All Registered Transport Operators (Accessible to Authenticated Users)
  app.get(
    '/api/v1/tenant/operators',
    {
      preHandler: [app.authenticate],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const operatorsList = await listOperatorsWithDetails();

      return reply.status(200).send({
        success: true,
        data: {
          operators: operatorsList,
        },
      });
    }
  );

  // 4. Create New Transport Company & Owner Account (STRICTLY PLATFORM_ADMIN)
  app.post(
    '/api/v1/tenant/operators',
    {
      preHandler: [app.authenticate, requireRole(['PLATFORM_ADMIN'])],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createOperatorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid operator creation data',
          },
        });
      }

      const result = await createOperatorAndOwner(parsed.data);

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );
};

