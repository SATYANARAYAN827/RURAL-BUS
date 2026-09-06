import { describe, it, expect } from 'vitest';
import { db, sql, withTenant, withSystemContext } from '../src/index.js';
import * as schema from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('PostgreSQL Schema & Relational Integrity', () => {
  it('should verify PostGIS extension is installed and active', async () => {
    const result = await db.execute(sql`SELECT PostGIS_Version() as version;`);
    expect(result.rows.length).toBeGreaterThan(0);
    const version = (result.rows[0] as { version: string }).version;
    expect(version).toContain('3.');
  });

  it('should read seeded operator and relational staff members', async () => {
    const [operator] = await db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.businessCode, 'KAVERI-EXP'));

    expect(operator).toBeDefined();
    expect(operator.companyName).toBe('Kaveri Express Rural Transport');
    expect(operator.status).toBe('ACTIVE');

    const members = await withTenant(operator.id, async (tx) => {
      return tx
        .select()
        .from(schema.operatorMembers)
        .where(eq(schema.operatorMembers.tenantId, operator.id));
    });

    expect(members.length).toBeGreaterThanOrEqual(3);
    const roles = members.map((m) => m.role);
    expect(roles).toContain('OPERATOR_ADMIN');
    expect(roles).toContain('DRIVER');
    expect(roles).toContain('CONDUCTOR');
  });

  it('should verify registered fleet buses and amenities jsonb', async () => {
    const [operator] = await db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.businessCode, 'KAVERI-EXP'));

    const buses = await withTenant(operator.id, async (tx) => {
      return tx.select().from(schema.buses);
    });
    expect(buses.length).toBeGreaterThan(0);

    const bus = buses.find((b) => b.registrationNumber === 'KA-01-F-2040');
    expect(bus).toBeDefined();
    expect(bus?.totalSeats).toBe(40);
    expect(bus?.seatingType).toBe('SEATER_2X2');
    expect(bus?.amenities).toContain('GPS Telemetry Tracker');
  });

  it('should verify route structure and stops_data jsonb', async () => {
    const [operator] = await db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.businessCode, 'KAVERI-EXP'));

    const [route] = await withTenant(operator.id, async (tx) => {
      return tx
        .select()
        .from(schema.routes)
        .where(eq(schema.routes.routeCode, 'BLR-MYS-01'));
    });

    expect(route).toBeDefined();
    expect(route.origin).toBe('Bangalore');
    expect(route.destination).toBe('Mysore');
    expect(route.stopsData.length).toBe(3);
    expect(route.stopsData[0].stopName).toBe('Bangalore Majestic Central');
    expect(route.stopsData[2].stopName).toBe('Mysore Suburban Bus Terminal');
  });

  it('should verify scheduled trip, confirmed booking, and ticket link', async () => {
    const [operator] = await db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.businessCode, 'KAVERI-EXP'));

    const trips = await withTenant(operator.id, async (tx) => {
      return tx.select().from(schema.trips);
    });
    expect(trips.length).toBeGreaterThan(0);
    const trip = trips[0];

    const bookings = await withTenant(operator.id, async (tx) => {
      return tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.tripId, trip.id));
    });
    expect(bookings.length).toBeGreaterThan(0);
    const booking = bookings[0];
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.seatNumber).toBe(12);

    const tickets = await withTenant(operator.id, async (tx) => {
      return tx
        .select()
        .from(schema.tickets)
        .where(eq(schema.tickets.bookingId, booking.id));
    });
    expect(tickets.length).toBe(1);
    expect(tickets[0].status).toBe('VALID');
    expect(tickets[0].qrSignature).toContain('JWS_ED25519');
  });

  it('should enforce cascade deletion from tenant down to child records', async () => {
    let tempOperatorId = '';
    let tempBusId = '';

    await withSystemContext(async (tx) => {
      // Create temporary test tenant
      const [tempOperator] = await tx
        .insert(schema.operators)
        .values({
          companyName: 'Test Temporary Operator',
          businessCode: `TEMP-TEST-${Date.now()}`,
          contactEmail: 'temp@test.com',
          contactPhone: '9999999999',
          status: 'ACTIVE',
        })
        .returning();
      tempOperatorId = tempOperator.id;

      // Create temporary bus under test tenant
      const [tempBus] = await tx
        .insert(schema.buses)
        .values({
          tenantId: tempOperator.id,
          registrationNumber: `TEMP-BUS-${Date.now()}`,
          model: 'Test Bus',
          totalSeats: 20,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      tempBusId = tempBus.id;
    });

    expect(tempBusId).toBeDefined();

    // Delete temporary operator
    await db
      .delete(schema.operators)
      .where(eq(schema.operators.id, tempOperatorId));

    // Verify cascaded deletion of bus
    const busCheck = await withSystemContext(async (tx) => {
      return tx
        .select()
        .from(schema.buses)
        .where(eq(schema.buses.id, tempBusId));
    });
    expect(busCheck.length).toBe(0);
  });
});
