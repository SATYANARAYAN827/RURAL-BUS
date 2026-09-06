import { and, eq } from 'drizzle-orm';
import { db, withTenant, trips, buses, routes, users } from '@ruralbus/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors/AppError.js';
import { updateFleetGeo } from './redis.service.js';
import { recordTrajectoryPoint } from './trajectory.service.js';
import type {
  GpsPingPayload,
  LiveTripLocation,
  LiveFleetBus,
  LiveFleetRadarResponse,
  WebSocketMessage,
} from '@ruralbus/shared-types';

// GPS ping validation constants
const MAX_FUTURE_TIMESTAMP_MS = 5 * 60 * 1000;      // 5 minutes ahead
const MAX_PAST_TIMESTAMP_MS   = 24 * 60 * 60 * 1000; // 24 hours behind

// Passenger freshness thresholds
const LIVE_THRESHOLD_MS  = 30 * 1000;      // < 30s = LIVE
const STALE_THRESHOLD_MS = 3 * 60 * 1000;  // 30s-3m = STALE, >3m = OFFLINE

// In-memory telemetry cache: tripId -> LiveTripLocation (with receivedAt for staleness)
const liveLocationsCache = new Map<string, LiveTripLocation & { receivedAt: number }>();

// Last ping timestamps for rate limiting: tripId -> server timestamp
const lastPingTimestamps = new Map<string, number>();

// In-memory WebSocket room subscribers
// tripId -> Set of WebSocket clients
const tripSubscribers = new Map<string, Set<any>>();
// tenantId -> Set of WebSocket clients
const fleetSubscribers = new Map<string, Set<any>>();

export function subscribeToTrip(tripId: string, socket: any): void {
  if (!tripSubscribers.has(tripId)) {
    tripSubscribers.set(tripId, new Set());
  }
  tripSubscribers.get(tripId)!.add(socket);
}

export function unsubscribeFromTrip(tripId: string, socket: any): void {
  const subs = tripSubscribers.get(tripId);
  if (subs) {
    subs.delete(socket);
    if (subs.size === 0) {
      tripSubscribers.delete(tripId);
    }
  }
}

export function subscribeToFleet(tenantId: string, socket: any): void {
  if (!fleetSubscribers.has(tenantId)) {
    fleetSubscribers.set(tenantId, new Set());
  }
  fleetSubscribers.get(tenantId)!.add(socket);
}

export function unsubscribeFromFleet(tenantId: string, socket: any): void {
  const subs = fleetSubscribers.get(tenantId);
  if (subs) {
    subs.delete(socket);
    if (subs.size === 0) {
      fleetSubscribers.delete(tenantId);
    }
  }
}

export function cleanupSocket(socket: any): void {
  for (const [tripId, subs] of tripSubscribers.entries()) {
    subs.delete(socket);
    if (subs.size === 0) tripSubscribers.delete(tripId);
  }
  for (const [tenantId, subs] of fleetSubscribers.entries()) {
    subs.delete(socket);
    if (subs.size === 0) fleetSubscribers.delete(tenantId);
  }
}

/**
 * Evicts a completed/cancelled trip from the live cache.
 * Must be called from endDriverTrip in duty.service.ts.
 */
export function clearLiveTripCache(tripId: string): void {
  liveLocationsCache.delete(tripId);
  lastPingTimestamps.delete(tripId);
}

function broadcastToTripSubscribers(tripId: string, message: WebSocketMessage): void {
  const subs = tripSubscribers.get(tripId);
  if (subs) {
    const raw = JSON.stringify(message);
    for (const socket of subs) {
      try {
        if (socket.readyState === 1 /* OPEN */) {
          socket.send(raw);
        }
      } catch {
        // Socket send error
      }
    }
  }
}

function broadcastToFleetSubscribers(tenantId: string, message: WebSocketMessage): void {
  const subs = fleetSubscribers.get(tenantId);
  if (subs) {
    const raw = JSON.stringify(message);
    for (const socket of subs) {
      try {
        if (socket.readyState === 1 /* OPEN */) {
          socket.send(raw);
        }
      } catch {
        // Socket send error
      }
    }
  }
}

/**
 * Ingests a high-frequency GPS ping from a driver.
 */
export async function processGpsPing(
  tenantId: string,
  driverUserId: string,
  payload: GpsPingPayload
): Promise<{ tripLocation: LiveTripLocation; fleetBus: LiveFleetBus }> {
  // 1. Authoritative verification of trip and tenant ownership FIRST
  const [trip] = await withTenant(tenantId, async (tx) => {
    return tx
      .select({
        id: trips.id,
        busId: trips.busId,
        routeId: trips.routeId,
        driverId: trips.driverId,
        status: trips.status,
        busRegistration: buses.registrationNumber,
        routeCode: routes.routeCode,
        driverName: users.fullName,
      })
      .from(trips)
      .innerJoin(buses, eq(trips.busId, buses.id))
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(users, eq(trips.driverId, users.id))
      .where(and(eq(trips.id, payload.tripId), eq(trips.tenantId, tenantId)));
  });

  if (!trip) {
    throw new NotFoundError('Trip not found or does not belong to your tenant');
  }

  if (trip.driverId !== driverUserId) {
    throw new ForbiddenError('You are not the designated driver for this trip');
  }

  // Trip status gate — only active trips may receive GPS pings (BOARDING is pre-departure)
  if (trip.status !== 'IN_TRANSIT') {
    throw new BadRequestError(
      `GPS ping rejected: trip status is '${trip.status}'. Only IN_TRANSIT trips accept GPS pings.`
    );
  }

  const now = Date.now();
  const pingTimestamp = payload.timestamp ?? now;

  if (pingTimestamp > now + MAX_FUTURE_TIMESTAMP_MS) {
    throw new BadRequestError('GPS ping timestamp is too far in the future (> 5m)');
  }
  if (pingTimestamp < now - MAX_PAST_TIMESTAMP_MS) {
    throw new BadRequestError('GPS ping timestamp is too far in the past (> 24h)');
  }

  const cached = liveLocationsCache.get(payload.tripId);
  // Out-of-order ping check: if an incoming ping is older than the current cached timestamp, ignore it
  if (cached && payload.timestamp && payload.timestamp < cached.timestamp) {
    return {
      tripLocation: cached,
      fleetBus: {
        busId: cached.busId,
        registrationNumber: trip.busRegistration,
        tripId: cached.tripId,
        routeCode: cached.routeCode,
        driverName: trip.driverName,
        latitude: cached.latitude,
        longitude: cached.longitude,
        speed: cached.speed,
        heading: cached.heading,
        lastPingAt: cached.lastUpdated,
        status: trip.status as any,
      },
    };
  }

  const lastPing = lastPingTimestamps.get(payload.tripId) || 0;

  // Rate limit check after verification
  if (now - lastPing < 1000) {
    if (cached) {
      return {
        tripLocation: cached,
        fleetBus: {
          busId: cached.busId,
          registrationNumber: trip.busRegistration,
          tripId: cached.tripId,
          routeCode: cached.routeCode,
          driverName: trip.driverName,
          latitude: cached.latitude,
          longitude: cached.longitude,
          speed: cached.speed,
          heading: cached.heading,
          lastPingAt: cached.lastUpdated,
          status: 'IN_TRANSIT',
        },
      };
    }
  }

  lastPingTimestamps.set(payload.tripId, now);

  const speed = payload.speed ?? 0;
  const heading = payload.heading ?? 0;
  const timestamp = pingTimestamp;
  const lastUpdated = new Date(timestamp).toISOString();

  const tripLocation: LiveTripLocation = {
    tripId: trip.id,
    busId: trip.busId,
    routeCode: trip.routeCode,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed,
    heading,
    timestamp,
    lastUpdated,
  };

  const fleetBus: LiveFleetBus = {
    busId: trip.busId,
    registrationNumber: trip.busRegistration,
    tripId: trip.id,
    routeCode: trip.routeCode,
    driverName: trip.driverName,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed,
    heading,
    lastPingAt: lastUpdated,
    status: trip.status as any,
  };

  // Update in-memory location cache (include server receivedAt for freshness checks)
  liveLocationsCache.set(payload.tripId, { ...tripLocation, receivedAt: now });

  // Buffer in live trajectory for post-trip PostGIS RDP compression
  recordTrajectoryPoint(payload.tripId, {
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed,
    heading,
    timestamp,
  });

  // Update Redis Geospatial Index for fleet radar
  await updateFleetGeo(tenantId, trip.busId, payload.longitude, payload.latitude);

  // Real-time broadcast:
  // 1. To passengers subscribed to this specific trip
  broadcastToTripSubscribers(payload.tripId, {
    type: 'TRIP_LOCATION_UPDATE',
    payload: tripLocation,
  });

  // 2. To operator dispatchers subscribed to tenant fleet radar
  broadcastToFleetSubscribers(tenantId, {
    type: 'FLEET_RADAR_UPDATE',
    payload: fleetBus,
  });

  return { tripLocation, fleetBus };
}

export type GpsFreshness = 'LIVE' | 'STALE' | 'OFFLINE' | 'NO_DATA';

export interface LiveLocationResponse {
  location: LiveTripLocation | null;
  freshness: GpsFreshness;
  receivedAt: string | null;
}

/**
 * Returns the latest cached GPS location for a trip WITH a freshness status.
 * LIVE    < 30 seconds since last ping
 * STALE   30 s – 3 minutes
 * OFFLINE > 3 minutes
 * NO_DATA no ping ever received
 */
export async function getTripLiveLocation(tripId: string): Promise<LiveLocationResponse> {
  const cached = liveLocationsCache.get(tripId);
  if (!cached) {
    return { location: null, freshness: 'NO_DATA', receivedAt: null };
  }
  const ageMs = Date.now() - cached.receivedAt;
  const freshness: GpsFreshness =
    ageMs < LIVE_THRESHOLD_MS  ? 'LIVE'
    : ageMs < STALE_THRESHOLD_MS ? 'STALE'
    : 'OFFLINE';
  return {
    location: cached,
    freshness,
    receivedAt: new Date(cached.receivedAt).toISOString(),
  };
}

/**
 * Returns active live fleet positions for a transport operator.
 */
export async function getFleetRadar(tenantId: string): Promise<LiveFleetRadarResponse> {
  const activeTrips = await withTenant(tenantId, async (tx) => {
    return tx
      .select({
        id: trips.id,
        busId: trips.busId,
        busRegistration: buses.registrationNumber,
        routeCode: routes.routeCode,
        driverName: users.fullName,
        status: trips.status,
      })
      .from(trips)
      .innerJoin(buses, eq(trips.busId, buses.id))
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(users, eq(trips.driverId, users.id))
      .where(
        and(
          eq(trips.tenantId, tenantId),
          eq(trips.status, 'IN_TRANSIT')
        )
      );
  });

  const fleetBuses: LiveFleetBus[] = [];

  for (const t of activeTrips) {
    const cachedLoc = liveLocationsCache.get(t.id);
    if (cachedLoc) {
      fleetBuses.push({
        busId: t.busId,
        registrationNumber: t.busRegistration,
        tripId: t.id,
        routeCode: t.routeCode,
        driverName: t.driverName,
        latitude: cachedLoc.latitude,
        longitude: cachedLoc.longitude,
        speed: cachedLoc.speed,
        heading: cachedLoc.heading,
        lastPingAt: cachedLoc.lastUpdated,
        status: 'IN_TRANSIT',
      });
    }
  }

  return {
    tenantId,
    buses: fleetBuses,
    totalActive: fleetBuses.length,
    lastUpdated: new Date().toISOString(),
  };
}
