import { pgTable, uuid, varchar, doublePrecision, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { postgisLineString } from './spatial-types.js';

export interface RouteStopEntry {
  stopId: string;
  stopName: string;
  sequenceNumber: number;
  distanceFromStartKm: number;
  estimatedMinutesFromStart: number;
  fareFromStart: number;
}

export const routes = pgTable(
  'routes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    routeCode: varchar('route_code', { length: 30 }).notNull(),
    origin: varchar('origin', { length: 150 }).notNull(),
    destination: varchar('destination', { length: 150 }).notNull(),
    totalDistanceKm: doublePrecision('total_distance_km').notNull(),
    estimatedDurationMinutes: integer('estimated_duration_minutes').notNull(),
    polylineCoordinates: jsonb('polyline_coordinates').$type<Array<{ latitude: number; longitude: number }>>().default([]).notNull(),
    polylineGeometry: postgisLineString('polyline_geometry'),
    stopsData: jsonb('stops_data').$type<RouteStopEntry[]>().default([]).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_routes_tenant').on(table.tenantId),
    routeCodeIdx: index('idx_routes_code').on(table.tenantId, table.routeCode),
  })
);

export type RouteRecord = typeof routes.$inferSelect;
export type NewRouteRecord = typeof routes.$inferInsert;
