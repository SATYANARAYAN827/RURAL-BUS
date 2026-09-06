import { and, eq, sql } from 'drizzle-orm';
import { db, withTenant, trips, routes, stops, tripTrajectories } from '@ruralbus/database';
import { NotFoundError, BadRequestError } from '../errors/AppError.js';
import type { TrajectoryPoint, TripTrajectoryResponse } from '@ruralbus/shared-types';

// In-memory trajectory buffer: tripId -> Array<TrajectoryPoint>
const trajectoryBuffers = new Map<string, TrajectoryPoint[]>();

/**
 * Appends a high-frequency GPS ping to the trip's live trajectory buffer.
 */
export function recordTrajectoryPoint(tripId: string, point: TrajectoryPoint): void {
  if (!trajectoryBuffers.has(tripId)) {
    trajectoryBuffers.set(tripId, []);
  }
  const buffer = trajectoryBuffers.get(tripId)!;
  buffer.push(point);

  // Keep up to 10,000 pings per trip in buffer
  if (buffer.length > 10000) {
    buffer.shift();
  }
}

/**
 * Calculates perpendicular distance from a point to a line segment (in coordinates space).
 */
function perpendicularDistance(
  point: TrajectoryPoint,
  lineStart: TrajectoryPoint,
  lineEnd: TrajectoryPoint
): number {
  let dx = lineEnd.longitude - lineStart.longitude;
  let dy = lineEnd.latitude - lineStart.latitude;

  // Normalize
  const mag = Math.hypot(dx, dy);
  if (mag > 0.0) {
    dx /= mag;
    dy /= mag;
  }

  const pvx = point.longitude - lineStart.longitude;
  const pvy = point.latitude - lineStart.latitude;

  // Dot product
  const pvdot = dx * pvx + dy * pvy;

  // Scale vector
  const dsx = pvdot * dx;
  const dsy = pvdot * dy;

  // Vector from point to projection
  const ax = pvx - dsx;
  const ay = pvy - dsy;

  return Math.hypot(ax, ay);
}

/**
 * Ramer-Douglas-Peucker (RDP) trajectory simplification algorithm.
 */
export function simplifyTrajectoryRDP(
  points: TrajectoryPoint[],
  epsilon: number = 0.00015 // ~15 meters in latitude/longitude
): TrajectoryPoint[] {
  if (points.length <= 2) {
    return points;
  }

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    // Recursive simplification
    const recResults1 = simplifyTrajectoryRDP(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyTrajectoryRDP(points.slice(index), epsilon);

    return recResults1.slice(0, -1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Calculates total geodesic distance (km) between consecutive coordinates using Haversine formula.
 */
export function calculateTotalDistanceKm(points: Array<{ latitude: number; longitude: number }>): number {
  let totalKm = 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dLat = toRad(p2.latitude - p1.latitude);
    const dLon = toRad(p2.longitude - p1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }

  return Math.round(totalKm * 100) / 100;
}

/**
 * Finalizes and compresses GPS telemetry when a trip is completed, saving to PostgreSQL trip_trajectories.
 */
export async function finalizeTripTrajectory(
  tenantId: string,
  tripId: string
): Promise<TripTrajectoryResponse> {
  const rawPoints = trajectoryBuffers.get(tripId) || [];

  return await withTenant(tenantId, async (tx) => {
    // 1. If buffer is empty, construct nominal trajectory from route stops
    let pointsToCompress: TrajectoryPoint[] = rawPoints;

    if (pointsToCompress.length < 2) {
      const [trip] = await tx
        .select({
          routeStops: routes.stopsData,
        })
        .from(trips)
        .innerJoin(routes, eq(trips.routeId, routes.id))
        .where(and(eq(trips.id, tripId), eq(trips.tenantId, tenantId)));

      if (trip && trip.routeStops && trip.routeStops.length >= 2) {
        const stopIds = trip.routeStops.map((s) => s.stopId);
        const stopsList = await tx.select().from(stops).where(eq(stops.tenantId, tenantId));
        const stopMap = new Map(stopsList.map((s) => [s.id, s]));

        pointsToCompress = trip.routeStops
          .map((s, idx) => {
            const stop = stopMap.get(s.stopId);
            if (!stop) return null;
            return {
              latitude: stop.latitude,
              longitude: stop.longitude,
              speed: 0,
              heading: 0,
              timestamp: Date.now() - (trip.routeStops.length - idx) * 60000,
            };
          })
          .filter((p): p is TrajectoryPoint => p !== null);
      }
    }

    if (pointsToCompress.length < 2) {
      // Do not invent fake coordinates (no synthetic Mysore/Bangalore demo coordinates)
      trajectoryBuffers.delete(tripId);
      return {
        tripId,
        totalDistanceKm: 0,
        totalPoints: pointsToCompress.length,
        simplifiedPoints: pointsToCompress.length,
        compressionRatioPercent: 0,
        polyline: pointsToCompress.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
        })),
        completedAt: new Date().toISOString(),
      };
    }

    // 2. Simplify trajectory via RDP algorithm
    const simplified = simplifyTrajectoryRDP(pointsToCompress, 0.00015);
    const totalDistanceKm = calculateTotalDistanceKm(simplified);

    const polylineData = simplified.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.timestamp,
    }));

    // PostGIS LineString geometry GeoJSON
    const lineStringCoordinates = simplified.map((p) => `[${p.longitude}, ${p.latitude}]`).join(', ');
    const geoJsonString = `{"type":"LineString","coordinates":[${lineStringCoordinates}]}`;

    // 3. Upsert into trip_trajectories
    const [savedTrajectory] = await tx
      .insert(tripTrajectories)
      .values({
        tenantId,
        tripId,
        totalDistanceKm,
        totalPoints: pointsToCompress.length,
        simplifiedPolyline: polylineData,
        trajectoryGeometry: sql`ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)`,
      })
      .onConflictDoUpdate({
        target: tripTrajectories.tripId,
        set: {
          totalDistanceKm,
          totalPoints: pointsToCompress.length,
          simplifiedPolyline: polylineData,
          trajectoryGeometry: sql`ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonString}), 4326)`,
          completedAt: new Date(),
        },
      })
      .returning();

    // Clean buffer from memory
    trajectoryBuffers.delete(tripId);

    const compressionRatioPercent =
      pointsToCompress.length > 0
        ? Math.round((1 - simplified.length / pointsToCompress.length) * 100)
        : 0;

    return {
      tripId,
      totalDistanceKm,
      totalPoints: pointsToCompress.length,
      simplifiedPoints: simplified.length,
      compressionRatioPercent,
      polyline: polylineData,
      completedAt: savedTrajectory.completedAt.toISOString(),
    };
  });
}

/**
 * Retrieves compressed trajectory for a completed trip.
 */
export async function getTripTrajectory(
  tenantId: string,
  tripId: string
): Promise<TripTrajectoryResponse> {
  return await withTenant(tenantId, async (tx) => {
    const [record] = await tx
      .select()
      .from(tripTrajectories)
      .where(and(eq(tripTrajectories.tripId, tripId), eq(tripTrajectories.tenantId, tenantId)));

    if (!record) {
      throw new NotFoundError('Trajectory not found for this trip');
    }

    const simplifiedPoints = record.simplifiedPolyline.length;
    const totalPoints = record.totalPoints;
    const compressionRatioPercent =
      totalPoints > 0 ? Math.round((1 - simplifiedPoints / totalPoints) * 100) : 0;

    return {
      tripId: record.tripId,
      totalDistanceKm: record.totalDistanceKm,
      totalPoints,
      simplifiedPoints,
      compressionRatioPercent,
      polyline: record.simplifiedPolyline,
      completedAt: record.completedAt.toISOString(),
    };
  });
}
