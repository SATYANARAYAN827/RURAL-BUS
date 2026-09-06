import { pgTable, uuid, integer, doublePrecision, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { trips } from './trips.js';
import { postgisLineString } from './spatial-types.js';

export const tripTrajectories = pgTable(
  'trip_trajectories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    tripId: uuid('trip_id')
      .references(() => trips.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    totalDistanceKm: doublePrecision('total_distance_km').notNull(),
    totalPoints: integer('total_points').notNull(),
    simplifiedPolyline: jsonb('simplified_polyline').$type<Array<{ latitude: number; longitude: number; timestamp: number }>>().notNull(),
    trajectoryGeometry: postgisLineString('trajectory_geometry'),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_trip_trajectories_tenant').on(table.tenantId),
    tripIdx: index('idx_trip_trajectories_trip').on(table.tripId),
  })
);

export type TripTrajectoryRecord = typeof tripTrajectories.$inferSelect;
export type NewTripTrajectoryRecord = typeof tripTrajectories.$inferInsert;
