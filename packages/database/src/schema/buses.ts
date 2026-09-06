import { pgTable, uuid, varchar, integer, timestamp, pgEnum, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';

export const busStatusEnum = pgEnum('bus_status', ['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']);
export const seatingTypeEnum = pgEnum('seating_type', ['SEATER_2X2', 'SEATER_3X2', 'SLEEPER', 'SEMI_SLEEPER']);

export const buses = pgTable(
  'buses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    registrationNumber: varchar('registration_number', { length: 30 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    totalSeats: integer('total_seats').notNull(),
    seatingType: seatingTypeEnum('seating_type').default('SEATER_2X2').notNull(),
    status: busStatusEnum('status').default('ACTIVE').notNull(),
    amenities: jsonb('amenities').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantRegUnq: unique().on(table.tenantId, table.registrationNumber),
    tenantIdx: index('idx_buses_tenant').on(table.tenantId),
    statusIdx: index('idx_buses_status').on(table.tenantId, table.status),
  })
);

export type BusRecord = typeof buses.$inferSelect;
export type NewBusRecord = typeof buses.$inferInsert;
