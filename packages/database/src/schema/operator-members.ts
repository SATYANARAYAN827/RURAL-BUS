import { pgTable, uuid, timestamp, boolean, pgEnum, unique, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { operators } from './operators.js';

export const operatorMemberRoleEnum = pgEnum('operator_member_role', [
  'OPERATOR_ADMIN',
  'DRIVER',
  'CONDUCTOR',
]);

export const operatorMembers = pgTable(
  'operator_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: uuid('tenant_id')
      .references(() => operators.id, { onDelete: 'cascade' })
      .notNull(),
    role: operatorMemberRoleEnum('role').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTenantUnq: unique().on(table.userId, table.tenantId),
    userIdx: index('idx_op_members_user').on(table.userId),
    tenantIdx: index('idx_op_members_tenant').on(table.tenantId),
    roleIdx: index('idx_op_members_role').on(table.tenantId, table.role),
  })
);

export type OperatorMemberRecord = typeof operatorMembers.$inferSelect;
export type NewOperatorMemberRecord = typeof operatorMembers.$inferInsert;
