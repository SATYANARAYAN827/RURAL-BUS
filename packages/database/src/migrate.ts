import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🚀 Running PostgreSQL & PostGIS migrations...');
  const migrationsFolder = path.resolve(__dirname, '../drizzle');
  
  try {
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigrations()
  .then(() => {
    console.log('Migration process completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration process failed:', err);
    process.exit(1);
  });
