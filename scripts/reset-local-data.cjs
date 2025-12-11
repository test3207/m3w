#!/usr/bin/env node

/**
 * Reset Local Development Data
 *
 * Clears all local development data:
 * - PostgreSQL database (via Docker volume)
 * - MinIO storage (via Docker volume)
 * - Automatically runs database migrations
 *
 * Usage:
 *   node scripts/reset-local-data.cjs           # Interactive confirmation
 *   node scripts/reset-local-data.cjs --force   # Skip confirmation
 *   npm run reset                               # Via npm script
 *
 * After reset:
 *   Just run: npm run dev
 */

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  gray: (msg) => console.log(`${colors.gray}${msg}${colors.reset}`),
};

// Detect container runtime (docker or podman)
function getContainerRuntime() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return { runtime: 'docker', compose: 'docker compose' };
  } catch {
    try {
      execSync('podman info', { stdio: 'ignore' });
      return { runtime: 'podman', compose: 'podman-compose' };
    } catch {
      return null;
    }
  }
}

// Execute command and return success status
function exec(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: options.silent ? 'ignore' : 'inherit', ...options });
    return true;
  } catch {
    return false;
  }
}

// Execute command and return output
function execOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Prompt for confirmation
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// Wait for PostgreSQL to be ready
async function waitForPostgres(runtime, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    const result = spawnSync(runtime, ['exec', 'm3w-postgres', 'pg_isready', '-U', 'postgres'], {
      stdio: 'ignore',
    });
    if (result.status === 0) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  const help = args.includes('--help') || args.includes('-h');

  // Show help
  if (help) {
    console.log(`
Usage: node scripts/reset-local-data.cjs [options]

Options:
  -f, --force    Skip confirmation prompt
  -h, --help     Show this help message

Description:
  Clears all local development data by removing Docker/Podman volumes,
  restarting containers with fresh state, and running database migrations.

  This will DELETE:
    - PostgreSQL database (m3w_postgres_data volume)
    - MinIO storage (m3w_minio_data volume)
    - All uploaded music files
    - All user data and settings

After reset, just run:
  npm run dev           # Start development server
`);
    process.exit(0);
  }

  console.log('');
  log.info('========================================');
  log.info('  M3W Local Data Reset');
  log.info('========================================');
  console.log('');

  // Check container runtime
  const container = getContainerRuntime();
  if (!container) {
    log.error('❌ No container runtime found (docker/podman)');
    process.exit(1);
  }

  log.info(`Container runtime: ${container.runtime}`);
  console.log('');

  // Show warning
  log.warn('⚠️  This will DELETE all local development data:');
  log.gray('   • PostgreSQL database (m3w_postgres_data volume)');
  log.gray('   • MinIO storage (m3w_minio_data volume)');
  log.gray('   • All uploaded music files');
  log.gray('   • All user data and settings');
  console.log('');

  // Confirmation
  if (!force) {
    const confirmed = await confirm("Are you sure? Type 'yes' to confirm:");
    if (!confirmed) {
      log.info('Cancelled.');
      process.exit(0);
    }
    console.log('');
  }

  // Change to project root
  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  // Step 1: Stop containers
  log.info('📦 Stopping containers...');
  exec(`${container.compose} down`, { silent: true });
  log.success('   ✓ Containers stopped');

  // Step 2: Remove volumes
  log.info('🗑️  Removing data volumes...');
  const volumes = ['m3w_postgres_data', 'm3w_minio_data'];

  for (const vol of volumes) {
    const exists = execOutput(`${container.runtime} volume ls -q --filter name=${vol}`);
    if (exists) {
      exec(`${container.runtime} volume rm ${vol}`, { silent: true });
      log.success(`   ✓ Removed ${vol}`);
    } else {
      log.gray(`   - ${vol} (not found, skipping)`);
    }
  }

  // Step 3: Recreate containers
  log.info('🚀 Starting fresh containers...');
  if (!exec(`${container.compose} up -d`)) {
    log.error('❌ Failed to start containers');
    process.exit(1);
  }
  log.success('   ✓ Containers started');

  // Step 4: Wait for PostgreSQL
  log.info('⏳ Waiting for PostgreSQL to be ready...');
  const pgReady = await waitForPostgres(container.runtime);
  if (pgReady) {
    log.success('   ✓ PostgreSQL is ready');
  } else {
    log.warn('   ⚠ PostgreSQL health check timed out (may still be starting)');
  }

  // Step 5: Run database migrations
  log.info('🗄️  Running database migrations...');
  const backendDir = path.join(projectRoot, 'backend');
  if (!exec('npx prisma migrate dev', { cwd: backendDir })) {
    log.error('❌ Failed to run database migrations');
    log.gray('   You can try manually: cd backend && npx prisma migrate dev');
    process.exit(1);
  }
  log.success('   ✓ Database migrations applied');

  // Done
  console.log('');
  log.success('========================================');
  log.success('  Reset Complete! 🎉');
  log.success('========================================');
  console.log('');
  log.info('Next step:');
  log.gray('   Start development server:');
  console.log('      npm run dev');
  console.log('');
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
