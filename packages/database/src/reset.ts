import { db, withSystemContext } from './index.js';
import * as schema from './schema/index.js';
import { ne, eq } from 'drizzle-orm';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { assertResetAllowed } from './reset-guard.js';
export { assertResetAllowed };

async function run() {
  assertResetAllowed();
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://ruralbus_app:app_secure_password@localhost:5432/ruralbus' });
  try { await pool.query("ALTER TYPE bus_status ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' BEFORE 'ACTIVE'"); console.log('Enum OK'); } catch(e: any) { console.log('Enum:', e?.message || e); } finally { await pool.end(); }

  await withSystemContext(async (tx) => {
    for (const tbl of [schema.tickets, schema.bookings, schema.tripTrajectories, schema.trips, schema.schedules, schema.routes, schema.stops, schema.buses, schema.operatorMembers, schema.operators, schema.otpVerifications, schema.auditLogs]) {
      await tx.delete(tbl);
    }
    console.log('Tables cleared');
    const del = await tx.delete(schema.users).where(ne(schema.users.role, 'PLATFORM_ADMIN')).returning({ n: schema.users.fullName });
    console.log('Deleted', del.length, 'demo users');
    const adm = await tx.select().from(schema.users).where(eq(schema.users.role, 'PLATFORM_ADMIN'));
    if (!adm.length) {
      const h = '=19=65536,t=3,p=4+xm0QpoG1155w';
      await tx.insert(schema.users).values({ fullName:'State Transport Super Admin', email:'superadmin@ruralbus.gov.in', phone:'9876500000', passwordHash:h, developmentPassword:'Password123!', role:'PLATFORM_ADMIN', isActive:true, mustChangePassword:false, phoneVerified:true });
      console.log('Created super admin 9876500000');
    } else {
      await tx.update(schema.users).set({ isActive:true, mustChangePassword:false }).where(eq(schema.users.role,'PLATFORM_ADMIN'));
      console.log('Kept:', adm[0].fullName, adm[0].phone);
    }
  });
  console.log('DONE - Login: 9876500000 / Password123!');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
