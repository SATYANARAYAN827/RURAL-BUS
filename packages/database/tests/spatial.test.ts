import { describe, it, expect } from 'vitest';
import { db, sql, withSystemContext, withTenant } from '../src/index.js';
import * as schema from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('PostGIS Spatial Operations & Indexes', () => {
  it('should accurately calculate distance between Bangalore and Mysore using ST_Distance', async () => {
    const result = await withSystemContext(async (tx) => {
      return tx.execute<{ distance_km: string | number }>(sql`
        SELECT 
          round((ST_Distance(
            (SELECT location FROM stops WHERE code = 'SBC-MAJ')::geography,
            (SELECT location FROM stops WHERE code = 'MYS-SUB')::geography
          ) / 1000)::numeric, 2)::float as distance_km;
      `);
    });

    expect(result.rows.length).toBe(1);
    const distanceKm = Number(result.rows[0].distance_km);
    // Aerial distance between Bangalore and Mysore is approximately 124 km
    expect(distanceKm).toBeGreaterThan(120);
    expect(distanceKm).toBeLessThan(130);
  });

  it('should perform spatial radius search using ST_DWithin on GiST indexed location', async () => {
    // Search stops within 100 km radius of Bangalore Majestic (77.5729, 12.9774)
    const result = await withSystemContext(async (tx) => {
      return tx.execute<{ name: string; code: string }>(sql`
        SELECT name, code 
        FROM stops 
        WHERE ST_DWithin(
          location::geography, 
          ST_SetSRID(ST_MakePoint(77.5729, 12.9774), 4326)::geography, 
          100000
        )
        ORDER BY ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(77.5729, 12.9774), 4326)::geography);
      `);
    });

    // Bangalore (0km) and Mandya (~89km) should be found; Mysore (~124km) should be excluded
    const codes = result.rows.map((r) => r.code);
    expect(codes).toContain('SBC-MAJ');
    expect(codes).toContain('MDY-HWY');
    expect(codes).not.toContain('MYS-SUB');
  });

  it('should insert and retrieve PostGIS Point and LineString geometry with correct coordinates', async () => {
    const [operator] = await db.select().from(schema.operators).limit(1);
    expect(operator).toBeDefined();

    const testPoint = { latitude: 13.0827, longitude: 80.2707 }; // Chennai

    const testLine = {
      points: [
        { latitude: 12.9774, longitude: 77.5729 },
        { latitude: 13.0827, longitude: 80.2707 },
      ],
    };

    let testStopId = '';
    let testRouteId = '';

    await withTenant(operator.id, async (tx) => {
      // 1. Test PostGIS Point custom type
      const [testStop] = await tx
        .insert(schema.stops)
        .values({
          tenantId: operator.id,
          name: 'Test Spatial Stop',
          code: `TST-${Date.now()}`,
          latitude: testPoint.latitude,
          longitude: testPoint.longitude,
          location: testPoint,
        })
        .returning();
      testStopId = testStop.id;

      expect(testStop.location).toBeDefined();
      expect(testStop.location?.latitude).toBeCloseTo(13.0827, 4);
      expect(testStop.location?.longitude).toBeCloseTo(80.2707, 4);

      // 2. Test PostGIS LineString custom type
      const [testRoute] = await tx
        .insert(schema.routes)
        .values({
          tenantId: operator.id,
          routeCode: `BLR-CHN-${Date.now()}`,
          origin: 'Bangalore',
          destination: 'Chennai',
          totalDistanceKm: 350.0,
          estimatedDurationMinutes: 360,
          polylineCoordinates: testLine.points,
          polylineGeometry: testLine,
          stopsData: [],
        })
        .returning();
      testRouteId = testRoute.id;

      expect(testRoute.polylineGeometry).toBeDefined();
      expect(testRoute.polylineGeometry?.points.length).toBe(2);
      expect(testRoute.polylineGeometry?.points[0].latitude).toBeCloseTo(12.9774, 4);
      expect(testRoute.polylineGeometry?.points[1].latitude).toBeCloseTo(13.0827, 4);

      // Clean up test rows
      await tx.delete(schema.routes).where(eq(schema.routes.id, testRouteId));
      await tx.delete(schema.stops).where(eq(schema.stops.id, testStopId));
    });
  });
});
