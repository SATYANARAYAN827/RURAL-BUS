import { withSystemContext } from '../index.js';
import * as schema from '../schema/index.js';
import { eq, or, and, inArray } from 'drizzle-orm';

export async function seed() {
  console.log('🌱 Starting RuralBus database seed...');

  return withSystemContext(async (tx) => {
    // 1. Create or retrieve Operator (Tenant)
    const existingOperators = await tx
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.businessCode, 'KAVERI-EXP'))
      .limit(1);

    let operator = existingOperators[0];
    if (!operator) {
      const [newOp] = await tx
        .insert(schema.operators)
        .values({
          companyName: 'Kaveri Express Rural Transport',
          businessCode: 'KAVERI-EXP',
          contactEmail: 'admin@kaveribus.com',
          contactPhone: '9876543210',
          status: 'ACTIVE',
        })
        .returning();
      operator = newOp;
    }

    const tenantId = operator.id;
    console.log(`✅ Operator tenant ready: Kaveri Express (${tenantId})`);

    // 2. Real Argon2id hash for 'Password123!' (OWASP recommended parameters: m=65536, t=3, p=4)
    const defaultPasswordHash =
      '$argon2id$v=19$m=65536,t=3,p=4$hK5lSeRKF+xm0QpoG1155w$2D8MA2a6EQhW6tM3SmC6F0ns11VmZ3jMOR5Jb1iktXs';

    // Development password helper: populated ONLY in development / test environments, strictly NULL in production
    const getDevelopmentPassword = (rawPassword: string): string | null => {
      return process.env.NODE_ENV === 'production' ? null : rawPassword;
    };

    const seedUsersData = [
      {
        fullName: 'State Transport Super Admin',
        email: 'superadmin@ruralbus.gov.in',
        phone: '9876500000',
        role: 'PLATFORM_ADMIN' as const,
        staffRole: null,
      },
      {
        fullName: 'Rajesh Sharma',
        email: 'rajesh.passenger@ruralbus.com',
        phone: '9876500001',
        role: 'PASSENGER' as const,
        staffRole: null,
      },
      {
        fullName: 'Suresh Kumar',
        email: 'suresh.admin@kaveribus.com',
        phone: '9876500002',
        role: 'PASSENGER' as const,
        staffRole: 'OPERATOR_ADMIN' as const,
      },
      {
        fullName: 'Ramesh Singh (Driver)',
        email: 'ramesh.driver@kaveribus.com',
        phone: '9876543210',
        role: 'PASSENGER' as const,
        staffRole: 'DRIVER' as const,
      },
      {
        fullName: 'Ramesh Singh (Driver Backup)',
        email: 'ramesh.backup@kaveribus.com',
        phone: '9876500003',
        role: 'PASSENGER' as const,
        staffRole: 'DRIVER' as const,
      },
      {
        fullName: 'Vijay Patel (Conductor)',
        email: 'vijay.conductor@kaveribus.com',
        phone: '9876500004',
        role: 'PASSENGER' as const,
        staffRole: 'CONDUCTOR' as const,
      },
    ];

    for (const u of seedUsersData) {
      const existing = await tx
        .select()
        .from(schema.users)
        .where(
          or(
            eq(schema.users.phone, u.phone),
            eq(schema.users.email, u.email)
          )
        )
        .limit(1);

      let userId: string;

      if (existing.length > 0) {
        userId = existing[0].id;
        // Update user with valid Argon2id hash, development password in dev mode, phone, and email
        await tx
          .update(schema.users)
          .set({
            fullName: u.fullName,
            phone: u.phone,
            email: u.email,
            passwordHash: defaultPasswordHash,
            developmentPassword: getDevelopmentPassword('Password123!'),
            mustChangePassword: false,
            phoneVerified: true,
            isActive: true,
          })
          .where(eq(schema.users.id, userId));
        console.log(`🔄 Updated user password hash & details: ${u.fullName} (${u.phone})`);
      } else {
        const [newUser] = await tx
          .insert(schema.users)
          .values({
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            passwordHash: defaultPasswordHash,
            developmentPassword: getDevelopmentPassword('Password123!'),
            role: u.role,
            mustChangePassword: false,
            phoneVerified: true,
            isActive: true,
          })
          .returning();
        userId = newUser.id;
        console.log(`✅ Created user: ${u.fullName} (${u.phone})`);
      }

      // Assign staff membership if applicable
      if (u.staffRole) {
        const existingMember = await tx
          .select()
          .from(schema.operatorMembers)
          .where(eq(schema.operatorMembers.userId, userId))
          .limit(1);

        if (existingMember.length === 0) {
          await tx.insert(schema.operatorMembers).values({
            userId,
            tenantId,
            role: u.staffRole,
            isActive: true,
          });
          console.log(`✅ Assigned staff role ${u.staffRole} to user ${u.fullName}`);
        } else {
          await tx
            .update(schema.operatorMembers)
            .set({
              tenantId,
              role: u.staffRole,
              isActive: true,
            })
            .where(eq(schema.operatorMembers.userId, userId));
        }
      }
    }

    // 4. Clean up legacy demo records (trips, routes, stops, demo buses)
    const demoStopCodes = ['BULA', 'RMNA', 'JPRD', 'DHMR', 'AGRP', 'BDRK'];
    const demoBusRegs = ['OD-22-B-4521', 'OD-22-C-8910', 'OD-22-D-1122', 'RB-01-F-2040'];

    const legacyRoutes = await tx
      .select()
      .from(schema.routes)
      .where(
        or(
          eq(schema.routes.routeCode, 'Route 12'),
          eq(schema.routes.origin, 'Boula'),
          eq(schema.routes.destination, 'Bhadrak Central')
        )
      );

    const legacyBuses = await tx
      .select()
      .from(schema.buses)
      .where(inArray(schema.buses.registrationNumber, demoBusRegs));

    const legacyRouteIds = legacyRoutes.map((r) => r.id);
    const legacyBusIds = legacyBuses.map((b) => b.id);

    if (legacyRouteIds.length > 0 || legacyBusIds.length > 0) {
      const tripConditions = [];
      if (legacyRouteIds.length > 0) {
        tripConditions.push(inArray(schema.trips.routeId, legacyRouteIds));
      }
      if (legacyBusIds.length > 0) {
        tripConditions.push(inArray(schema.trips.busId, legacyBusIds));
      }
      await tx.delete(schema.trips).where(or(...tripConditions));
      console.log('🧹 Cleaned legacy demo trips');
    }

    // Clear any active/scheduled trips for driver Ramesh Singh so "No Duty Assigned" displays honestly
    const [driverUser] = await tx
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'ramesh.driver@kaveribus.com'))
      .limit(1);

    if (driverUser) {
      await tx.delete(schema.trips).where(eq(schema.trips.driverId, driverUser.id));
      console.log(`🧹 Cleared assigned duties for driver ${driverUser.fullName}`);
    }

    if (legacyRouteIds.length > 0) {
      await tx.delete(schema.routes).where(inArray(schema.routes.id, legacyRouteIds));
      console.log('🧹 Cleaned legacy demo routes');
    }

    if (legacyBusIds.length > 0) {
      await tx.delete(schema.buses).where(inArray(schema.buses.id, legacyBusIds));
      console.log('🧹 Cleaned legacy demo buses');
    }

    await tx.delete(schema.stops).where(inArray(schema.stops.code, demoStopCodes));
    console.log('🧹 Cleaned legacy demo stops');

    console.log('🎉 RuralBus database seed finished successfully!');
  });
}

// Execute seed if executed directly
if (process.argv[1]?.includes('seeds') || process.argv[1]?.includes('seed')) {
  seed()
    .then(() => {
      console.log('Seed completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}
