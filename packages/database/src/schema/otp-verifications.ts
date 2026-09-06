import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const otpVerifications = pgTable(
  'otp_verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    otpHash: text('otp_hash').notNull(),
    purpose: varchar('purpose', { length: 50 }).notNull(), // 'FIRST_LOGIN_VERIFICATION' | 'PASSWORD_RESET'
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    resetToken: text('reset_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    phoneIdx: index('idx_otp_phone').on(table.phone),
    purposeIdx: index('idx_otp_purpose').on(table.phone, table.purpose),
    expiresIdx: index('idx_otp_expires').on(table.expiresAt),
    resetTokenIdx: index('idx_otp_reset_token').on(table.resetToken),
  })
);

export type OtpVerificationRecord = typeof otpVerifications.$inferSelect;
export type NewOtpVerificationRecord = typeof otpVerifications.$inferInsert;
