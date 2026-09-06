import { withSystemContext } from '../index.js';
import * as schema from '../schema/index.js';
import { eq } from 'drizzle-orm';

export async function seed() {
  console.log('🌱 Starting RuralBus database seed (Super Admin only)...');

  return withSystemContext(async (tx) => {
    // Argon2id hash for 'Password123!' (OWASP recommended parameters: m=65536, t=3, p=4)
    const defaultPasswordHash =
      '$argon2id$v=19$m=65536,t=3,p=4$hK5lSeRKF+xm0QpoG1155w$2D8MA2a6EQhW6tM3SmC6F0ns11VmZ3jMOR5Jb1iktXs';

    const [existingAdmin] = await tx
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, '9876500000'))
      .limit(1);

    if (existingAdmin) {
      await tx
        .update(schema.users)
        .set({
          fullName: 'State Transport Super Admin',
          email: 'superadmin@ruralbus.gov.in',
          role: 'PLATFORM_ADMIN',
          isActive: true,
          mustChangePassword: false,
          phoneVerified: true,
          passwordHash: defaultPasswordHash,
          developmentPassword: process.env.NODE_ENV === 'production' ? null : 'Password123!',
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existingAdmin.id));
      console.log(`✅ Super Admin updated: ${existingAdmin.phone} (ID: ${existingAdmin.id})`);
    } else {
      const [newAdmin] = await tx
        .insert(schema.users)
        .values({
          fullName: 'State Transport Super Admin',
          email: 'superadmin@ruralbus.gov.in',
          phone: '9876500000',
          role: 'PLATFORM_ADMIN',
          passwordHash: defaultPasswordHash,
          developmentPassword: process.env.NODE_ENV === 'production' ? null : 'Password123!',
          isActive: true,
          mustChangePassword: false,
          phoneVerified: true,
        })
        .returning();
      console.log(`✅ Super Admin created: ${newAdmin.phone} (ID: ${newAdmin.id})`);
    }

    console.log('🎉 RuralBus clean database seed finished successfully!');
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
