import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { operators } from './operators.js';
import { users } from './users.js';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => operators.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_audit_logs_tenant').on(table.tenantId),
    userIdx: index('idx_audit_logs_user').on(table.userId),
    actionIdx: index('idx_audit_logs_action').on(table.action),
    createdAtIndex: index('idx_audit_logs_created_at').on(table.createdAt),
  })
);

export type AuditLogRecord = typeof auditLogs.$inferSelect;
export type NewAuditLogRecord = typeof auditLogs.$inferInsert;
