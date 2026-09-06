import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import {
  db,
  withSystemContext,
  buses,
  operators,
  stops,
  routes,
  schedules,
  trips,
  users,
  operatorMembers,
} from '@ruralbus/database';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../errors/AppError.js';
import type {
  Bus,
  BusListResponse,
  CreateBusInput,
  UpdateBusInput,
  Stop,
  StopListResponse,
  CreateStopInput,
  UpdateStopInput,
  Route,
  RouteListResponse,
  CreateRouteInput,
  UpdateRouteInput,
  Schedule,
  ScheduleListResponse,
  CreateScheduleInput,
  UpdateScheduleInput,
  Trip,
  TripWithDetails,
  TripListResponse,
  DispatchTripInput,
  TripStatus,
} from '@ruralbus/shared-types';
import type { BusQuery } from '@ruralbus/shared-validators';

// ==========================================
// 1. Bus Fleet Operations
// ==========================================

export async function listBuses(
  tenantId?: string,
  query?: BusQuery
): Promise<BusListResponse> {
  return withSystemContext(async (tx) => {
    const conditions: any[] = [];

    const effectiveTenantId = tenantId || query?.tenantId;
    if (effectiveTenantId) {
      conditions.push(eq(buses.tenantId, effectiveTenantId));
    }

    if (query?.status) {
      conditions.push(eq(buses.status, query.status));
    }

    if (query?.search && query.search.trim().length > 0) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(buses.registrationNumber, s),
          ilike(buses.model, s)
        )!
      );
    }

    const rows = await tx
      .select({
        id: buses.id,
        tenantId: buses.tenantId,
        registrationNumber: buses.registrationNumber,
        model: buses.model,
        totalSeats: buses.totalSeats,
        seatingType: buses.seatingType,
        status: buses.status,
        amenities: buses.amenities,
        createdAt: buses.createdAt,
        updatedAt: buses.updatedAt,
        operatorName: operators.companyName,
      })
      .from(buses)
      .leftJoin(operators, eq(buses.tenantId, operators.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(buses.createdAt));

    const busList: Bus[] = rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      operatorName: r.operatorName || undefined,
      registrationNumber: r.registrationNumber,
      model: r.model,
      totalSeats: r.totalSeats,
      seatingType: r.seatingType as Bus['seatingType'],
      status: r.status as Bus['status'],
      amenities: r.amenities || [],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    const activeCount = busList.filter((b) => b.status === 'ACTIVE').length;
    const maintenanceCount = busList.filter((b) => b.status === 'MAINTENANCE').length;

    return {
      buses: busList,
      total: busList.length,
      activeCount,
      maintenanceCount,
    };
  });
}

export async function createBus(
  tenantId: string,
  input: CreateBusInput
): Promise<Bus> {
  return withSystemContext(async (tx) => {
    const targetTenantId = input.tenantId || tenantId;
    if (!targetTenantId) {
      throw new BadRequestError('Target transport owner/operator is required');
    }

    // Verify target tenant exists in operators table
    const [operator] = await tx
      .select({ id: operators.id, companyName: operators.companyName })
      .from(operators)
      .where(eq(operators.id, targetTenantId))
      .limit(1);

    if (!operator) {
      throw new NotFoundError(`Transport Operator with ID '${targetTenantId}' not found`);
    }

    const regNum = input.registrationNumber.toUpperCase().trim();

    // Verify registration number uniqueness for active vehicles system-wide
    const [existingActive] = await tx
      .select({ id: buses.id, tenantId: buses.tenantId })
      .from(buses)
      .where(and(eq(buses.registrationNumber, regNum), eq(buses.status, 'ACTIVE')))
      .limit(1);

    if (existingActive) {
      throw new ConflictError(`An active bus with registration number '${regNum}' already exists in the system`);
    }

    const [newBus] = await tx
      .insert(buses)
      .values({
        tenantId: targetTenantId,
        registrationNumber: regNum,
        model: input.model.trim(),
        totalSeats: input.totalSeats,
        seatingType: input.seatingType || 'SEATER_2X2',
        status: input.status || 'ACTIVE',
        amenities: input.amenities || [],
      })
      .returning();

    return {
      id: newBus.id,
      tenantId: newBus.tenantId,
      operatorName: operator.companyName,
      registrationNumber: newBus.registrationNumber,
      model: newBus.model,
      totalSeats: newBus.totalSeats,
      seatingType: newBus.seatingType as Bus['seatingType'],
      status: newBus.status as Bus['status'],
      amenities: newBus.amenities || [],
      createdAt: newBus.createdAt.toISOString(),
      updatedAt: newBus.updatedAt.toISOString(),
    };
  });
}

export async function updateBus(
  tenantId: string | null,
  busId: string,
  input: UpdateBusInput,
  isSuperAdmin = false
): Promise<Bus> {
  return withSystemContext(async (tx) => {
    const whereCondition = isSuperAdmin
      ? eq(buses.id, busId)
      : and(eq(buses.id, busId), eq(buses.tenantId, tenantId!));

    const [existing] = await tx
      .select()
      .from(buses)
      .where(whereCondition)
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Bus not found in your fleet');
    }

    const targetReg = (input.registrationNumber ? input.registrationNumber.toUpperCase().trim() : existing.registrationNumber);
    const targetStatus = input.status || existing.status;

    if (targetStatus === 'ACTIVE') {
      const [duplicate] = await tx
        .select({ id: buses.id })
        .from(buses)
        .where(and(eq(buses.registrationNumber, targetReg), eq(buses.status, 'ACTIVE'), sql`${buses.id} != ${busId}`))
        .limit(1);

      if (duplicate) {
        throw new ConflictError(`An active bus with registration number '${targetReg}' already exists in the system`);
      }
    }

    const [updated] = await tx
      .update(buses)
      .set({
        ...(input.registrationNumber ? { registrationNumber: targetReg } : {}),
        ...(input.tenantId && isSuperAdmin ? { tenantId: input.tenantId } : {}),
        ...(input.model ? { model: input.model.trim() } : {}),
        ...(input.totalSeats ? { totalSeats: input.totalSeats } : {}),
        ...(input.seatingType ? { seatingType: input.seatingType } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.amenities ? { amenities: input.amenities } : {}),
        updatedAt: new Date(),
      })
      .where(eq(buses.id, busId))
      .returning();

    const [op] = await tx
      .select({ companyName: operators.companyName })
      .from(operators)
      .where(eq(operators.id, updated.tenantId))
      .limit(1);

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      operatorName: op?.companyName,
      registrationNumber: updated.registrationNumber,
      model: updated.model,
      totalSeats: updated.totalSeats,
      seatingType: updated.seatingType as Bus['seatingType'],
      status: updated.status as Bus['status'],
      amenities: updated.amenities || [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function deleteBus(
  tenantId: string | null,
  busId: string,
  isSuperAdmin = false
): Promise<{ success: boolean; message: string }> {
  return withSystemContext(async (tx) => {
    const whereCondition = isSuperAdmin
      ? eq(buses.id, busId)
      : and(eq(buses.id, busId), eq(buses.tenantId, tenantId!));

    const [existing] = await tx
      .select({ id: buses.id })
      .from(buses)
      .where(whereCondition)
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Bus not found in your fleet');
    }

    if (isSuperAdmin) {
      await tx.delete(buses).where(eq(buses.id, busId));
    } else {
      await tx
        .update(buses)
        .set({ status: 'DECOMMISSIONED', updatedAt: new Date() })
        .where(eq(buses.id, busId));
    }

    return {
      success: true,
      message: isSuperAdmin ? 'Bus removed from system' : 'Bus has been decommissioned',
    };
  });
}

// ==========================================
// 2. Geo-Fenced Stops Operations
// ==========================================

export async function listStops(
  tenantId: string,
  query?: { search?: string }
): Promise<StopListResponse> {
  return withSystemContext(async (tx) => {
    const conditions = [eq(stops.tenantId, tenantId)];

    if (query?.search && query.search.trim().length > 0) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(stops.name, s),
          ilike(stops.code, s),
          ilike(stops.landmark, s)
        )!
      );
    }

    const rows = await tx
      .select()
      .from(stops)
      .where(and(...conditions))
      .orderBy(stops.name);

    const stopList: Stop[] = rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      code: r.code,
      location: {
        latitude: r.latitude,
        longitude: r.longitude,
      },
      landmark: r.landmark,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      stops: stopList,
      total: stopList.length,
    };
  });
}

export async function createStop(
  tenantId: string,
  input: CreateStopInput
): Promise<Stop> {
  return withSystemContext(async (tx) => {
    const code = input.code.toUpperCase().trim();

    const [existing] = await tx
      .select({ id: stops.id })
      .from(stops)
      .where(and(eq(stops.tenantId, tenantId), eq(stops.code, code)))
      .limit(1);

    if (existing) {
      throw new ConflictError(`A stop with code '${code}' already exists`);
    }

    const [newStop] = await tx
      .insert(stops)
      .values({
        tenantId,
        name: input.name.trim(),
        code,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        location: sql`ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}), 4326)`,
        landmark: input.landmark?.trim() || null,
      })
      .returning();

    return {
      id: newStop.id,
      tenantId: newStop.tenantId,
      name: newStop.name,
      code: newStop.code,
      location: {
        latitude: newStop.latitude,
        longitude: newStop.longitude,
      },
      landmark: newStop.landmark,
      createdAt: newStop.createdAt.toISOString(),
      updatedAt: newStop.updatedAt.toISOString(),
    };
  });
}

export async function updateStop(
  tenantId: string,
  stopId: string,
  input: UpdateStopInput
): Promise<Stop> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select()
      .from(stops)
      .where(and(eq(stops.id, stopId), eq(stops.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Stop not found in your network');
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name) updateData.name = input.name.trim();
    if (input.code) updateData.code = input.code.toUpperCase().trim();
    if (input.landmark !== undefined) updateData.landmark = input.landmark?.trim() || null;
    if (input.location) {
      updateData.latitude = input.location.latitude;
      updateData.longitude = input.location.longitude;
      updateData.location = sql`ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}), 4326)`;
    }

    const [updated] = await tx
      .update(stops)
      .set(updateData)
      .where(eq(stops.id, stopId))
      .returning();

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      code: updated.code,
      location: {
        latitude: updated.latitude,
        longitude: updated.longitude,
      },
      landmark: updated.landmark,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function deleteStop(
  tenantId: string,
  stopId: string
): Promise<{ success: boolean; message: string }> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select({ id: stops.id })
      .from(stops)
      .where(and(eq(stops.id, stopId), eq(stops.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Stop not found in your network');
    }

    await tx.delete(stops).where(eq(stops.id, stopId));

    return {
      success: true,
      message: 'Stop deleted successfully',
    };
  });
}

// ==========================================
// 3. Route Corridor & Network Operations
// ==========================================

export async function listRoutes(
  tenantId: string,
  query?: { search?: string; isActive?: boolean }
): Promise<RouteListResponse> {
  return withSystemContext(async (tx) => {
    const conditions = [eq(routes.tenantId, tenantId)];

    if (query?.isActive !== undefined) {
      conditions.push(eq(routes.isActive, query.isActive));
    }

    if (query?.search && query.search.trim().length > 0) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(routes.routeCode, s),
          ilike(routes.origin, s),
          ilike(routes.destination, s)
        )!
      );
    }

    const rows = await tx
      .select()
      .from(routes)
      .where(and(...conditions))
      .orderBy(routes.routeCode);

    const routeList: Route[] = rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      routeCode: r.routeCode,
      origin: r.origin,
      destination: r.destination,
      totalDistanceKm: r.totalDistanceKm,
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      polylineCoordinates: r.polylineCoordinates || [],
      stops: r.stopsData || [],
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      routes: routeList,
      total: routeList.length,
    };
  });
}

export async function getRouteById(
  tenantId: string,
  routeId: string
): Promise<Route> {
  return withSystemContext(async (tx) => {
    const [r] = await tx
      .select()
      .from(routes)
      .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
      .limit(1);

    if (!r) {
      throw new NotFoundError('Route not found in your network');
    }

    return {
      id: r.id,
      tenantId: r.tenantId,
      routeCode: r.routeCode,
      origin: r.origin,
      destination: r.destination,
      totalDistanceKm: r.totalDistanceKm,
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      polylineCoordinates: r.polylineCoordinates || [],
      stops: r.stopsData || [],
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function createRoute(
  tenantId: string,
  input: CreateRouteInput
): Promise<Route> {
  return withSystemContext(async (tx) => {
    const code = input.routeCode.toUpperCase().trim();

    const [existing] = await tx
      .select({ id: routes.id })
      .from(routes)
      .where(and(eq(routes.tenantId, tenantId), eq(routes.routeCode, code)))
      .limit(1);

    if (existing) {
      throw new ConflictError(`Route with code '${code}' already exists`);
    }

    // Verify all referenced stops exist in tenant and fetch stop names
    const stopIds = input.stops.map((s) => s.stopId);
    const existingStops = await tx
      .select()
      .from(stops)
      .where(and(eq(stops.tenantId, tenantId)));

    const stopMap = new Map(existingStops.map((s) => [s.id, s]));
    for (const sid of stopIds) {
      if (!stopMap.has(sid)) {
        throw new NotFoundError(`Stop with ID '${sid}' not found in your network`);
      }
    }

    // Populate stopName and location into route stopsData
    const populatedStops = input.stops
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((s) => {
        const stopRec = stopMap.get(s.stopId)!;
        return {
          stopId: s.stopId,
          stopName: stopRec.name,
          sequenceNumber: s.sequenceNumber,
          distanceFromStartKm: s.distanceFromStartKm,
          estimatedMinutesFromStart: s.estimatedMinutesFromStart,
          fareFromStart: s.fareFromStart,
          location: {
            latitude: stopRec.latitude,
            longitude: stopRec.longitude,
          },
        };
      });

    const lastStop = populatedStops[populatedStops.length - 1];
    const totalDistanceKm = lastStop.distanceFromStartKm;
    const estimatedDurationMinutes = lastStop.estimatedMinutesFromStart;

    // Generate polyline geometry if coordinates provided
    const polylineCoords =
      input.polylineCoordinates && input.polylineCoordinates.length > 0
        ? input.polylineCoordinates
        : populatedStops.map((s) => s.location);

    const [newRoute] = await tx
      .insert(routes)
      .values({
        tenantId,
        routeCode: code,
        origin: input.origin.trim(),
        destination: input.destination.trim(),
        totalDistanceKm,
        estimatedDurationMinutes,
        stopsData: populatedStops,
        polylineCoordinates: polylineCoords,
        isActive: true,
      })
      .returning();

    return {
      id: newRoute.id,
      tenantId: newRoute.tenantId,
      routeCode: newRoute.routeCode,
      origin: newRoute.origin,
      destination: newRoute.destination,
      totalDistanceKm: newRoute.totalDistanceKm,
      estimatedDurationMinutes: newRoute.estimatedDurationMinutes,
      polylineCoordinates: newRoute.polylineCoordinates || [],
      stops: newRoute.stopsData || [],
      isActive: newRoute.isActive,
      createdAt: newRoute.createdAt.toISOString(),
      updatedAt: newRoute.updatedAt.toISOString(),
    };
  });
}

export async function updateRoute(
  tenantId: string,
  routeId: string,
  input: UpdateRouteInput
): Promise<Route> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select()
      .from(routes)
      .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Route not found in your network');
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.routeCode) updateData.routeCode = input.routeCode.toUpperCase().trim();
    if (input.origin) updateData.origin = input.origin.trim();
    if (input.destination) updateData.destination = input.destination.trim();
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.polylineCoordinates) updateData.polylineCoordinates = input.polylineCoordinates;

    if (input.stops) {
      const stopIds = input.stops.map((s) => s.stopId);
      const existingStops = await tx
        .select()
        .from(stops)
        .where(eq(stops.tenantId, tenantId));
      const stopMap = new Map(existingStops.map((s) => [s.id, s]));

      const populatedStops = input.stops
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
        .map((s) => {
          const stopRec = stopMap.get(s.stopId);
          if (!stopRec) {
            throw new NotFoundError(`Stop with ID '${s.stopId}' not found`);
          }
          return {
            stopId: s.stopId,
            stopName: stopRec.name,
            sequenceNumber: s.sequenceNumber,
            distanceFromStartKm: s.distanceFromStartKm,
            estimatedMinutesFromStart: s.estimatedMinutesFromStart,
            fareFromStart: s.fareFromStart,
            location: {
              latitude: stopRec.latitude,
              longitude: stopRec.longitude,
            },
          };
        });

      const lastStop = populatedStops[populatedStops.length - 1];
      updateData.stopsData = populatedStops;
      updateData.totalDistanceKm = lastStop.distanceFromStartKm;
      updateData.estimatedDurationMinutes = lastStop.estimatedMinutesFromStart;
    }

    const [updated] = await tx
      .update(routes)
      .set(updateData)
      .where(eq(routes.id, routeId))
      .returning();

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      routeCode: updated.routeCode,
      origin: updated.origin,
      destination: updated.destination,
      totalDistanceKm: updated.totalDistanceKm,
      estimatedDurationMinutes: updated.estimatedDurationMinutes,
      polylineCoordinates: updated.polylineCoordinates || [],
      stops: updated.stopsData || [],
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function deleteRoute(
  tenantId: string,
  routeId: string
): Promise<{ success: boolean; message: string }> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select({ id: routes.id })
      .from(routes)
      .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Route not found in your network');
    }

    await tx
      .update(routes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(routes.id, routeId));

    return {
      success: true,
      message: 'Route deactivated successfully',
    };
  });
}

// ==========================================
// 4. Timetable Schedule Operations
// ==========================================

export async function listSchedules(
  tenantId: string,
  routeId?: string
): Promise<ScheduleListResponse> {
  return withSystemContext(async (tx) => {
    const conditions = [eq(schedules.tenantId, tenantId)];
    if (routeId) {
      conditions.push(eq(schedules.routeId, routeId));
    }

    const rows = await tx
      .select()
      .from(schedules)
      .where(and(...conditions))
      .orderBy(schedules.departureTime);

    const scheduleList: Schedule[] = rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      routeId: r.routeId,
      departureTime: r.departureTime,
      arrivalTime: r.arrivalTime,
      daysOfWeek: r.daysOfWeek,
      baseFare: r.baseFare,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      schedules: scheduleList,
      total: scheduleList.length,
    };
  });
}

export async function createSchedule(
  tenantId: string,
  input: CreateScheduleInput
): Promise<Schedule> {
  return withSystemContext(async (tx) => {
    // Verify route belongs to tenant
    const [route] = await tx
      .select({ id: routes.id })
      .from(routes)
      .where(and(eq(routes.id, input.routeId), eq(routes.tenantId, tenantId)))
      .limit(1);

    if (!route) {
      throw new NotFoundError('Route not found in your network');
    }

    const [newSchedule] = await tx
      .insert(schedules)
      .values({
        tenantId,
        routeId: input.routeId,
        departureTime: input.departureTime,
        arrivalTime: input.arrivalTime,
        daysOfWeek: input.daysOfWeek,
        baseFare: input.baseFare,
        isActive: true,
      })
      .returning();

    return {
      id: newSchedule.id,
      tenantId: newSchedule.tenantId,
      routeId: newSchedule.routeId,
      departureTime: newSchedule.departureTime,
      arrivalTime: newSchedule.arrivalTime,
      daysOfWeek: newSchedule.daysOfWeek,
      baseFare: newSchedule.baseFare,
      isActive: newSchedule.isActive,
      createdAt: newSchedule.createdAt.toISOString(),
      updatedAt: newSchedule.updatedAt.toISOString(),
    };
  });
}

export async function updateSchedule(
  tenantId: string,
  scheduleId: string,
  input: UpdateScheduleInput
): Promise<Schedule> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Schedule not found');
    }

    const [updated] = await tx
      .update(schedules)
      .set({
        ...(input.departureTime ? { departureTime: input.departureTime } : {}),
        ...(input.arrivalTime ? { arrivalTime: input.arrivalTime } : {}),
        ...(input.daysOfWeek ? { daysOfWeek: input.daysOfWeek } : {}),
        ...(input.baseFare !== undefined ? { baseFare: input.baseFare } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schedules.id, scheduleId))
      .returning();

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      routeId: updated.routeId,
      departureTime: updated.departureTime,
      arrivalTime: updated.arrivalTime,
      daysOfWeek: updated.daysOfWeek,
      baseFare: updated.baseFare,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function deleteSchedule(
  tenantId: string,
  scheduleId: string
): Promise<{ success: boolean; message: string }> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Schedule not found');
    }

    await tx.delete(schedules).where(eq(schedules.id, scheduleId));

    return {
      success: true,
      message: 'Schedule deleted successfully',
    };
  });
}

// ==========================================
// 5. Trip Dispatching & Management
// ==========================================

export async function listTrips(
  tenantId: string,
  query?: { routeId?: string; busId?: string; status?: TripStatus; date?: string }
): Promise<TripListResponse> {
  return withSystemContext(async (tx) => {
    const conditions = [eq(trips.tenantId, tenantId)];

    if (query?.routeId) conditions.push(eq(trips.routeId, query.routeId));
    if (query?.busId) conditions.push(eq(trips.busId, query.busId));
    if (query?.status) conditions.push(eq(trips.status, query.status));

    const rows = await tx
      .select({
        trip: trips,
        routeCode: routes.routeCode,
        origin: routes.origin,
        destination: routes.destination,
        busReg: buses.registrationNumber,
        busModel: buses.model,
      })
      .from(trips)
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(buses, eq(trips.busId, buses.id))
      .where(and(...conditions))
      .orderBy(desc(trips.departureTime));

    // Fetch driver and conductor names
    const userIds = new Set<string>();
    rows.forEach((r) => {
      if (r.trip.driverId) userIds.add(r.trip.driverId);
      if (r.trip.conductorId) userIds.add(r.trip.conductorId);
    });

    const userMap = new Map<string, { fullName: string; phone: string | null }>();
    if (userIds.size > 0) {
      const userRows = await tx
        .select({ id: users.id, fullName: users.fullName, phone: users.phone })
        .from(users);
      userRows.forEach((u) => userMap.set(u.id, u));
    }

    const tripList: TripWithDetails[] = rows.map((r) => {
      const driver = r.trip.driverId ? userMap.get(r.trip.driverId) : null;
      const conductor = r.trip.conductorId ? userMap.get(r.trip.conductorId) : null;

      return {
        id: r.trip.id,
        tenantId: r.trip.tenantId,
        routeId: r.trip.routeId,
        busId: r.trip.busId,
        driverId: r.trip.driverId,
        conductorId: r.trip.conductorId,
        departureTime: r.trip.departureTime.toISOString(),
        scheduledArrival: r.trip.scheduledArrival.toISOString(),
        actualDeparture: r.trip.actualDeparture?.toISOString() || null,
        actualArrival: r.trip.actualArrival?.toISOString() || null,
        status: r.trip.status as TripStatus,
        availableSeats: r.trip.availableSeats,
        totalSeats: r.trip.totalSeats,
        createdAt: r.trip.createdAt.toISOString(),
        updatedAt: r.trip.updatedAt.toISOString(),
        routeCode: r.routeCode,
        origin: r.origin,
        destination: r.destination,
        busRegistrationNumber: r.busReg,
        busModel: r.busModel,
        driverName: driver?.fullName || null,
        driverPhone: driver?.phone || null,
        conductorName: conductor?.fullName || null,
        conductorPhone: conductor?.phone || null,
      };
    });

    const scheduledCount = tripList.filter((t) => t.status === 'SCHEDULED').length;
    const inTransitCount = tripList.filter((t) => t.status === 'IN_TRANSIT' || t.status === 'BOARDING').length;
    const completedCount = tripList.filter((t) => t.status === 'COMPLETED').length;

    return {
      trips: tripList,
      total: tripList.length,
      scheduledCount,
      inTransitCount,
      completedCount,
    };
  });
}

export async function dispatchTrip(
  tenantId: string,
  input: DispatchTripInput
): Promise<TripWithDetails> {
  return withSystemContext(async (tx) => {
    // 1. Verify Route belongs to tenant
    const [route] = await tx
      .select()
      .from(routes)
      .where(and(eq(routes.id, input.routeId), eq(routes.tenantId, tenantId)))
      .limit(1);

    if (!route) {
      throw new NotFoundError('Route not found in your network');
    }

    // 2. Verify Bus belongs to tenant and is ACTIVE
    const [bus] = await tx
      .select()
      .from(buses)
      .where(and(eq(buses.id, input.busId), eq(buses.tenantId, tenantId)))
      .limit(1);

    if (!bus) {
      throw new NotFoundError('Bus not found in your fleet');
    }

    if (bus.status !== 'ACTIVE') {
      throw new BadRequestError(`Bus '${bus.registrationNumber}' is not in ACTIVE status (current: ${bus.status})`);
    }

    // 3. Verify Driver tenancy if assigned
    let driverUser: { fullName: string; phone: string | null } | null = null;
    if (input.driverId) {
      const [member] = await tx
        .select({ id: operatorMembers.id, role: operatorMembers.role })
        .from(operatorMembers)
        .where(
          and(
            eq(operatorMembers.userId, input.driverId),
            eq(operatorMembers.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!member || member.role !== 'DRIVER') {
        throw new BadRequestError('Assigned driver must be an active driver for this operator');
      }

      const [u] = await tx
        .select({ fullName: users.fullName, phone: users.phone })
        .from(users)
        .where(eq(users.id, input.driverId))
        .limit(1);
      driverUser = u || null;
    }

    // 4. Verify Conductor tenancy if assigned
    let conductorUser: { fullName: string; phone: string | null } | null = null;
    if (input.conductorId) {
      const [member] = await tx
        .select({ id: operatorMembers.id, role: operatorMembers.role })
        .from(operatorMembers)
        .where(
          and(
            eq(operatorMembers.userId, input.conductorId),
            eq(operatorMembers.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!member || member.role !== 'CONDUCTOR') {
        throw new BadRequestError('Assigned conductor must be an active conductor for this operator');
      }

      const [u] = await tx
        .select({ fullName: users.fullName, phone: users.phone })
        .from(users)
        .where(eq(users.id, input.conductorId))
        .limit(1);
      conductorUser = u || null;
    }

    // 5. Insert Trip
    const [newTrip] = await tx
      .insert(trips)
      .values({
        tenantId,
        routeId: input.routeId,
        busId: input.busId,
        driverId: input.driverId || null,
        conductorId: input.conductorId || null,
        departureTime: new Date(input.departureTime),
        scheduledArrival: new Date(input.scheduledArrival),
        status: 'SCHEDULED',
        availableSeats: bus.totalSeats,
        totalSeats: bus.totalSeats,
      })
      .returning();

    return {
      id: newTrip.id,
      tenantId: newTrip.tenantId,
      routeId: newTrip.routeId,
      busId: newTrip.busId,
      driverId: newTrip.driverId,
      conductorId: newTrip.conductorId,
      departureTime: newTrip.departureTime.toISOString(),
      scheduledArrival: newTrip.scheduledArrival.toISOString(),
      actualDeparture: null,
      actualArrival: null,
      status: newTrip.status as TripStatus,
      availableSeats: newTrip.availableSeats,
      totalSeats: newTrip.totalSeats,
      createdAt: newTrip.createdAt.toISOString(),
      updatedAt: newTrip.updatedAt.toISOString(),
      routeCode: route.routeCode,
      origin: route.origin,
      destination: route.destination,
      busRegistrationNumber: bus.registrationNumber,
      busModel: bus.model,
      driverName: driverUser?.fullName || null,
      driverPhone: driverUser?.phone || null,
      conductorName: conductorUser?.fullName || null,
      conductorPhone: conductorUser?.phone || null,
    };
  });
}

export async function updateTripStatus(
  tenantId: string,
  tripId: string,
  status: TripStatus
): Promise<Trip> {
  return withSystemContext(async (tx) => {
    const [existing] = await tx
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Trip not found');
    }

    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'IN_TRANSIT' && !existing.actualDeparture) {
      updateData.actualDeparture = new Date();
    } else if (status === 'COMPLETED' && !existing.actualArrival) {
      updateData.actualArrival = new Date();
    }

    const [updated] = await tx
      .update(trips)
      .set(updateData)
      .where(eq(trips.id, tripId))
      .returning();

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      routeId: updated.routeId,
      busId: updated.busId,
      driverId: updated.driverId,
      conductorId: updated.conductorId,
      departureTime: updated.departureTime.toISOString(),
      scheduledArrival: updated.scheduledArrival.toISOString(),
      actualDeparture: updated.actualDeparture?.toISOString() || null,
      actualArrival: updated.actualArrival?.toISOString() || null,
      status: updated.status as TripStatus,
      availableSeats: updated.availableSeats,
      totalSeats: updated.totalSeats,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}
