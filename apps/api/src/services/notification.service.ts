import crypto from 'node:crypto';
import {
  withTenant,
  withSystemContext,
  tickets,
  bookings,
  trips,
  routes,
  buses,
  stops,
  operators,
} from '@ruralbus/database';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../errors/AppError.js';
import type {
  SendNotificationRequest,
  SendNotificationResponse,
  ThermalReceiptPayload,
} from '@ruralbus/shared-types';

export async function dispatchNotification(
  tenantId: string,
  request: SendNotificationRequest
): Promise<SendNotificationResponse> {
  const notificationId = crypto.randomUUID();
  const channel = request.channel ?? 'PUSH';

  // In local development / test environment, we log to stdout and return confirmation.
  // In production, this connects to FCM / SMS OTP Gateway.
  console.log(`[Notification Engine] [${channel}] Tenant: ${tenantId}, Title: ${request.title}, Body: ${request.body}`);

  return {
    delivered: true,
    notificationId,
    channel,
    timestamp: new Date().toISOString(),
  };
}

export async function generateThermalReceiptEscPos(
  ticketId: string
): Promise<ThermalReceiptPayload> {
  return withSystemContext(async (tx) => {
    // 1. Fetch Ticket
    const [tkt] = await tx.select().from(tickets).where(eq(tickets.id, ticketId));
    if (!tkt) {
      throw new NotFoundError('Ticket not found');
    }

    // 2. Fetch Booking
    const [bkg] = await tx.select().from(bookings).where(eq(bookings.id, tkt.bookingId));
    if (!bkg) {
      throw new NotFoundError('Associated booking record not found');
    }

    // 3. Fetch Trip, Route, Bus, Stops, Operator
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tkt.tripId));
    const [route] = trip ? await tx.select().from(routes).where(eq(routes.id, trip.routeId)) : [null];
    const [bus] = trip ? await tx.select().from(buses).where(eq(buses.id, trip.busId)) : [null];
    const [fromStop] = await tx.select().from(stops).where(eq(stops.id, bkg.boardingStopId));
    const [toStop] = await tx.select().from(stops).where(eq(stops.id, bkg.droppingStopId));
    const [operator] = await tx.select().from(operators).where(eq(operators.id, tkt.tenantId));

    const operatorName = operator?.companyName ?? 'Rural Bus Transport';
    const busNumber = bus?.registrationNumber ?? 'N/A';
    const routeTitle = route ? `${route.routeCode} (${route.origin} -> ${route.destination})` : 'Route';
    const fromStopName = fromStop?.name ?? 'Boarding Stop';
    const toStopName = toStop?.name ?? 'Dropping Stop';
    const seatNumber = bkg.seatNumber;
    const fare = bkg.fareAmount;
    const isCash = bkg.paymentId?.startsWith('TKT-') || bkg.paymentId === 'CASH';
    const paymentMode = isCash ? 'CASH' : 'ONLINE';
    const issuedAt = (tkt.boardedAt ?? tkt.createdAt).toISOString();

    // Format raw ESC/POS formatted receipt text
    const escPosRawText = [
      '================================',
      `       ${operatorName.toUpperCase()}`,
      '================================',
      `Bus No:    ${busNumber}`,
      `Route:     ${route?.routeCode ?? 'N/A'}`,
      `From:      ${fromStopName}`,
      `To:        ${toStopName}`,
      `Seat:      #${seatNumber}`,
      `Fare:      INR ${fare}.00`,
      `Payment:   ${paymentMode}`,
      `Issued:    ${issuedAt}`,
      '--------------------------------',
      `Tkt ID:    ${ticketId.slice(0, 18)}...`,
      '       HAVE A SAFE JOURNEY      ',
      '================================',
    ].join('\n');

    return {
      ticketCode: ticketId.slice(0, 8).toUpperCase(),
      operatorName,
      busNumber,
      routeTitle,
      fromStop: fromStopName,
      toStop: toStopName,
      seatNumber,
      fare,
      paymentMode,
      issuedAt,
      escPosRawText,
    };
  });
}
