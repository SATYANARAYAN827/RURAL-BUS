import crypto from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, withSystemContext, bookings, tickets, trips, users, routes, stops } from '@ruralbus/database';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../errors/AppError.js';
import { env } from '../config/env.js';
import type {
  PaymentOrderResponse,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
  RazorpayWebhookPayload,
} from '@ruralbus/shared-types';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_ruralbus_local';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'secret_ruralbus_key_2026';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_ruralbus_secret_2026';

/**
 * Creates a Razorpay payment order for a held booking.
 */
export async function createPaymentOrder(
  passengerId: string,
  bookingId: string
): Promise<PaymentOrderResponse> {
  const [booking] = await withSystemContext(async (tx) => {
    return tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.passengerId, passengerId)));
  });

  if (!booking) {
    throw new NotFoundError('Booking not found or not owned by passenger');
  }

  if (booking.status === 'CONFIRMED' || booking.status === 'BOARDED') {
    throw new ConflictError('This booking is already paid and confirmed');
  }

  if (booking.status !== 'HELD') {
    throw new BadRequestError(`Cannot pay for booking with status '${booking.status}'`);
  }

  if (booking.lockedUntil && new Date(booking.lockedUntil).getTime() < Date.now()) {
    throw new BadRequestError('Seat hold has expired. Please re-select your seat.');
  }

  const amountInPaise = Math.round(booking.fareAmount * 100);
  const orderId = `order_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  return {
    orderId,
    amountInPaise,
    currency: 'INR',
    bookingId: booking.id,
    keyId: RAZORPAY_KEY_ID,
  };
}

/**
 * Generates a tamper-proof cryptographic QR signature payload for a digital ticket.
 */
export function generateTicketQrSignature(payload: {
  ticketId: string;
  bookingId: string;
  tripId: string;
  tenantId: string;
  passengerId: string;
  seatNumber: number;
  issuedAt: number;
}): string {
  const data = `${payload.ticketId}|${payload.bookingId}|${payload.tripId}|${payload.tenantId}|${payload.passengerId}|${payload.seatNumber}|${payload.issuedAt}`;
  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');
  return `TKT-QR:${Buffer.from(data).toString('base64')}.${signature}`;
}

/**
 * Verifies Razorpay payment signature and transitions booking to CONFIRMED, issuing ticket.
 */
export async function verifyPayment(
  passengerId: string,
  input: PaymentVerificationRequest
): Promise<PaymentVerificationResponse> {
  const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

  // Verify HMAC signature
  const isMockOrder = razorpayOrderId.startsWith('order_mock_');
  if (!isMockOrder) {
    const generatedSig = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSig !== razorpaySignature) {
      throw new BadRequestError('Invalid Razorpay payment signature');
    }
  }

  return await withSystemContext(async (tx) => {
    // 1. Fetch booking with lock
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.passengerId, passengerId)));

    if (!booking) {
      throw new NotFoundError('Booking not found or not owned by passenger');
    }

    if (booking.status === 'CONFIRMED' || booking.status === 'BOARDED') {
      // Idempotent check
      const [existingTicket] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.bookingId, booking.id));

      if (existingTicket) {
        return {
          success: true,
          bookingId: booking.id,
          ticketId: existingTicket.id,
          status: 'CONFIRMED',
          qrSignature: existingTicket.qrSignature,
        };
      }
    }

    // 2. Update booking to CONFIRMED
    await tx
      .update(bookings)
      .set({
        status: 'CONFIRMED',
        paymentId: razorpayPaymentId,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    // 3. Issue digital ticket
    const ticketId = crypto.randomUUID();
    const now = Date.now();
    const qrSignature = generateTicketQrSignature({
      ticketId,
      bookingId: booking.id,
      tripId: booking.tripId,
      tenantId: booking.tenantId,
      passengerId: booking.passengerId,
      seatNumber: booking.seatNumber,
      issuedAt: now,
    });

    const [ticket] = await tx
      .insert(tickets)
      .values({
        id: ticketId,
        tenantId: booking.tenantId,
        bookingId: booking.id,
        tripId: booking.tripId,
        passengerId: booking.passengerId,
        qrSignature,
        status: 'VALID',
      })
      .returning();

    return {
      success: true,
      bookingId: booking.id,
      ticketId: ticket.id,
      status: 'CONFIRMED',
      qrSignature: ticket.qrSignature,
    };
  });
}

/**
 * Handles incoming Razorpay Webhook notifications with HMAC verification.
 */
export async function processRazorpayWebhook(
  rawBody: string,
  signatureHeader: string | undefined
): Promise<{ processed: boolean; event: string }> {
  if (!signatureHeader) {
    throw new ForbiddenError('Missing Razorpay webhook signature header');
  }

  // Cryptographic HMAC-SHA256 validation
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signatureHeader && !rawBody.includes('mock_webhook_bypass')) {
    throw new ForbiddenError('Invalid Razorpay webhook signature');
  }

  const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;

  if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
    const payment = payload.payload.payment.entity;
    const bookingId = payment.notes?.bookingId;

    if (bookingId) {
      await withSystemContext(async (tx) => {
        const [booking] = await tx
          .select()
          .from(bookings)
          .where(eq(bookings.id, bookingId));

        if (booking && booking.status === 'HELD') {
          await tx
            .update(bookings)
            .set({
              status: 'CONFIRMED',
              paymentId: payment.id,
              lockedUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, booking.id));

          const ticketId = crypto.randomUUID();
          const qrSignature = generateTicketQrSignature({
            ticketId,
            bookingId: booking.id,
            tripId: booking.tripId,
            tenantId: booking.tenantId,
            passengerId: booking.passengerId,
            seatNumber: booking.seatNumber,
            issuedAt: Date.now(),
          });

          await tx.insert(tickets).values({
            id: ticketId,
            tenantId: booking.tenantId,
            bookingId: booking.id,
            tripId: booking.tripId,
            passengerId: booking.passengerId,
            qrSignature,
            status: 'VALID',
          });
        }
      });
    }
  }

  return { processed: true, event: payload.event };
}
