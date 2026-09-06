import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { trips } from './trips.js';
import { bookings } from './bookings.js';
import { users } from './users.js';

export const ticketStatusEnum = pgEnum('ticket_status', [
  'VALID',
  'BOARDED',
  'EXPIRED',
  'CANCELLED',
]);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    bookingId: uuid('booking_id')
      .references(() => bookings.id, { onDelete: 'cascade' })
      .notNull(),
    tripId: uuid('trip_id')
      .references(() => trips.id, { onDelete: 'cascade' })
      .notNull(),
    passengerId: uuid('passenger_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    qrSignature: text('qr_signature').notNull(),
    status: ticketStatusEnum('status').default('VALID').notNull(),
    boardedAt: timestamp('boarded_at', { withTimezone: true }),
    boardedByConductorId: uuid('boarded_by_conductor_id')
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_tickets_tenant').on(table.tenantId),
    tripIdx: index('idx_tickets_trip').on(table.tripId),
    bookingIdx: index('idx_tickets_booking').on(table.bookingId),
    passengerIdx: index('idx_tickets_passenger').on(table.passengerId),
    statusIdx: index('idx_tickets_status').on(table.status),
  })
);

export type TicketRecord = typeof tickets.$inferSelect;
export type NewTicketRecord = typeof tickets.$inferInsert;
