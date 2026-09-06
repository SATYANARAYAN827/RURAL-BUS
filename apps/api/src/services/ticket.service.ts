import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, withTenant, withSystemContext, tickets, bookings, trips, users, routes, buses, stops } from '@ruralbus/database';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../errors/AppError.js';
import type {
  DigitalTicketPayload,
  TicketValidationResponse,
  OfflineManifestItem,
  OfflineManifestSyncResponse,
} from '@ruralbus/shared-types';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'secret_ruralbus_key_2026';

/**
 * Validates cryptographic QR payload structure and HMAC signature.
 */
export function verifyQrToken(qrData: string): {
  valid: boolean;
  ticketId?: string;
  bookingId?: string;
  tripId?: string;
  tenantId?: string;
  passengerId?: string;
  seatNumber?: number;
  issuedAt?: number;
} {
  if (!qrData.startsWith('TKT-QR:')) {
    return { valid: false };
  }

  const tokenContent = qrData.slice(7);
  const [b64Data, signature] = tokenContent.split('.');

  if (!b64Data || !signature) {
    return { valid: false };
  }

  try {
    const rawData = Buffer.from(b64Data, 'base64').toString('utf-8');
    const [ticketId, bookingId, tripId, tenantId, passengerId, seatNumStr, issuedAtStr] = rawData.split('|');

    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(rawData)
      .digest('hex');

    if (expectedSig !== signature) {
      return { valid: false };
    }

    return {
      valid: true,
      ticketId,
      bookingId,
      tripId,
      tenantId,
      passengerId,
      seatNumber: parseInt(seatNumStr, 10),
      issuedAt: parseInt(issuedAtStr, 10),
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Retrieves full details for a digital ticket.
 */
export async function getTicketDetail(
  userId: string,
  userRole: string,
  tenantId: string | null,
  ticketId: string
): Promise<DigitalTicketPayload> {
  const [result] = await withSystemContext(async (tx) => {
    return tx
      .select({
        ticketId: tickets.id,
        bookingId: tickets.bookingId,
        tripId: tickets.tripId,
        tenantId: tickets.tenantId,
        passengerId: tickets.passengerId,
        status: tickets.status,
        qrSignature: tickets.qrSignature,
        boardedAt: tickets.boardedAt,
        seatNumber: bookings.seatNumber,
        fareAmount: bookings.fareAmount,
        departureTime: trips.departureTime,
        passengerName: users.fullName,
        routeOrigin: routes.origin,
        routeDestination: routes.destination,
      })
      .from(tickets)
      .innerJoin(bookings, eq(tickets.bookingId, bookings.id))
      .innerJoin(trips, eq(tickets.tripId, trips.id))
      .innerJoin(users, eq(tickets.passengerId, users.id))
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .where(eq(tickets.id, ticketId));
  });

  if (!result) {
    throw new NotFoundError('Ticket not found');
  }

  if (userRole === 'PASSENGER' && result.passengerId !== userId) {
    throw new ForbiddenError('You do not have permission to view this ticket');
  }

  if (tenantId && result.tenantId !== tenantId) {
    throw new ForbiddenError('Ticket belongs to a different operator');
  }

  return {
    ticketId: result.ticketId,
    bookingId: result.bookingId,
    tripId: result.tripId,
    tenantId: result.tenantId,
    passengerId: result.passengerId,
    passengerName: result.passengerName,
    seatNumber: result.seatNumber,
    origin: result.routeOrigin,
    destination: result.routeDestination,
    departureTime: result.departureTime.toISOString(),
    fareAmount: result.fareAmount,
    status: result.status as any,
    qrSignature: result.qrSignature,
    boardedAt: result.boardedAt ? result.boardedAt.toISOString() : null,
  };
}

/**
 * Conductor scans and validates a passenger QR ticket, transitioning status to BOARDED.
 */
export async function validateAndBoardTicket(
  conductorUserId: string,
  conductorTenantId: string,
  qrData: string
): Promise<TicketValidationResponse> {
  const verification = verifyQrToken(qrData);

  if (!verification.valid || !verification.ticketId) {
    throw new BadRequestError('Invalid or corrupted QR ticket signature');
  }

  if (verification.tenantId !== conductorTenantId) {
    throw new ForbiddenError('This ticket belongs to another transport operator');
  }

  return await withTenant(conductorTenantId, async (tx) => {
    const [ticketRecord] = await tx
      .select({
        id: tickets.id,
        bookingId: tickets.bookingId,
        tripId: tickets.tripId,
        tenantId: tickets.tenantId,
        passengerId: tickets.passengerId,
        status: tickets.status,
        boardedAt: tickets.boardedAt,
        seatNumber: bookings.seatNumber,
        fareAmount: bookings.fareAmount,
        departureTime: trips.departureTime,
        passengerName: users.fullName,
        routeOrigin: routes.origin,
        routeDestination: routes.destination,
      })
      .from(tickets)
      .innerJoin(bookings, eq(tickets.bookingId, bookings.id))
      .innerJoin(trips, eq(tickets.tripId, trips.id))
      .innerJoin(users, eq(tickets.passengerId, users.id))
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .where(and(eq(tickets.id, verification.ticketId!), eq(tickets.tenantId, conductorTenantId)));

    if (!ticketRecord) {
      throw new NotFoundError('Ticket not found in operator records');
    }

    // Duplicate Boarding Defense
    if (ticketRecord.status === 'BOARDED') {
      const boardedTimeStr = ticketRecord.boardedAt
        ? new Date(ticketRecord.boardedAt).toLocaleTimeString()
        : 'earlier';
      return {
        valid: false,
        alreadyBoarded: true,
        message: `Duplicate Scan: Ticket was already scanned and boarded at ${boardedTimeStr}`,
        ticket: {
          ticketId: ticketRecord.id,
          bookingId: ticketRecord.bookingId,
          tripId: ticketRecord.tripId,
          tenantId: ticketRecord.tenantId,
          passengerId: ticketRecord.passengerId,
          passengerName: ticketRecord.passengerName,
          seatNumber: ticketRecord.seatNumber,
          origin: ticketRecord.routeOrigin,
          destination: ticketRecord.routeDestination,
          departureTime: ticketRecord.departureTime.toISOString(),
          fareAmount: ticketRecord.fareAmount,
          status: 'BOARDED',
          qrSignature: qrData,
          boardedAt: ticketRecord.boardedAt ? ticketRecord.boardedAt.toISOString() : null,
        },
      };
    }

    if (ticketRecord.status !== 'VALID') {
      throw new BadRequestError(`Cannot board ticket with status '${ticketRecord.status}'`);
    }

    // Transition Ticket to BOARDED
    const now = new Date();
    await tx
      .update(tickets)
      .set({
        status: 'BOARDED',
        boardedAt: now,
        boardedByConductorId: conductorUserId,
        updatedAt: now,
      })
      .where(eq(tickets.id, ticketRecord.id));

    // Transition Booking to BOARDED
    await tx
      .update(bookings)
      .set({
        status: 'BOARDED',
        updatedAt: now,
      })
      .where(eq(bookings.id, ticketRecord.bookingId));

    return {
      valid: true,
      alreadyBoarded: false,
      message: `Boarding Confirmed: Seat #${ticketRecord.seatNumber} verified`,
      ticket: {
        ticketId: ticketRecord.id,
        bookingId: ticketRecord.bookingId,
        tripId: ticketRecord.tripId,
        tenantId: ticketRecord.tenantId,
        passengerId: ticketRecord.passengerId,
        passengerName: ticketRecord.passengerName,
        seatNumber: ticketRecord.seatNumber,
        origin: ticketRecord.routeOrigin,
        destination: ticketRecord.routeDestination,
        departureTime: ticketRecord.departureTime.toISOString(),
        fareAmount: ticketRecord.fareAmount,
        status: 'BOARDED',
        qrSignature: qrData,
        boardedAt: now.toISOString(),
      },
    };
  });
}

/**
 * Pre-departure manifest sync for conductors to cache passenger list offline.
 */
export async function getOfflineConductorManifest(
  conductorTenantId: string,
  tripId: string
): Promise<OfflineManifestSyncResponse> {
  return await withTenant(conductorTenantId, async (tx) => {
    // 1. Fetch trip and bus details
    const [trip] = await tx
      .select({
        tripId: trips.id,
        routeCode: routes.routeCode,
        origin: routes.origin,
        destination: routes.destination,
        busRegistration: buses.registrationNumber,
        totalSeats: buses.totalSeats,
      })
      .from(trips)
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(buses, eq(trips.busId, buses.id))
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, conductorTenantId)));

    if (!trip) {
      throw new NotFoundError('Trip not found or does not belong to your operator');
    }

    // 2. Fetch all tickets and bookings for this trip
    const passengerRows = await tx
      .select({
        ticketId: tickets.id,
        bookingId: bookings.id,
        seatNumber: bookings.seatNumber,
        passengerName: users.fullName,
        passengerPhone: users.phone,
        fareAmount: bookings.fareAmount,
        status: tickets.status,
        qrSignature: tickets.qrSignature,
        boardedAt: tickets.boardedAt,
        boardingStopId: bookings.boardingStopId,
        droppingStopId: bookings.droppingStopId,
      })
      .from(tickets)
      .innerJoin(bookings, eq(tickets.bookingId, bookings.id))
      .innerJoin(users, eq(tickets.passengerId, users.id))
      .where(and(eq(tickets.tripId, tripId), eq(tickets.tenantId, conductorTenantId)));

    // Fetch stop names map
    const stopList = await tx.select().from(stops).where(eq(stops.tenantId, conductorTenantId));
    const stopMap = new Map<string, string>();
    for (const s of stopList) {
      stopMap.set(s.id, s.name);
    }

    let totalBoarded = 0;
    const passengers: OfflineManifestItem[] = passengerRows.map((p) => {
      if (p.status === 'BOARDED') totalBoarded++;
      return {
        ticketId: p.ticketId,
        bookingId: p.bookingId,
        seatNumber: p.seatNumber,
        passengerName: p.passengerName,
        passengerPhone: p.passengerPhone,
        boardingStopName: stopMap.get(p.boardingStopId) || 'Origin Stop',
        droppingStopName: stopMap.get(p.droppingStopId) || 'Destination Stop',
        fareAmount: p.fareAmount,
        status: p.status as any,
        qrSignature: p.qrSignature,
        boardedAt: p.boardedAt ? p.boardedAt.toISOString() : null,
      };
    });

    return {
      tripId: trip.tripId,
      routeCode: trip.routeCode,
      busRegistrationNumber: trip.busRegistration,
      origin: trip.origin,
      destination: trip.destination,
      totalSeats: trip.totalSeats,
      totalBooked: passengers.length,
      totalBoarded,
      passengers,
    };
  });
}
