import { pgTable, uuid, varchar, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const operatorStatusEnum = pgEnum('operator_status', ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']);

export const operators = pgTable(
  'operators',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyName: varchar('company_name', { length: 200 }).notNull(),
    businessCode: varchar('business_code', { length: 50 }).notNull().unique(),
    contactEmail: varchar('contact_email', { length: 255 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 20 }).notNull(),
    status: operatorStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessCodeIdx: index('idx_operators_code').on(table.businessCode),
    statusIdx: index('idx_operators_status').on(table.status),
  })
);

export type OperatorRecord = typeof operators.$inferSelect;
export type NewOperatorRecord = typeof operators.$inferInsert;
