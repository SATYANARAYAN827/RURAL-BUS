import { pgTable, uuid, varchar, integer, doublePrecision, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { routes } from './routes.js';

export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    routeId: uuid('route_id')
      .references(() => routes.id, { onDelete: 'cascade' })
      .notNull(),
    departureTime: varchar('departure_time', { length: 8 }).notNull(), // HH:mm:ss
    arrivalTime: varchar('arrival_time', { length: 8 }).notNull(), // HH:mm:ss
    daysOfWeek: jsonb('days_of_week').$type<number[]>().notNull(), // [0,1,2,3,4,5,6]
    baseFare: doublePrecision('base_fare').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_schedules_tenant').on(table.tenantId),
    routeIdx: index('idx_schedules_route').on(table.tenantId, table.routeId),
  })
);

export type ScheduleRecord = typeof schedules.$inferSelect;
export type NewScheduleRecord = typeof schedules.$inferInsert;
