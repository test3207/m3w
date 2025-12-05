#!/usr/bin/env node

/**
 * M3W Project Setup Script
 *
 * Cross-platform setup script that works on Windows, macOS, and Linux.
 * Replaces setup.ps1 and setup.sh with a single Node.js implementation.
 *
 * Features:
 *   - Installs npm dependencies (all workspaces)
 *   - Creates .env files from templates (backend/.env, frontend/.env)
 *   - Starts infrastructure containers (PostgreSQL, MinIO)
 *   - Runs database migrations
 *   - Auto-detects container runtime (Docker or Podman)
 *
 * Usage:
 *   node scripts/setup.cjs              # Full setup
 *   node scripts/setup.cjs --skip-env   # Skip environment file creation
 *   node scripts/setup.cjs --help       # Show help
 *
 * npm scripts:
 *   npm run setup                       # Full setup
 *   npm run setup:skip-env              # Skip env file creation
 *
 * Prerequisites (install before running this script):
 *   - Node.js 25+ (https://nodejs.org/)
 *   - Docker Desktop or Podman Desktop
 *   - For Podman: pip install podman-compose
 *
 * Related scripts:
 *   - setup-lan.cjs: Configure LAN access after setup
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  gray: (msg) => console.log(`${colors.gray}${msg}${colors.reset}`),
  blue: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  white: (msg) => console.log(`${colors.white}${msg}${colors.reset}`),
  blank: () => console.log(''),
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    skipEnv: args.includes('--skip-env'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

// Show help message
function showHelp() {
  log.info('M3W Project Setup Script');
  log.info('========================');
  log.blank();
  log.white('Usage: node scripts/setup.cjs [options]');
  log.blank();
  log.white('Options:');
  log.white('  --skip-env     Skip environment variable setup');
  log.white('  --help, -h     Show this help message');
  log.blank();
  log.white('Examples:');
  log.white('  node scripts/setup.cjs            # Full setup');
  log.white('  node scripts/setup.cjs --skip-env # Skip .env setup');
  log.white('  npm run setup                     # Via npm script');
}

// Detect OS
function getOS() {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return platform;
  }
}

// Check if a command exists
function commandExists(cmd) {
  try {
    if (os.platform() === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// Execute command with inherited stdio
function exec(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: options.silent ? 'ignore' : 'inherit', ...options });
    return true;
  } catch {
    return false;
  }
}

// Check if Podman Machine is running (Windows/macOS)
function checkPodmanMachine() {
  const platform = os.platform();
  if (platform !== 'win32' && platform !== 'darwin') {
    return true; // Linux doesn't need Podman Machine
  }

  try {
    const output = execSync('podman machine list', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (output.includes('Currently running')) {
      return true;
    }

    // Try to start Podman Machine
    log.warn('  ⚠️  Podman Machine not running');
    log.gray('    Starting Podman Machine...');
    if (exec('podman machine start', { silent: false })) {
      log.success('  ✓ Podman Machine started');
      return true;
    }
    return false;
  } catch {
    return false;
  }
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

// Copy file if destination doesn't exist
function copyIfNotExists(src, dest) {
  const projectRoot = path.resolve(__dirname, '..');
  const srcPath = path.join(projectRoot, src);
  const destPath = path.join(projectRoot, dest);

  if (!fs.existsSync(destPath)) {
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log.success(`  ✓ Created ${dest} from template`);
      return true;
    } else {
      log.warn(`  ⚠️  Template ${src} not found`);
      return false;
    }
  } else {
    log.blue(`  ℹ️  ${dest} already exists`);
    return false;
  }
}

// ============================================================================
// Setup Steps
// ============================================================================

/**
 * Check Node.js version meets minimum requirement
 */
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

  if (majorVersion >= 25) {
    log.success(`  ✓ Node.js ${nodeVersion}`);
  } else {
    log.error(`  ✗ Node.js ${nodeVersion} detected, but v25+ is required`);
    log.warn('    Please install Node.js 25 or newer: https://nodejs.org/');
    process.exit(1);
  }
}

/**
 * Detect and validate container runtime (Podman or Docker)
 * @returns {{ runtime: string, compose: string }} Container runtime info
 */
function detectContainerRuntime() {
  // Try Podman first
  if (commandExists('podman')) {
    log.success('  ✓ Podman detected');

    if (!commandExists('podman-compose')) {
      log.error('  ✗ podman-compose not found');
      log.warn('    Please install: pip install podman-compose');
      process.exit(1);
    }
    log.success('  ✓ podman-compose detected');

    if (!checkPodmanMachine()) {
      log.error('  ✗ Failed to start Podman Machine');
      process.exit(1);
    }

    return { runtime: 'podman', compose: 'podman-compose' };
  }

  // Try Docker
  if (commandExists('docker')) {
    try {
      execSync('docker info', { stdio: 'ignore' });
      log.success('  ✓ Docker detected');
      return { runtime: 'docker', compose: 'docker compose' };
    } catch {
      log.error('  ✗ Docker detected but not running');
      log.warn('    Please start Docker Desktop');
      process.exit(1);
    }
  }

  // Neither found
  log.error('  ✗ Neither Podman nor Docker found');
  log.warn('    Please install Podman Desktop: https://podman-desktop.io/');
  log.warn('    Then run: pip install podman-compose');
  process.exit(1);
}

/**
 * Install npm dependencies for all workspaces
 */
function installDependencies() {
  log.info('📦 Installing dependencies...');
  const projectRoot = path.resolve(__dirname, '..');

  const workspaces = [
    { name: 'root', cwd: projectRoot },
    { name: 'frontend', cwd: path.join(projectRoot, 'frontend') },
    { name: 'backend', cwd: path.join(projectRoot, 'backend') },
    { name: 'shared', cwd: path.join(projectRoot, 'shared') },
  ];

  for (const { name, cwd } of workspaces) {
    log.gray(`  Installing ${name} dependencies...`);
    if (!exec('npm install', { cwd })) {
      log.error(`  ✗ ${name} npm install failed`);
      process.exit(1);
    }
  }

  // Optional: Playwright browsers
  log.gray('  Installing Playwright browsers (for testing)...');
  exec('npx playwright install', { cwd: path.join(projectRoot, 'frontend') });

  log.success('  ✓ All dependencies installed');
}

/**
 * Setup environment files from templates
 * @returns {boolean} True if backend .env was newly created
 */
function setupEnvironmentFiles() {
  log.info('🔐 Setting up environment variables...');

  copyIfNotExists('.npmrc.example', '.npmrc');
  const createdBackendEnv = copyIfNotExists('backend/.env.example', 'backend/.env');
  copyIfNotExists('frontend/.env.example', 'frontend/.env');

  if (createdBackendEnv) {
    log.warn('  ⚠️  Please edit backend/.env and add your GitHub OAuth credentials');
    log.gray('     Visit: https://github.com/settings/developers');
  }

  return createdBackendEnv;
}

/**
 * Start container services
 * @param {{ runtime: string, compose: string }} container
 */
function startContainers(container) {
  log.info('🐳 Starting containers...');
  log.gray('  Using docker-compose.yml (official images)');
  log.gray('  China network tips: see docs/CHINA_REGISTRY.md');

  if (!exec(`${container.compose} -f docker-compose.yml up -d`)) {
    log.error('  ✗ Failed to start containers');
    log.warn('  💡 Tip: Check if ports 5432 or 6379 are already in use');
    process.exit(1);
  }

  log.success('  ✓ Containers started');
}

/**
 * Wait for PostgreSQL to be ready and run migrations
 * @param {string} runtime - Container runtime (podman/docker)
 */
async function setupDatabase(runtime) {
  log.info('⏳ Waiting for PostgreSQL to be ready...');

  const pgReady = await waitForPostgres(runtime);
  if (!pgReady) {
    log.error('  ✗ PostgreSQL failed to start');
    process.exit(1);
  }
  log.success('  ✓ PostgreSQL is ready');
  log.blank();

  log.info('🗄️  Running database migrations...');
  const projectRoot = path.resolve(__dirname, '..');
  const backendDir = path.join(projectRoot, 'backend');

  exec('npx prisma generate', { cwd: backendDir });

  if (exec('npx prisma migrate dev --name init', { cwd: backendDir })) {
    log.success('  ✓ Migrations completed');
  } else {
    log.warn('  ⚠️  Migration failed - this is normal for first run');
  }
}

/**
 * Print success message and next steps
 */
function printSuccessMessage() {
  log.success('✅ Setup complete!');
  log.blank();

  log.info('Next steps:');
  log.white('  1. Edit backend/.env and add GitHub OAuth credentials');
  log.white('  2. Run: npm run dev');
  log.white('  3. Frontend: http://localhost:3000');
  log.white('  4. Backend API: http://localhost:4000');
  log.blank();

  log.info('Useful commands:');
  log.white('  npm run dev              - Start both frontend and backend');
  log.white('  npm run dev:frontend     - Start frontend only');
  log.white('  npm run dev:backend      - Start backend only');
  log.white('  npm run db:studio        - Open Prisma Studio');
  log.white('  npm run podman:down      - Stop containers');
  log.white('  npm run podman:logs      - View container logs');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Initialize
  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  log.success('🚀 M3W Project Setup');
  log.success('===================');
  log.blank();

  // Step 1: Show environment info
  log.info(`📋 Detected OS: ${colors.yellow}${getOS()}${colors.reset}`);
  log.blank();

  // Step 2: Check prerequisites
  log.info('🔍 Checking prerequisites...');
  checkNodeVersion();
  const container = detectContainerRuntime();
  log.blank();

  // Step 3: Install dependencies
  installDependencies();
  log.blank();

  // Step 4: Setup environment files
  if (!args.skipEnv) {
    setupEnvironmentFiles();
    log.blank();
  }

  // Step 5: Start containers
  startContainers(container);
  log.blank();

  // Step 6: Setup database
  await setupDatabase(container.runtime);
  log.blank();

  // Step 7: Done!
  printSuccessMessage();
  log.blank();
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
