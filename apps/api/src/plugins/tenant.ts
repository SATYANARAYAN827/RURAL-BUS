import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
import { withTenant as dbWithTenant, DrizzleTransaction } from '@ruralbus/database';
import type { TenantContext, OperatorMemberRole } from '@ruralbus/shared-types';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantContext;
    withTenant: <T>(callback: (tx: DrizzleTransaction) => Promise<T>) => Promise<T>;
  }
  interface FastifyInstance {
    requireTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const tenantPlugin = fp(async function (fastify: FastifyInstance) {
  // Pre-parsing hook to scrub any client-provided x-tenant-id headers to enforce zero-client-trust
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    if (request.headers['x-tenant-id']) {
      // Ingress scrubbing: delete client-supplied header so downstream handlers never read untrusted input
      delete request.headers['x-tenant-id'];
    }
  });

  // Decorate Fastify with requireTenant preHandler hook
  fastify.decorate(
    'requireTenant',
    async function (request: FastifyRequest, _reply: FastifyReply) {
      if (!request.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!request.user.tenantId) {
        throw new ForbiddenError('Tenant context is required for this operation');
      }

      request.tenant = {
        tenantId: request.user.tenantId,
        role: request.user.role as OperatorMemberRole,
        userId: request.user.sub,
      };
    }
  );

  // Decorate Request with withTenant helper bound to the authenticated user's tenantId
  fastify.decorateRequest(
    'withTenant',
    function <T>(this: FastifyRequest, callback: (tx: DrizzleTransaction) => Promise<T>): Promise<T> {
      const tenantId = this.tenant?.tenantId || this.user?.tenantId;
      if (!tenantId) {
        throw new ForbiddenError('Tenant context is required for database operations');
      }
      return dbWithTenant(tenantId, callback);
    }
  );
});
