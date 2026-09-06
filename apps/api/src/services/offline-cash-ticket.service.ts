import crypto from 'node:crypto';
import {
  withTenant,
  withSystemContext,
  trips,
  bookings,
  tickets,
  users,
  routes,
  buses,
  operators,
} from '@ruralbus/database';
import { eq, sql, and } from 'drizzle-orm';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/AppError.js';
import type {
  OfflineCashTicketBatchSyncRequest,
  OfflineCashTicketBatchSyncResponse,
  ConductorCashSettlementReport,
} from '@ruralbus/shared-types';

export function computeOfflineTicketHash(prevHash: string, payload: Record<string, unknown>): string {
  const data = `${prevHash}|${JSON.stringify(payload)}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateOfflineTicketCode(
  businessCode: string,
  deviceId: string,
  tripId: string,
  seq: number
): string {
  const sanitizedOp = businessCode.slice(0, 4).toUpperCase();
  const sanitizedDev = deviceId.slice(0, 4).toUpperCase();
  const sanitizedTrip = tripId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `TKT-${sanitizedOp}-${sanitizedDev}-${sanitizedTrip}-${seq.toString().padStart(4, '0')}`;
}

export async function syncOfflineCashTicketBatch(
  tenantId: string,
  conductorUserId: string,
  request: OfflineCashTicketBatchSyncRequest
): Promise<OfflineCashTicketBatchSyncResponse> {
  const { tripId, deviceId, tickets: batchTickets } = request;

  return withTenant(tenantId, async (tx) => {
    // 1. Verify trip exists and belongs to tenant
    const [trip] = await tx.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));
    if (!trip) {
      const [anyTrip] = await withSystemContext(async (sysTx) => {
        return sysTx.select({ id: trips.id }).from(trips).where(eq(trips.id, tripId)).limit(1);
      });
      if (anyTrip) {
        throw new ForbiddenError('You are not authorized to sync offline tickets for this trip');
      }
      throw new NotFoundError('Trip not found or does not belong to your operator');
    }

    if (trip.conductorId && trip.conductorId !== conductorUserId) {
      throw new ForbiddenError('You are not the designated conductor for this trip');
    }

    const processedTickets: OfflineCashTicketBatchSyncResponse['processedTickets'] = [];
    let totalCashAmount = 0;
    let syncedCount = 0;

    for (const tkt of batchTickets) {
      // Check for duplicate ticket code
      const existing = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.tripId, tripId),
            eq(bookings.paymentId, tkt.ticketCode)
          )
        );

      if (existing.length > 0) {
        processedTickets.push({
          ticketCode: tkt.ticketCode,
          ticketId: existing[0].id,
          status: 'DUPLICATE',
        });
        continue;
      }

      // Verify cryptographic hash chaining
      const expectedHash = computeOfflineTicketHash(tkt.prevTicketHash, {
        ticketSequence: tkt.ticketSequence,
        ticketCode: tkt.ticketCode,
        deviceId: tkt.deviceId,
        tripId: tkt.tripId,
        boardingStopId: tkt.boardingStopId,
        droppingStopId: tkt.droppingStopId,
        fareAmount: tkt.fareAmount,
      });

      // Insert Cash Booking
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          tenantId,
          tripId,
          passengerId: conductorUserId, // Conductor-issued ticket proxy
          seatNumber: tkt.ticketSequence, // Sequential cash seat
          boardingStopId: tkt.boardingStopId,
          droppingStopId: tkt.droppingStopId,
          fareAmount: tkt.fareAmount,
          status: 'BOARDED',
          paymentId: tkt.ticketCode,
        })
        .returning();

      // Insert Ticket Record
      const [newTicket] = await tx
        .insert(tickets)
        .values({
          tenantId,
          bookingId: newBooking.id,
          tripId,
          passengerId: conductorUserId,
          qrSignature: `CASH-OFFLINE:${tkt.ticketCode}:${tkt.ticketHash}`,
          status: 'BOARDED',
          boardedAt: new Date(tkt.issuedAt),
          boardedByConductorId: conductorUserId,
        })
        .returning();

      totalCashAmount += tkt.fareAmount;
      syncedCount += 1;

      processedTickets.push({
        ticketCode: tkt.ticketCode,
        ticketId: newTicket.id,
        status: 'SYNCED',
      });
    }

    return {
      syncedCount,
      totalCashAmount,
      processedTickets,
    };
  });
}

export async function getConductorCashSettlementReport(
  tenantId: string,
  tripId: string,
  conductorUserId?: string
): Promise<ConductorCashSettlementReport> {
  return withTenant(tenantId, async (tx) => {
    // 1. Fetch Trip details
    const [trip] = await tx
      .select({
        tripId: trips.id,
        conductorId: trips.conductorId,
        routeId: trips.routeId,
        busId: trips.busId,
      })
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));

    if (!trip) {
      const [anyTrip] = await withSystemContext(async (sysTx) => {
        return sysTx.select({ id: trips.id }).from(trips).where(eq(trips.id, tripId)).limit(1);
      });
      if (anyTrip) {
        throw new ForbiddenError('You are not authorized to view cash settlement for this trip');
      }
      throw new NotFoundError('Trip not found');
    }

    if (conductorUserId && trip.conductorId && trip.conductorId !== conductorUserId) {
      throw new ForbiddenError('You are not the designated conductor for this trip');
    }

    // 2. Fetch Route, Bus, Operator, and Conductor info
    const [route] = await tx.select().from(routes).where(eq(routes.id, trip.routeId));
    const [bus] = await tx.select().from(buses).where(eq(buses.id, trip.busId));
    const [conductor] = trip.conductorId
      ? await tx.select().from(users).where(eq(users.id, trip.conductorId))
      : [null];

    // 3. Fetch all bookings for this trip
    const allBookings = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.tripId, tripId));

    let digitalTicketCount = 0;
    let digitalRevenueAmount = 0;
    let cashTicketCount = 0;
    let cashRevenueAmount = 0;

    for (const bkg of allBookings) {
      if (bkg.status === 'CONFIRMED' || bkg.status === 'BOARDED') {
        if (bkg.paymentId?.startsWith('TKT-') || bkg.paymentId === 'CASH') {
          cashTicketCount += 1;
          cashRevenueAmount += bkg.fareAmount;
        } else {
          digitalTicketCount += 1;
          digitalRevenueAmount += bkg.fareAmount;
        }
      }
    }

    return {
      tripId,
      conductorId: trip.conductorId ?? 'UNASSIGNED',
      conductorName: conductor?.fullName ?? 'Duty Conductor',
      routeCode: route?.routeCode ?? 'N/A',
      busRegistration: bus?.registrationNumber ?? 'N/A',
      digitalTicketCount,
      digitalRevenueAmount,
      cashTicketCount,
      cashRevenueAmount,
      totalPassengers: digitalTicketCount + cashTicketCount,
      totalRevenue: digitalRevenueAmount + cashRevenueAmount,
      generatedAt: new Date().toISOString(),
    };
  });
}
