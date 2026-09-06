import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ruralbus_app:app_secure_password@localhost:5432/ruralbus',
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`SET app.bypass_rls = 'on'`);

    // Step 1: Add PENDING_APPROVAL enum value if it doesn't exist
    try {
      await client.query(`ALTER TYPE bus_status ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' BEFORE 'ACTIVE'`);
      console.log('OK: bus_status enum now has PENDING_APPROVAL');
    } catch (e) {
      console.log('Enum note:', e.message);
    }

    // Step 2: Reset all demo data
    await client.query('BEGIN');
    for (const t of ['tickets','bookings','trip_trajectories','trips','schedules','routes','stops','buses','operator_members','operators','otp_verifications','audit_logs']) {
      await client.query(`DELETE FROM ${t}`);
      console.log('Cleared: ' + t);
    }
    const del = await client.query(`DELETE FROM users WHERE role != 'PLATFORM_ADMIN' RETURNING full_name`);
    console.log(`Deleted ${del.rowCount} demo users`);

    const admin = await client.query(`SELECT full_name, phone, email FROM users WHERE role = 'PLATFORM_ADMIN'`);
    if (admin.rows.length === 0) {
      const hash = '$argon2id$v=19$m=65536,t=3,p=4$hK5lSeRKF+xm0QpoG1155w$2D8MA2a6EQhW6tM3SmC6F0ns11VmZ3jMOR5Jb1iktXs';
      await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, development_password, role, is_active, must_change_password, phone_verified)
         VALUES ('State Transport Super Admin', 'superadmin@ruralbus.gov.in', '9876500000', $1, 'Password123!', 'PLATFORM_ADMIN', true, false, true)`,
        [hash]
      );
      console.log('Created fresh super admin: 9876500000');
    } else {
      await client.query(`UPDATE users SET is_active=true, must_change_password=false, phone_verified=true WHERE role='PLATFORM_ADMIN'`);
      console.log(`Super admin preserved: ${admin.rows[0].full_name} | ${admin.rows[0].phone}`);
    }

    await client.query('COMMIT');
    console.log('\nDATABASE RESET COMPLETE');
    console.log('Login: Phone 9876500000 / Password: Password123!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('FAILED:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
