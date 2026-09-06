import { pgTable, uuid, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { routes } from './routes.js';
import { buses } from './buses.js';
import { users } from './users.js';

export const tripStatusEnum = pgEnum('trip_status', [
  'SCHEDULED',
  'BOARDING',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
  'DELAYED',
]);

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    routeId: uuid('route_id')
      .references(() => routes.id, { onDelete: 'cascade' })
      .notNull(),
    busId: uuid('bus_id')
      .references(() => buses.id, { onDelete: 'cascade' })
      .notNull(),
    driverId: uuid('driver_id')
      .references(() => users.id, { onDelete: 'set null' }),
    conductorId: uuid('conductor_id')
      .references(() => users.id, { onDelete: 'set null' }),
    departureTime: timestamp('departure_time', { withTimezone: true }).notNull(),
    scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }).notNull(),
    actualDeparture: timestamp('actual_departure', { withTimezone: true }),
    actualArrival: timestamp('actual_arrival', { withTimezone: true }),
    status: tripStatusEnum('status').default('SCHEDULED').notNull(),
    availableSeats: integer('available_seats').notNull(),
    totalSeats: integer('total_seats').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_trips_tenant').on(table.tenantId),
    routeIdx: index('idx_trips_route').on(table.routeId),
    busIdx: index('idx_trips_bus').on(table.busId),
    driverIdx: index('idx_trips_driver').on(table.driverId),
    conductorIdx: index('idx_trips_conductor').on(table.conductorId),
    statusIdx: index('idx_trips_status').on(table.status),
    departureTimeIdx: index('idx_trips_departure_time').on(table.departureTime),
  })
);

export type TripRecord = typeof trips.$inferSelect;
export type NewTripRecord = typeof trips.$inferInsert;
