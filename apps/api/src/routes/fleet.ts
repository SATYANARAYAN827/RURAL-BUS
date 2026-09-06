import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  createBusSchema,
  updateBusSchema,
  busQuerySchema,
  createStopSchema,
  updateStopSchema,
  stopQuerySchema,
  createRouteSchema,
  updateRouteSchema,
  routeQuerySchema,
  createScheduleSchema,
  updateScheduleSchema,
  dispatchTripSchema,
  updateTripStatusSchema,
  tripQuerySchema,
} from '@ruralbus/shared-validators';
import { ForbiddenError } from '../errors/AppError.js';
import {
  listBuses,
  createBus,
  updateBus,
  deleteBus,
  listStops,
  createStop,
  updateStop,
  deleteStop,
  listRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listTrips,
  dispatchTrip,
  updateTripStatus,
} from '../services/fleet.service.js';

export const fleetRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const operatorGuards = {
    preHandler: [app.authenticate, requireRole(['OPERATOR_ADMIN']), app.requireTenant],
  };

  const fleetManagerGuards = {
    preHandler: [app.authenticate, requireRole(['OPERATOR_ADMIN', 'PLATFORM_ADMIN'])],
  };

  const superAdminOnlyGuards = {
    preHandler: [app.authenticate, requireRole(['PLATFORM_ADMIN'])],
  };

  // ==========================================
  // 1. Bus Fleet Endpoints
  // ==========================================

  // List Buses: Operator Admin gets their tenant buses; Super Admin gets all or filtered by tenantId
  app.get(
    '/api/v1/operator/buses',
    fleetManagerGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedQuery = busQuerySchema.safeParse(request.query);
      const query = parsedQuery.success ? parsedQuery.data : undefined;

      const userRole = request.user!.role;
      let tenantId: string | undefined;

      if (userRole === 'OPERATOR_ADMIN') {
        tenantId = request.user!.tenantId || undefined;
        if (!tenantId) {
          throw new ForbiddenError('Tenant context is required to view fleet buses');
        }
      } else {
        // PLATFORM_ADMIN (Super Admin)
        tenantId = query?.tenantId;
      }

      const result = await listBuses(tenantId, query);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // Register Bus: STRICTLY RESTRICTED TO SUPER ADMIN (PLATFORM_ADMIN)
  // Operators receive HTTP 403 Forbidden via requireRole(['PLATFORM_ADMIN'])
  app.post(
    '/api/v1/operator/buses',
    superAdminOnlyGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createBusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid bus data',
          },
        });
      }

      const bus = await createBus(parsed.data.tenantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: { bus },
      });
    }
  );

  // Update Bus
  app.put<{ Params: { busId: string } }>(
    '/api/v1/operator/buses/:busId',
    fleetManagerGuards,
    async (request: FastifyRequest<{ Params: { busId: string } }>, reply: FastifyReply) => {
      const isSuperAdmin = request.user!.role === 'PLATFORM_ADMIN';
      const tenantId = isSuperAdmin ? null : (request.user!.tenantId || null);
      const { busId } = request.params;
      const parsed = updateBusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid update data',
          },
        });
      }

      const bus = await updateBus(tenantId, busId, parsed.data, isSuperAdmin);
      return reply.status(200).send({
        success: true,
        data: { bus },
      });
    }
  );

  // Delete / Decommission Bus
  app.delete<{ Params: { busId: string } }>(
    '/api/v1/operator/buses/:busId',
    fleetManagerGuards,
    async (request: FastifyRequest<{ Params: { busId: string } }>, reply: FastifyReply) => {
      const isSuperAdmin = request.user!.role === 'PLATFORM_ADMIN';
      const tenantId = isSuperAdmin ? null : (request.user!.tenantId || null);
      const { busId } = request.params;
      const result = await deleteBus(tenantId, busId, isSuperAdmin);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // ==========================================
  // 2. Geo-Fenced Stops Endpoints
  // ==========================================

  app.get(
    '/api/v1/operator/stops',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsedQuery = stopQuerySchema.safeParse(request.query);
      const query = parsedQuery.success ? parsedQuery.data : undefined;

      const result = await listStops(tenantId, query);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  app.post(
    '/api/v1/operator/stops',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsed = createStopSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid stop data',
          },
        });
      }

      const stop = await createStop(tenantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: { stop },
      });
    }
  );

  app.put<{ Params: { stopId: string } }>(
    '/api/v1/operator/stops/:stopId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { stopId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { stopId } = request.params;
      const parsed = updateStopSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid stop update data',
          },
        });
      }

      const stop = await updateStop(tenantId, stopId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: { stop },
      });
    }
  );

  app.delete<{ Params: { stopId: string } }>(
    '/api/v1/operator/stops/:stopId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { stopId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { stopId } = request.params;
      const result = await deleteStop(tenantId, stopId);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // ==========================================
  // 3. Route Corridor & Network Endpoints
  // ==========================================

  app.get(
    '/api/v1/operator/routes',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsedQuery = routeQuerySchema.safeParse(request.query);
      const query = parsedQuery.success ? parsedQuery.data : undefined;

      const result = await listRoutes(tenantId, query);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  app.get<{ Params: { routeId: string } }>(
    '/api/v1/operator/routes/:routeId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { routeId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { routeId } = request.params;
      const route = await getRouteById(tenantId, routeId);
      return reply.status(200).send({
        success: true,
        data: { route },
      });
    }
  );

  app.post(
    '/api/v1/operator/routes',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsed = createRouteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid route data',
          },
        });
      }

      const route = await createRoute(tenantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: { route },
      });
    }
  );

  app.put<{ Params: { routeId: string } }>(
    '/api/v1/operator/routes/:routeId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { routeId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { routeId } = request.params;
      const parsed = updateRouteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid route update data',
          },
        });
      }

      const route = await updateRoute(tenantId, routeId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: { route },
      });
    }
  );

  app.delete<{ Params: { routeId: string } }>(
    '/api/v1/operator/routes/:routeId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { routeId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { routeId } = request.params;
      const result = await deleteRoute(tenantId, routeId);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // ==========================================
  // 4. Timetable Schedule Endpoints
  // ==========================================

  app.get(
    '/api/v1/operator/schedules',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { routeId } = (request.query as { routeId?: string }) || {};
      const result = await listSchedules(tenantId, routeId);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  app.post(
    '/api/v1/operator/schedules',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsed = createScheduleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid schedule data',
          },
        });
      }

      const schedule = await createSchedule(tenantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: { schedule },
      });
    }
  );

  app.put<{ Params: { scheduleId: string } }>(
    '/api/v1/operator/schedules/:scheduleId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { scheduleId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { scheduleId } = request.params;
      const parsed = updateScheduleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid schedule update data',
          },
        });
      }

      const schedule = await updateSchedule(tenantId, scheduleId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: { schedule },
      });
    }
  );

  app.delete<{ Params: { scheduleId: string } }>(
    '/api/v1/operator/schedules/:scheduleId',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { scheduleId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { scheduleId } = request.params;
      const result = await deleteSchedule(tenantId, scheduleId);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // ==========================================
  // 5. Trip Dispatching & Management Endpoints
  // ==========================================

  app.get(
    '/api/v1/operator/trips',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsedQuery = tripQuerySchema.safeParse(request.query);
      const query = parsedQuery.success ? parsedQuery.data : undefined;

      const result = await listTrips(tenantId, query);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  app.post(
    '/api/v1/operator/trips/dispatch',
    operatorGuards,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const parsed = dispatchTripSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid trip dispatch data',
          },
        });
      }

      const trip = await dispatchTrip(tenantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: { trip },
      });
    }
  );

  app.put<{ Params: { tripId: string } }>(
    '/api/v1/operator/trips/:tripId/status',
    operatorGuards,
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const tenantId = request.tenant!.tenantId;
      const { tripId } = request.params;
      const parsed = updateTripStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid status data',
          },
        });
      }

      const trip = await updateTripStatus(tenantId, tripId, parsed.data.status);
      return reply.status(200).send({
        success: true,
        data: { trip },
      });
    }
  );
};
