import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import type { AppUserRole } from '@ruralbus/shared-types';

export interface RefreshTokenSessionData {
  userId: string;
  role: AppUserRole;
  tenantId: string | null;
  email: string | null;
  phone: string | null;
  fullName: string;
  createdAt: number;
}

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 100, 2000);
      },
    });

    redisClient.on('error', (err) => {
      // Avoid crash on unhandled error events in dev/test
      if (env.NODE_ENV !== 'test') {
        console.error('Redis connection error:', err);
      }
    });
  }

  return redisClient;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Saves a refresh token session in Redis with TTL.
 * Default TTL is 30 days (2,592,000 seconds).
 */
export async function saveRefreshToken(
  token: string,
  sessionData: RefreshTokenSessionData,
  ttlSeconds = 30 * 24 * 3600
): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `auth:refresh:${hashToken(token)}`;
    await redis.set(key, JSON.stringify(sessionData), 'EX', ttlSeconds);
  } catch (err) {
    if (env.NODE_ENV !== 'test') console.warn('Redis saveRefreshToken failed:', err);
  }
}

/**
 * Retrieves a refresh token session from Redis.
 */
export async function getRefreshToken(token: string): Promise<RefreshTokenSessionData | null> {
  try {
    const redis = getRedisClient();
    const key = `auth:refresh:${hashToken(token)}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as RefreshTokenSessionData;
  } catch {
    return null;
  }
}

/**
 * Revokes a refresh token from Redis.
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `auth:refresh:${hashToken(token)}`;
    const count = await redis.del(key);
    return count > 0;
  } catch {
    return false;
  }
}

// ==========================================
// REDIS GEOSPATIAL & TELEMETRY ACCELERATORS
// ==========================================

export async function updateFleetGeo(
  tenantId: string,
  busId: string,
  longitude: number,
  latitude: number
): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `geo:fleet:${tenantId}`;
    await redis.geoadd(key, longitude, latitude, busId);
    await redis.expire(key, 86400); // 24 hours TTL
  } catch (err) {
    // Non-fatal if Redis is unreachable in mock/isolated tests
  }
}

// ==========================================
// REDIS FAST-PATH SEAT HOLD
// ==========================================

export async function setFastSeatHold(
  tripId: string,
  seatNumber: number,
  passengerId: string,
  ttlSeconds = 300
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `hold:trip:${tripId}:seat:${seatNumber}`;
    // SET key value NX EX ttl -> returns 'OK' if key set, null if key already exists
    const result = await redis.set(key, passengerId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    // Fail-open to allow Postgres authoritative lock to enforce constraint if Redis fails
    return true;
  }
}

export async function releaseFastSeatHold(
  tripId: string,
  seatNumber: number
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `hold:trip:${tripId}:seat:${seatNumber}`;
    const count = await redis.del(key);
    return count > 0;
  } catch {
    return false;
  }
}

export async function isSeatFastHeld(
  tripId: string,
  seatNumber: number
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `hold:trip:${tripId}:seat:${seatNumber}`;
    const exists = await redis.exists(key);
    return exists > 0;
  } catch {
    return false;
  }
}

/**
 * Closes the Redis connection cleanly during server shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore errors on close
    }
    redisClient = null;
  }
}
