import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().default('postgresql://ruralbus_app:app_secure_password@localhost:5432/ruralbus'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    JWT_SECRET: z.string().default('super_secret_jwt_signing_key_at_least_32_characters_long_for_dev'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
    PAYMENTS_MODE: z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    MAP_PROVIDER: z.enum(['mock', 'mapbox', 'google']).default('mock'),
    ADMIN_WEB_URL: z.string().default('http://localhost:5173'),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return (
          data.JWT_SECRET !== 'super_secret_jwt_signing_key_at_least_32_characters_long_for_dev' &&
          data.JWT_SECRET.length >= 32
        );
      }
      return true;
    },
    {
      message: 'In production, JWT_SECRET must be configured with a unique secret of at least 32 characters',
      path: ['JWT_SECRET'],
    }
  );

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables configuration:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = loadEnv();
