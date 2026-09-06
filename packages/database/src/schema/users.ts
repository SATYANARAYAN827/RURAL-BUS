import { pgTable, uuid, varchar, text, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['PASSENGER', 'PLATFORM_ADMIN']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).unique(),
    phone: varchar('phone', { length: 20 }).unique(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    developmentPassword: text('development_password'),
    role: userRoleEnum('role').default('PASSENGER').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    mustChangePassword: boolean('must_change_password').default(false).notNull(),
    phoneVerified: boolean('phone_verified').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    phoneIdx: index('idx_users_phone').on(table.phone),
    roleIdx: index('idx_users_role').on(table.role),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
