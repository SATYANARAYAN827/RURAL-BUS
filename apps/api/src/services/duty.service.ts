import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import {
  db,
  withTenant,
  DrizzleTransaction,
  trips,
  routes,
  stops,
  buses,
  users,
  bookings,
  tickets,
} from '@ruralbus/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/AppError.js';
import { finalizeTripTrajectory } from './trajectory.service.js';
import { clearLiveTripCache } from './telemetry.service.js';
import type {
  DriverDutyTrip,
  DriverDutyResponse,
  DriverHistoryResponse,
  DriverHistoryTrip,
  ManifestPassengerEntry,
  ConductorDutyResponse,
  ConductorManifestResponse,
  ConductorStatsResponse,
  RouteStopDutyInfo,
} from '@ruralbus/shared-types';

/**
 * Helper to fetch detailed duty trip object with route, bus, stops, and conductor
 */
async function buildDutyTrip(
  tenantId: string,
  tripRecord: typeof trips.$inferSelect,
  tx: DrizzleTransaction
): Promise<DriverDutyTrip> {
  // 1. Fetch Route
  const [route] = await tx
    .select()
    .from(routes)
    .where(and(eq(routes.id, tripRecord.routeId), eq(routes.tenantId, tenantId)));

  // 2. Fetch Bus
  const [bus] = await tx
    .select()
    .from(buses)
    .where(and(eq(buses.id, tripRecord.busId), eq(buses.tenantId, tenantId)));

  // 3. Fetch Conductor if assigned
  let conductorName: string | null = null;
  let conductorPhone: string | null = null;
  if (tripRecord.conductorId) {
    const [conductorUser] = await tx
      .select({ fullName: users.fullName, phone: users.phone })
      .from(users)
      .where(eq(users.id, tripRecord.conductorId));
    if (conductorUser) {
      conductorName = conductorUser.fullName;
      conductorPhone = conductorUser.phone;
    }
  }

  // 4. Format Sequenced Stops from route.stopsData
  const formattedStops: RouteStopDutyInfo[] = (route?.stopsData || []).map((s: any) => ({
    stopId: s.stopId,
    stopName: s.stopName,
    sequenceNumber: s.sequenceNumber,
    distanceFromStartKm: s.distanceFromStartKm,
    estimatedMinutesFromStart: s.estimatedMinutesFromStart,
    latitude: s.location?.latitude ?? 0,
    longitude: s.location?.longitude ?? 0,
  }));

  return {
    id: tripRecord.id,
    routeId: tripRecord.routeId,
    routeCode: route?.routeCode ?? 'UNKNOWN',
    origin: route?.origin ?? 'UNKNOWN',
    destination: route?.destination ?? 'UNKNOWN',
    busId: tripRecord.busId,
    busRegistrationNumber: bus?.registrationNumber ?? 'UNKNOWN',
    busModel: bus?.model ?? 'UNKNOWN',
    totalSeats: bus?.totalSeats ?? 40,
    seatingType: bus?.seatingType ?? 'SEATER_2X2',
    conductorId: tripRecord.conductorId,
    conductorName,
    conductorPhone,
    departureTime: tripRecord.departureTime.toISOString(),
    scheduledArrival: tripRecord.scheduledArrival.toISOString(),
    actualDeparture: tripRecord.actualDeparture ? tripRecord.actualDeparture.toISOString() : null,
    actualArrival: tripRecord.actualArrival ? tripRecord.actualArrival.toISOString() : null,
    status: tripRecord.status,
    availableSeats: tripRecord.availableSeats,
    totalDistanceKm: route?.totalDistanceKm ?? 0,
    estimatedDurationMinutes: route?.estimatedDurationMinutes ?? 0,
    stops: formattedStops,
  };
}

// ==========================================
// DRIVER DUTY SERVICES
// ==========================================

export async function getDriverActiveDuty(tenantId: string, driverUserId: string): Promise<DriverDutyResponse> {
  return await withTenant(tenantId, async (tx) => {
    // 1. Find assigned trips not completed/cancelled
    const assignedTrips = await tx
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.tenantId, tenantId),
          eq(trips.driverId, driverUserId),
          inArray(trips.status, ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'])
        )
      )
      .orderBy(trips.departureTime);

    if (assignedTrips.length === 0) {
      return { activeTrip: null, upcomingTrips: [] };
    }

    // Active trip is either the one IN_TRANSIT or the earliest SCHEDULED/BOARDING
    const inTransitTrip = assignedTrips.find((t) => t.status === 'IN_TRANSIT');
    const primaryTrip = inTransitTrip || assignedTrips[0];
    const upcomingTripsList = assignedTrips.filter((t) => t.id !== primaryTrip.id);

    const activeTripDetails = await buildDutyTrip(tenantId, primaryTrip, tx);
    const upcomingDetails = await Promise.all(upcomingTripsList.map((t) => buildDutyTrip(tenantId, t, tx)));

    return {
      activeTrip: activeTripDetails,
      upcomingTrips: upcomingDetails,
    };
  });
}

export async function startDriverTrip(
  tenantId: string,
  driverUserId: string,
  tripId: string
): Promise<DriverDutyTrip> {
  return await withTenant(tenantId, async (tx) => {
    const [trip] = await tx
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));

    if (!trip) {
      throw new NotFoundError('Assigned trip not found in your tenant');
    }

    if (trip.driverId !== driverUserId) {
      throw new ForbiddenError('You are not the designated driver for this trip');
    }

    if (trip.status === 'IN_TRANSIT') {
      throw new BadRequestError('Trip is already in transit');
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot start a trip with status '${trip.status}'`);
    }

    const now = new Date();
    const [updatedTrip] = await tx
      .update(trips)
      .set({
        status: 'IN_TRANSIT',
        actualDeparture: now,
        updatedAt: now,
      })
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)))
      .returning();

    return await buildDutyTrip(tenantId, updatedTrip, tx);
  });
}

export async function endDriverTrip(
  tenantId: string,
  driverUserId: string,
  tripId: string
): Promise<DriverDutyTrip> {
  return await withTenant(tenantId, async (tx) => {
    const [trip] = await tx
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));

    if (!trip) {
      throw new NotFoundError('Assigned trip not found in your tenant');
    }

    if (trip.driverId !== driverUserId) {
      throw new ForbiddenError('You are not the designated driver for this trip');
    }

    if (trip.status !== 'IN_TRANSIT') {
      throw new BadRequestError(`Cannot complete a trip with status '${trip.status}' (must be IN_TRANSIT)`);
    }

    const now = new Date();
    const [updatedTrip] = await tx
      .update(trips)
      .set({
        status: 'COMPLETED',
        actualArrival: now,
        updatedAt: now,
      })
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)))
      .returning();

    // Trigger trajectory finalization
    try {
      await finalizeTripTrajectory(tenantId, tripId);
    } catch {
      // Continue if trajectory is already stored
    }

    // Evict completed trip from active live telemetry cache
    clearLiveTripCache(tripId);

    return await buildDutyTrip(tenantId, updatedTrip, tx);
  });
}

export async function getDriverHistory(tenantId: string, driverUserId: string): Promise<DriverHistoryResponse> {
  return await withTenant(tenantId, async (tx) => {
    const completedTrips = await tx
      .select({
        id: trips.id,
        routeCode: routes.routeCode,
        origin: routes.origin,
        destination: routes.destination,
        busRegistrationNumber: buses.registrationNumber,
        actualDeparture: trips.actualDeparture,
        actualArrival: trips.actualArrival,
        totalDistanceKm: routes.totalDistanceKm,
        status: trips.status,
      })
      .from(trips)
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(buses, eq(trips.busId, buses.id))
      .where(
        and(
          eq(trips.tenantId, tenantId),
          eq(trips.driverId, driverUserId),
          eq(trips.status, 'COMPLETED')
        )
      )
      .orderBy(desc(trips.actualArrival));

    const totalDistanceDrivenKm = completedTrips.reduce((acc, curr) => acc + curr.totalDistanceKm, 0);

    const formattedTrips: DriverHistoryTrip[] = completedTrips.map((t) => ({
      id: t.id,
      routeCode: t.routeCode,
      origin: t.origin,
      destination: t.destination,
      busRegistrationNumber: t.busRegistrationNumber,
      actualDeparture: t.actualDeparture ? t.actualDeparture.toISOString() : null,
      actualArrival: t.actualArrival ? t.actualArrival.toISOString() : null,
      totalDistanceKm: t.totalDistanceKm,
      status: t.status,
    }));

    return {
      trips: formattedTrips,
      totalCompleted: formattedTrips.length,
      totalDistanceDrivenKm,
    };
  });
}

// ==========================================
// CONDUCTOR DUTY & MANIFEST SERVICES
// ==========================================

export async function getConductorActiveDuty(
  tenantId: string,
  conductorUserId: string
): Promise<ConductorDutyResponse> {
  return await withTenant(tenantId, async (tx) => {
    const assignedTrips = await tx
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.tenantId, tenantId),
          eq(trips.conductorId, conductorUserId),
          inArray(trips.status, ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'])
        )
      )
      .orderBy(trips.departureTime);

    if (assignedTrips.length === 0) {
      return {
        activeTrip: null,
        totalBookedSeats: 0,
        totalBoardedSeats: 0,
        totalAwaitingSeats: 0,
        totalSeats: 0,
      };
    }

    const inTransitTrip = assignedTrips.find((t) => t.status === 'IN_TRANSIT');
    const primaryTrip = inTransitTrip || assignedTrips[0];
    const dutyTrip = await buildDutyTrip(tenantId, primaryTrip, tx);

    // Count confirmed / boarded bookings
    const tripBookings = await tx
      .select({ status: bookings.status })
      .from(bookings)
      .where(
        and(
          eq(bookings.tripId, primaryTrip.id),
          eq(bookings.tenantId, tenantId),
          inArray(bookings.status, ['CONFIRMED', 'BOARDED'])
        )
      );

    const totalBookedSeats = tripBookings.length;
    const totalBoardedSeats = tripBookings.filter((b) => b.status === 'BOARDED').length;
    const totalAwaitingSeats = totalBookedSeats - totalBoardedSeats;

    return {
      activeTrip: dutyTrip,
      totalBookedSeats,
      totalBoardedSeats,
      totalAwaitingSeats,
      totalSeats: dutyTrip.totalSeats,
    };
  });
}

export async function getPassengerManifest(
  tenantId: string,
  conductorUserId: string,
  tripId: string
): Promise<ConductorManifestResponse> {
  return await withTenant(tenantId, async (tx) => {
    const [trip] = await tx
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));

    if (!trip) {
      throw new NotFoundError('Trip not found in your tenant');
    }

    if (trip.conductorId !== conductorUserId) {
      throw new ForbiddenError('You are not the designated conductor for this trip');
    }

    const [route] = await tx
      .select()
      .from(routes)
      .where(and(eq(routes.id, trip.routeId), eq(routes.tenantId, tenantId)));

    const [bus] = await tx
      .select()
      .from(buses)
      .where(and(eq(buses.id, trip.busId), eq(buses.tenantId, tenantId)));

    // Fetch passenger bookings & tickets
    const manifestRecords = await tx
      .select({
        ticketId: tickets.id,
        bookingId: bookings.id,
        ticketNumber: sql<string>`${tickets.id}::text`,
        seatNumber: sql<string>`${bookings.seatNumber}::text`,
        passengerName: users.fullName,
        passengerPhone: users.phone,
        fromStopId: bookings.boardingStopId,
        toStopId: bookings.droppingStopId,
        fare: bookings.fareAmount,
        ticketStatus: tickets.status,
        bookingStatus: bookings.status,
      })
      .from(bookings)
      .innerJoin(tickets, eq(bookings.id, tickets.bookingId))
      .innerJoin(users, eq(bookings.passengerId, users.id))
      .where(
        and(
          eq(bookings.tripId, tripId),
          eq(bookings.tenantId, tenantId),
          inArray(bookings.status, ['CONFIRMED', 'BOARDED'])
        )
      )
      .orderBy(bookings.seatNumber);

    // Fetch Stop Names
    const allStops = await tx
      .select({ id: stops.id, name: stops.name })
      .from(stops)
      .where(eq(stops.tenantId, tenantId));

    const stopMap = new Map<string, string>();
    for (const s of allStops) {
      stopMap.set(s.id, s.name);
    }

    const passengers: ManifestPassengerEntry[] = manifestRecords.map((m) => ({
      ticketId: m.ticketId,
      bookingId: m.bookingId,
      ticketNumber: m.ticketNumber.slice(0, 8).toUpperCase(),
      seatNumber: m.seatNumber,
      passengerName: m.passengerName,
      passengerPhone: m.passengerPhone,
      fromStopName: stopMap.get(m.fromStopId) || 'Origin Stop',
      toStopName: stopMap.get(m.toStopId) || 'Destination Stop',
      fare: m.fare,
      isBoarded: m.ticketStatus === 'BOARDED' || m.bookingStatus === 'BOARDED',
      status: (m.ticketStatus === 'BOARDED' ? 'BOARDED' : 'CONFIRMED') as 'CONFIRMED' | 'BOARDED' | 'CANCELLED',
    }));

    const totalBookedSeats = passengers.length;
    const totalBoardedSeats = passengers.filter((p) => p.isBoarded).length;
    const totalAwaitingSeats = totalBookedSeats - totalBoardedSeats;

    return {
      tripId: trip.id,
      routeCode: route?.routeCode ?? 'UNKNOWN',
      origin: route?.origin ?? 'UNKNOWN',
      destination: route?.destination ?? 'UNKNOWN',
      busRegistrationNumber: bus?.registrationNumber ?? 'UNKNOWN',
      totalSeats: bus?.totalSeats ?? 40,
      totalBookedSeats,
      totalBoardedSeats,
      totalAwaitingSeats,
      passengers,
    };
  });
}

export async function updatePassengerBoarding(
  tenantId: string,
  conductorUserId: string,
  tripId: string,
  ticketId: string,
  isBoarded: boolean
): Promise<{ success: boolean; ticketId: string; isBoarded: boolean }> {
  return await withTenant(tenantId, async (tx) => {
    const [trip] = await tx
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    if (trip.conductorId !== conductorUserId) {
      throw new ForbiddenError('You are not the designated conductor for this trip');
    }

    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)));

    if (!ticket) {
      throw new NotFoundError('Passenger ticket not found');
    }

    const now = new Date();
    const newStatus = isBoarded ? 'BOARDED' : 'VALID';
    const newBookingStatus = isBoarded ? 'BOARDED' : 'CONFIRMED';

    // 1. Update Ticket
    await tx
      .update(tickets)
      .set({
        status: newStatus,
        boardedAt: isBoarded ? now : null,
        boardedByConductorId: isBoarded ? conductorUserId : null,
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)));

    // 2. Update Booking
    await tx
      .update(bookings)
      .set({
        status: newBookingStatus,
        updatedAt: now,
      })
      .where(and(eq(bookings.id, ticket.bookingId), eq(bookings.tenantId, tenantId)));

    return {
      success: true,
      ticketId,
      isBoarded,
    };
  });
}

export async function getConductorStats(
  tenantId: string,
  conductorUserId: string
): Promise<ConductorStatsResponse> {
  return await withTenant(tenantId, async (tx) => {
    const completedTrips = await tx
      .select({ id: trips.id })
      .from(trips)
      .where(
        and(
          eq(trips.tenantId, tenantId),
          eq(trips.conductorId, conductorUserId),
          eq(trips.status, 'COMPLETED')
        )
      );

    const boardedTickets = await tx
      .select({
        fareAmount: bookings.fareAmount,
      })
      .from(tickets)
      .innerJoin(bookings, eq(tickets.bookingId, bookings.id))
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.boardedByConductorId, conductorUserId),
          eq(tickets.status, 'BOARDED')
        )
      );

    const totalShiftCollections = boardedTickets.reduce((acc, curr) => acc + curr.fareAmount, 0);

    return {
      totalTripsHandled: completedTrips.length,
      totalPassengersBoarded: boardedTickets.length,
      totalShiftCollections,
    };
  });
}
