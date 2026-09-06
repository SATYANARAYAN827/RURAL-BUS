import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
import type { AppUserRole } from '@ruralbus/shared-types';

/**
 * Higher-order preHandler guard requiring specific user roles.
 */
export function requireRole(allowedRoles: AppUserRole[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user) {
      throw new UnauthorizedError('User authentication context is missing');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(
        `Forbidden: Role '${request.user.role}' is not authorized to access this resource`
      );
    }
  };
}
