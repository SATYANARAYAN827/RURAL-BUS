import { sql } from 'drizzle-orm';
import { pgTable, uuid, integer, doublePrecision, varchar, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { trips } from './trips.js';
import { users } from './users.js';
import { stops } from './stops.js';

export const bookingStatusEnum = pgEnum('booking_status', [
  'HELD',
  'CONFIRMED',
  'BOARDED',
  'CANCELLED',
  'EXPIRED',
]);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    tripId: uuid('trip_id')
      .references(() => trips.id, { onDelete: 'cascade' })
      .notNull(),
    passengerId: uuid('passenger_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    seatNumber: integer('seat_number').notNull(),
    boardingStopId: uuid('boarding_stop_id')
      .references(() => stops.id, { onDelete: 'cascade' })
      .notNull(),
    droppingStopId: uuid('dropping_stop_id')
      .references(() => stops.id, { onDelete: 'cascade' })
      .notNull(),
    fareAmount: doublePrecision('fare_amount').notNull(),
    status: bookingStatusEnum('status').default('HELD').notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    paymentId: varchar('payment_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    activeSeatIdx: uniqueIndex('idx_active_seat')
      .on(table.tripId, table.seatNumber)
      .where(sql`status IN ('HELD', 'CONFIRMED')`),
    tenantIdx: index('idx_bookings_tenant').on(table.tenantId),
    tripIdx: index('idx_bookings_trip').on(table.tripId),
    passengerIdx: index('idx_bookings_passenger').on(table.passengerId),
    statusIdx: index('idx_bookings_status').on(table.status),
  })
);

export type BookingRecord = typeof bookings.$inferSelect;
export type NewBookingRecord = typeof bookings.$inferInsert;
