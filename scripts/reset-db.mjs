import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const currentEnv = process.env.NODE_ENV || 'development';
if (currentEnv === 'production' && process.env.ALLOW_PRODUCTION_RESET !== 'true') {
  console.error('❌ CRITICAL SAFETY ERROR: Database reset is strictly prohibited in PRODUCTION environment!');
  console.error('To explicitly override for emergency recovery, set ALLOW_PRODUCTION_RESET=true.');
  process.exit(1);
}

console.log('🔄 Triggering RuralBus database clean reset...');
try {
  execSync('pnpm --filter @ruralbus/database exec tsx src/reset.ts', {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log('✅ Database reset successfully executed.');
} catch (err) {
  console.error('❌ Failed to reset database:', err.message);
  process.exit(1);
}
