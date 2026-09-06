import { describe, it, expect } from 'vitest';
import { db, withTenant } from '../src/index.js';
import * as schema from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Authoritative Seat Locking & Partial Unique Index', () => {
  it('should enforce unique seat lock on concurrent active bookings (HELD/CONFIRMED)', async () => {
    const [operator] = await db.select().from(schema.operators).limit(1);
    const [passenger] = await db.select().from(schema.users).where(eq(schema.users.role, 'PASSENGER')).limit(1);

    expect(operator).toBeDefined();
    expect(passenger).toBeDefined();

    const [trip] = await withTenant(operator.id, async (tx) => {
      return tx.select().from(schema.trips).limit(1);
    });
    const stopsList = await withTenant(operator.id, async (tx) => {
      return tx.select().from(schema.stops).limit(2);
    });

    expect(trip).toBeDefined();
    expect(stopsList.length).toBeGreaterThanOrEqual(2);

    const testSeatNumber = 35;

    // 1. First booking locks seat 35 as 'HELD'
    const booking1 = await withTenant(operator.id, async (tx) => {
      const [b] = await tx
        .insert(schema.bookings)
        .values({
          tenantId: operator.id,
          tripId: trip.id,
          passengerId: passenger.id,
          seatNumber: testSeatNumber,
          boardingStopId: stopsList[0].id,
          droppingStopId: stopsList[1].id,
          fareAmount: 200.0,
          status: 'HELD',
          lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
        })
        .returning();
      return b;
    });

    expect(booking1.id).toBeDefined();

    // 2. Second booking attempts to hold same seat 35 on same trip -> MUST FAIL
    let duplicateFailed = false;
    try {
      await withTenant(operator.id, async (tx) => {
        return tx.insert(schema.bookings).values({
          tenantId: operator.id,
          tripId: trip.id,
          passengerId: passenger.id,
          seatNumber: testSeatNumber,
          boardingStopId: stopsList[0].id,
          droppingStopId: stopsList[1].id,
          fareAmount: 200.0,
          status: 'HELD',
          lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
        });
      });
    } catch (err: unknown) {
      duplicateFailed = true;
      const errorMsg = (err as Error).message;
      expect(errorMsg).toMatch(/unique|idx_active_seat/i);
    }
    expect(duplicateFailed).toBe(true);

    // 3. Mark booking 1 as 'CANCELLED'
    await withTenant(operator.id, async (tx) => {
      return tx
        .update(schema.bookings)
        .set({ status: 'CANCELLED' })
        .where(eq(schema.bookings.id, booking1.id));
    });

    // 4. Now that prior booking is CANCELLED, new booking for same seat 35 MUST SUCCEED
    const booking2 = await withTenant(operator.id, async (tx) => {
      const [b] = await tx
        .insert(schema.bookings)
        .values({
          tenantId: operator.id,
          tripId: trip.id,
          passengerId: passenger.id,
          seatNumber: testSeatNumber,
          boardingStopId: stopsList[0].id,
          droppingStopId: stopsList[1].id,
          fareAmount: 200.0,
          status: 'CONFIRMED',
        })
        .returning();
      return b;
    });

    expect(booking2.id).toBeDefined();

    // 5. Clean up test bookings
    await withTenant(operator.id, async (tx) => {
      await tx.delete(schema.bookings).where(eq(schema.bookings.id, booking2.id));
      await tx.delete(schema.bookings).where(eq(schema.bookings.id, booking1.id));
    });
  });
});
