import { pgTable, uuid, varchar, doublePrecision, timestamp, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { postgisPoint } from './spatial-types.js';

export const stops = pgTable(
  'stops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    location: postgisPoint('location'),
    landmark: varchar('landmark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_stops_tenant').on(table.tenantId),
    locationGistIdx: index('idx_stops_location_gist').using('gist', table.location),
  })
);

export type StopRecord = typeof stops.$inferSelect;
export type NewStopRecord = typeof stops.$inferInsert;
