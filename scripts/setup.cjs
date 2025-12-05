#!/usr/bin/env node

/**
 * M3W Project Setup Script
 *
 * Cross-platform setup script that works on Windows, macOS, and Linux.
 * Replaces setup.ps1 and setup.sh with a single Node.js implementation.
 *
 * Usage:
 *   node scripts/setup.cjs              # Full setup
 *   node scripts/setup.cjs --skip-env   # Skip environment variable setup
 *   node scripts/setup.cjs --help       # Show help
 *   npm run setup                       # Via npm script
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
  console.log(`
${colors.cyan}M3W Project Setup Script${colors.reset}
========================

Usage: node scripts/setup.cjs [options]

Options:
  --skip-env     Skip environment variable setup
  --help, -h     Show this help message

Examples:
  node scripts/setup.cjs            # Full setup
  node scripts/setup.cjs --skip-env # Skip .env setup
  npm run setup                     # Via npm script
`);
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

// Execute command and return output
function execOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
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

// Detect container runtime
function getContainerRuntime() {
  // Check Podman first
  if (commandExists('podman')) {
    try {
      execSync('podman info', { stdio: 'ignore' });
      return { runtime: 'podman', compose: 'podman-compose' };
    } catch {
      // Podman exists but not running
    }
  }

  // Check Docker
  if (commandExists('docker')) {
    try {
      execSync('docker info', { stdio: 'ignore' });
      return { runtime: 'docker', compose: 'docker compose' };
    } catch {
      // Docker exists but not running
    }
  }

  return null;
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
function copyIfNotExists(src, dest, description) {
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

// Main setup function
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  log.success('🚀 M3W Project Setup');
  log.success('===================');
  console.log('');

  // Detect OS
  const detectedOS = getOS();
  log.info(`📋 Detected OS: ${colors.yellow}${detectedOS}${colors.reset}`);
  console.log('');

  // Check prerequisites
  log.info('🔍 Checking prerequisites...');

  // Check Node.js
  if (commandExists('node')) {
    const nodeVersion = execOutput('node --version');
    log.success(`  ✓ Node.js: ${nodeVersion}`);
  } else {
    log.error('  ✗ Node.js not found. Please install Node.js 20+');
    process.exit(1);
  }

  // Check npm
  if (commandExists('npm')) {
    const npmVersion = execOutput('npm --version');
    log.success(`  ✓ npm: ${npmVersion}`);
  } else {
    log.error('  ✗ npm not found');
    process.exit(1);
  }

  // Check container runtime
  let container = null;

  if (commandExists('podman')) {
    log.success('  ✓ Podman detected');

    // Check podman-compose
    if (commandExists('podman-compose')) {
      log.success('  ✓ podman-compose detected');
    } else {
      log.error('  ✗ podman-compose not found');
      log.warn('    Please install: pip install podman-compose');
      process.exit(1);
    }

    // Check Podman Machine on Windows/macOS
    if (!checkPodmanMachine()) {
      log.error('  ✗ Failed to start Podman Machine');
      process.exit(1);
    }

    container = { runtime: 'podman', compose: 'podman-compose' };
  } else if (commandExists('docker')) {
    try {
      execSync('docker info', { stdio: 'ignore' });
      log.success('  ✓ Docker detected');
      container = { runtime: 'docker', compose: 'docker compose' };
    } catch {
      log.error('  ✗ Docker detected but not running');
      log.warn('    Please start Docker Desktop');
      process.exit(1);
    }
  } else {
    log.error('  ✗ Neither Podman nor Docker found');
    log.warn('    Please install Podman Desktop: https://podman-desktop.io/');
    log.warn('    Then run: pip install podman-compose');
    process.exit(1);
  }

  console.log('');

  // Install dependencies
  log.info('📦 Installing dependencies...');

  log.gray('  Installing root dependencies...');
  if (!exec('npm install')) {
    log.error('  ✗ npm install failed');
    process.exit(1);
  }

  log.gray('  Installing frontend dependencies...');
  if (!exec('npm install', { cwd: path.join(projectRoot, 'frontend') })) {
    log.error('  ✗ frontend npm install failed');
    process.exit(1);
  }

  log.gray('  Installing Playwright browsers (for testing)...');
  exec('npx playwright install', { cwd: path.join(projectRoot, 'frontend') });

  log.gray('  Installing backend dependencies...');
  if (!exec('npm install', { cwd: path.join(projectRoot, 'backend') })) {
    log.error('  ✗ backend npm install failed');
    process.exit(1);
  }

  log.gray('  Installing shared dependencies...');
  if (!exec('npm install', { cwd: path.join(projectRoot, 'shared') })) {
    log.error('  ✗ shared npm install failed');
    process.exit(1);
  }

  log.success('  ✓ All dependencies installed');
  console.log('');

  // Setup environment variables
  if (!args.skipEnv) {
    log.info('🔐 Setting up environment variables...');

    copyIfNotExists('.npmrc.example', '.npmrc', '.npmrc');

    const createdBackendEnv = copyIfNotExists('backend/.env.example', 'backend/.env', 'backend/.env');
    if (createdBackendEnv) {
      log.warn('  ⚠️  Please edit backend/.env and add your GitHub OAuth credentials');
      log.gray('     Visit: https://github.com/settings/developers');
    }

    copyIfNotExists('frontend/.env.example', 'frontend/.env', 'frontend/.env');

    console.log('');
  }

  // Start containers
  log.success('  Using docker-compose.yml (official images)');
  log.warn('  China network tips: see docs/CHINA_REGISTRY.md for proxy/mirror guidance');
  console.log('');

  log.info('🐳 Starting containers...');
  if (!exec(`${container.compose} -f docker-compose.yml up -d`)) {
    log.error('  ✗ Failed to start containers');
    log.warn('  💡 Tip: Check if ports 5432 or 6379 are already in use');
    process.exit(1);
  }
  log.success('  ✓ Containers started');
  console.log('');

  // Wait for PostgreSQL
  log.info('⏳ Waiting for PostgreSQL to be ready...');
  const pgReady = await waitForPostgres(container.runtime);
  if (pgReady) {
    log.success('  ✓ PostgreSQL is ready');
  } else {
    log.error('  ✗ PostgreSQL failed to start');
    process.exit(1);
  }
  console.log('');

  // Run Prisma migrations
  log.info('🗄️  Running database migrations...');
  exec('npx prisma generate', { cwd: path.join(projectRoot, 'backend') });
  const migrateResult = exec('npx prisma migrate dev --name init', { cwd: path.join(projectRoot, 'backend') });
  if (migrateResult) {
    log.success('  ✓ Migrations completed');
  } else {
    log.warn('  ⚠️  Migration failed - this is normal for first run');
  }
  console.log('');

  // Success message
  log.success('✅ Setup complete!');
  console.log('');
  log.info('Next steps:');
  log.white('  1. Edit backend/.env and add GitHub OAuth credentials');
  log.white('  2. Run: npm run dev');
  log.white('  3. Frontend: http://localhost:3000');
  log.white('  4. Backend API: http://localhost:4000');
  console.log('');
  log.info('Useful commands:');
  log.white('  npm run dev              - Start both frontend and backend');
  log.white('  npm run dev:frontend     - Start frontend only');
  log.white('  npm run dev:backend      - Start backend only');
  log.white('  npm run db:studio        - Open Prisma Studio');
  log.white('  npm run podman:down      - Stop containers');
  log.white('  npm run podman:logs      - View container logs');
  console.log('');
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
