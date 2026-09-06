import { and, eq, inArray, gt, sql, desc } from 'drizzle-orm';
import {
  withSystemContext,
  trips,
  buses,
  routes,
  bookings,
  operators,
  tickets,
} from '@ruralbus/database';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../errors/AppError.js';
import { setFastSeatHold, releaseFastSeatHold } from './redis.service.js';
import type {
  SeatHoldRequest,
  SeatHoldResponse,
  TripSeatMapResponse,
  SeatMapEntry,
  PassengerBookingsResponse,
  PassengerBookingSummary,
} from '@ruralbus/shared-types';

/**
 * Returns the interactive seat grid availability map for a trip.
 */
export async function getTripSeatMap(
  tripId: string,
  currentPassengerId?: string
): Promise<TripSeatMapResponse> {
  return await withSystemContext(async (tx) => {
    // 1. Fetch trip and bus details
    const [trip] = await tx
      .select({
        tripId: trips.id,
        busId: trips.busId,
        totalSeats: buses.totalSeats,
        seatingType: buses.seatingType,
      })
      .from(trips)
      .innerJoin(buses, eq(trips.busId, buses.id))
      .where(eq(trips.id, tripId));

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const now = new Date();

    // 2. Fetch active bookings (CONFIRMED or active HELD)
    const activeBookings = await tx
      .select({
        seatNumber: bookings.seatNumber,
        status: bookings.status,
        passengerId: bookings.passengerId,
        lockedUntil: bookings.lockedUntil,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.tripId, tripId),
          inArray(bookings.status, ['HELD', 'CONFIRMED', 'BOARDED'])
        )
      );

    const seatStatusMap = new Map<number, { status: string; passengerId: string }>();

    for (const b of activeBookings) {
      if (b.status === 'CONFIRMED' || b.status === 'BOARDED') {
        seatStatusMap.set(b.seatNumber, { status: 'CONFIRMED', passengerId: b.passengerId });
      } else if (b.status === 'HELD') {
        if (b.lockedUntil && b.lockedUntil > now) {
          seatStatusMap.set(b.seatNumber, { status: 'HELD', passengerId: b.passengerId });
        }
      }
    }

    const totalSeats = trip.totalSeats;
    const seats: SeatMapEntry[] = [];
    let heldCount = 0;
    let confirmedCount = 0;

    for (let seatNum = 1; seatNum <= totalSeats; seatNum++) {
      const active = seatStatusMap.get(seatNum);
      if (!active) {
        seats.push({
          seatNumber: seatNum,
          status: 'AVAILABLE',
          isAvailable: true,
        });
      } else if (active.status === 'CONFIRMED') {
        confirmedCount++;
        seats.push({
          seatNumber: seatNum,
          status: 'CONFIRMED',
          isAvailable: false,
        });
      } else if (active.status === 'HELD') {
        heldCount++;
        const isMine = currentPassengerId && active.passengerId === currentPassengerId;
        seats.push({
          seatNumber: seatNum,
          status: isMine ? 'YOUR_HOLD' : 'HELD',
          isAvailable: false,
        });
      }
    }

    return {
      tripId,
      totalSeats,
      seatingType: trip.seatingType,
      seats,
      heldSeatCount: heldCount,
      confirmedSeatCount: confirmedCount,
      availableSeatCount: totalSeats - heldCount - confirmedCount,
    };
  });
}

/**
 * Authoritatively locks a seat for 5 minutes with Redis fast-path pre-check
 * and PostgreSQL ACID transaction uniqueness guarantee.
 */
export async function holdSeat(
  passengerId: string,
  req: SeatHoldRequest
): Promise<SeatHoldResponse> {
  const HOLD_DURATION_SECONDS = 300; // 5 minutes

  // 1. Fast-Path Pre-Check via Redis
  const fastHoldGranted = await setFastSeatHold(
    req.tripId,
    req.seatNumber,
    passengerId,
    HOLD_DURATION_SECONDS
  );

  if (!fastHoldGranted) {
    throw new ConflictError(`Seat ${req.seatNumber} is currently reserved by another passenger`);
  }

  try {
    // 2. Authoritative PostgreSQL ACID Locking
    return await withSystemContext(async (tx) => {
      // A. Verify Trip exists and is open for booking
      const [trip] = await tx
        .select({
          id: trips.id,
          tenantId: trips.tenantId,
          routeId: trips.routeId,
          busId: trips.busId,
          status: trips.status,
          availableSeats: trips.availableSeats,
          totalSeats: buses.totalSeats,
          stopsData: routes.stopsData,
        })
        .from(trips)
        .innerJoin(buses, eq(trips.busId, buses.id))
        .innerJoin(routes, eq(trips.routeId, routes.id))
        .where(eq(trips.id, req.tripId));

      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      if (!['SCHEDULED', 'BOARDING', 'IN_TRANSIT'].includes(trip.status)) {
        throw new BadRequestError(`Cannot book seats on a trip with status '${trip.status}'`);
      }

      if (req.seatNumber < 1 || req.seatNumber > trip.totalSeats) {
        throw new BadRequestError(`Invalid seat number ${req.seatNumber}. Bus capacity is ${trip.totalSeats}`);
      }

      const now = new Date();

      // B. Check for active collision in DB
      const [existingBooking] = await tx
        .select({ id: bookings.id, status: bookings.status, lockedUntil: bookings.lockedUntil })
        .from(bookings)
        .where(
          and(
            eq(bookings.tripId, req.tripId),
            eq(bookings.seatNumber, req.seatNumber),
            inArray(bookings.status, ['HELD', 'CONFIRMED', 'BOARDED'])
          )
        );

      if (existingBooking) {
        if (existingBooking.status === 'CONFIRMED' || existingBooking.status === 'BOARDED') {
          throw new ConflictError(`Seat ${req.seatNumber} is already confirmed by another passenger`);
        }
        if (existingBooking.status === 'HELD' && existingBooking.lockedUntil && existingBooking.lockedUntil > now) {
          throw new ConflictError(`Seat ${req.seatNumber} is currently held by another passenger`);
        }
      }

      // C. Calculate Fare
      const stopsList = (trip.stopsData as any[]) || [];
      let fareAmount = 45;
      const startStop = stopsList.find((s) => s.stopId === req.boardingStopId);
      const endStop = stopsList.find((s) => s.stopId === req.droppingStopId);

      if (startStop && endStop) {
        const f1 = startStop.fareFromStart ?? 0;
        const f2 = endStop.fareFromStart ?? 45;
        fareAmount = Math.max(f2 - f1, 15);
      }

      const lockedUntil = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);

      // D. Insert HELD booking
      const [booking] = await tx
        .insert(bookings)
        .values({
          tenantId: trip.tenantId,
          tripId: req.tripId,
          passengerId,
          seatNumber: req.seatNumber,
          boardingStopId: req.boardingStopId,
          droppingStopId: req.droppingStopId,
          fareAmount,
          status: 'HELD',
          lockedUntil,
        })
        .returning();

      // E. Update availableSeats counter on trip
      await tx
        .update(trips)
        .set({
          availableSeats: Math.max(0, trip.availableSeats - 1),
          updatedAt: now,
        })
        .where(eq(trips.id, req.tripId));

      return {
        bookingId: booking.id,
        tripId: req.tripId,
        seatNumber: req.seatNumber,
        fareAmount,
        status: 'HELD',
        lockedUntil: lockedUntil.toISOString(),
        expiresInSeconds: HOLD_DURATION_SECONDS,
      };
    });
  } catch (err) {
    // If PostgreSQL lock fails, release Redis key
    await releaseFastSeatHold(req.tripId, req.seatNumber);
    throw err;
  }
}

/**
 * Releases / cancels an active seat hold.
 */
export async function releaseSeatHold(
  passengerId: string,
  bookingId: string
): Promise<{ success: boolean; bookingId: string }> {
  return await withSystemContext(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.passengerId !== passengerId) {
      throw new ForbiddenError('You are not authorized to release this booking');
    }

    if (booking.status === 'HELD') {
      const now = new Date();
      await tx
        .update(bookings)
        .set({
          status: 'CANCELLED',
          updatedAt: now,
        })
        .where(eq(bookings.id, bookingId));

      // Restore available seats count on trip
      await tx
        .update(trips)
        .set({
          availableSeats: sql`${trips.availableSeats} + 1`,
          updatedAt: now,
        })
        .where(eq(trips.id, booking.tripId));

      // Release fast-path hold in Redis
      await releaseFastSeatHold(booking.tripId, booking.seatNumber);
    }

    return {
      success: true,
      bookingId,
    };
  });
}

/**
 * Returns all past and active bookings for the authenticated passenger.
 */
export async function getPassengerBookings(passengerId: string): Promise<PassengerBookingsResponse> {
  return await withSystemContext(async (tx) => {
    const rows = await tx
      .select({
        id: bookings.id,
        tripId: bookings.tripId,
        seatNumber: bookings.seatNumber,
        fareAmount: bookings.fareAmount,
        status: bookings.status,
        lockedUntil: bookings.lockedUntil,
        createdAt: bookings.createdAt,
        routeCode: routes.routeCode,
        origin: routes.origin,
        destination: routes.destination,
        operatorName: operators.companyName,
        busRegistrationNumber: buses.registrationNumber,
        departureTime: trips.departureTime,
        ticketId: tickets.id,
        qrSignature: tickets.qrSignature,
      })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.id))
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(buses, eq(trips.busId, buses.id))
      .innerJoin(operators, eq(bookings.tenantId, operators.id))
      .leftJoin(tickets, eq(bookings.id, tickets.bookingId))
      .where(eq(bookings.passengerId, passengerId))
      .orderBy(desc(bookings.createdAt));

    const formatted: PassengerBookingSummary[] = rows.map((r) => ({
      id: r.id,
      tripId: r.tripId,
      routeCode: r.routeCode,
      origin: r.origin,
      destination: r.destination,
      operatorName: r.operatorName,
      busRegistrationNumber: r.busRegistrationNumber,
      departureTime: r.departureTime.toISOString(),
      seatNumber: r.seatNumber,
      fareAmount: r.fareAmount,
      status: r.status,
      lockedUntil: r.lockedUntil ? r.lockedUntil.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      ticketId: r.ticketId,
      qrSignature: r.qrSignature,
    }));

    return {
      bookings: formatted,
      totalCount: formatted.length,
    };
  });
}
