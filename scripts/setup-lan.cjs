#!/usr/bin/env node

/**
 * M3W LAN Access Setup Script
 *
 * Configures the application for local area network access.
 * Cross-platform replacement for setup-lan.ps1.
 *
 * Usage:
 *   node scripts/setup-lan.cjs              # Auto-detect IP
 *   node scripts/setup-lan.cjs --ip 192.168.1.100  # Use specific IP
 *   node scripts/setup-lan.cjs --skip-firewall     # Skip firewall config
 *   node scripts/setup-lan.cjs --help              # Show help
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');

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
  white: (msg) => console.log(`${colors.white}${msg}${colors.reset}`),
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    customIP: null,
    skipFirewall: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--skip-firewall') {
      result.skipFirewall = true;
    } else if (arg === '--ip' && args[i + 1]) {
      result.customIP = args[++i];
    }
  }

  return result;
}

// Show help message
function showHelp() {
  console.log(`
${colors.cyan}M3W LAN Access Setup Script${colors.reset}
===========================

Configures the application for local area network access.

Usage: node scripts/setup-lan.cjs [options]

Options:
  --ip <address>    Use specific IP address
  --skip-firewall   Skip Windows firewall configuration
  --help, -h        Show this help message

Examples:
  node scripts/setup-lan.cjs                    # Auto-detect IP
  node scripts/setup-lan.cjs --ip 192.168.1.100 # Use specific IP
  node scripts/setup-lan.cjs --skip-firewall    # Skip firewall setup
`);
}

// Prompt for user selection
async function promptSelection(message, options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} `, (answer) => {
      rl.close();
      const index = parseInt(answer.trim(), 10) || 0;
      resolve(options[index] || options[0]);
    });
  });
}

// Get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      // Only IPv4, non-internal addresses in private ranges
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        (addr.address.startsWith('192.168.') ||
          addr.address.startsWith('10.') ||
          addr.address.startsWith('172.'))
      ) {
        results.push({ address: addr.address, interface: name });
      }
    }
  }

  return results;
}

// Update environment file
function updateEnvFile(filePath, updates) {
  let content = '';

  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  } else {
    // Try to copy from example
    const examplePath = filePath.replace('.env', '.env.example');
    if (fs.existsSync(examplePath)) {
      content = fs.readFileSync(examplePath, 'utf8');
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trim() + `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(filePath, content);
}

// Check if running as administrator (Windows)
function isAdmin() {
  if (os.platform() !== 'win32') {
    return false;
  }

  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Configure Windows firewall
function configureWindowsFirewall(localIP) {
  if (os.platform() !== 'win32') {
    log.gray('   Firewall configuration is Windows-only');
    return;
  }

  if (!isAdmin()) {
    log.warn('⚠️  Not running as administrator - skipping firewall configuration');
    log.warn('   To configure firewall, run this script as administrator or use:');
    log.info(
      "   New-NetFirewallRule -DisplayName 'M3W Frontend' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow"
    );
    log.info(
      "   New-NetFirewallRule -DisplayName 'M3W Backend' -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow"
    );
    return;
  }

  try {
    log.info('🔥 Configuring Windows Firewall...');

    // Remove old rules
    log.gray('   Removing old firewall rules...');
    execSync("powershell -Command \"Get-NetFirewallRule -DisplayName 'M3W*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule\"", {
      stdio: 'ignore',
    });

    // Add new rules
    log.gray('   Adding firewall rules for ports 3000 and 4000...');

    execSync(
      `powershell -Command "New-NetFirewallRule -DisplayName 'M3W Frontend (Vite)' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -Description 'Allow M3W frontend access on port 3000'"`,
      { stdio: 'ignore' }
    );

    execSync(
      `powershell -Command "New-NetFirewallRule -DisplayName 'M3W Backend (Hono)' -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Any -Description 'Allow M3W backend API access on port 4000'"`,
      { stdio: 'ignore' }
    );

    log.success('✅ Firewall rules configured');
  } catch (err) {
    log.error(`❌ Failed to configure firewall: ${err.message}`);
  }
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  log.info('=== M3W LAN Access Setup ===');
  console.log('');

  // Get local IP address
  log.warn('🔍 Detecting local IP address...');

  let localIP = args.customIP;

  if (!localIP) {
    const ips = getLocalIPs();

    if (ips.length === 0) {
      log.error('❌ No local IP address found!');
      log.warn('   Please run with --ip parameter');
      process.exit(1);
    }

    if (ips.length > 1) {
      log.warn('   Multiple IP addresses found:');
      ips.forEach((ip, i) => {
        console.log(`   [${i}] ${ip.address} (Interface: ${ip.interface})`);
      });
      const selected = await promptSelection('   Select IP address [0]:', ips);
      localIP = selected.address;
    } else {
      localIP = ips[0].address;
    }
  }

  log.success(`✅ Using IP address: ${localIP}`);
  console.log('');

  // Update backend .env
  log.warn('📝 Updating backend/.env...');
  const backendEnvPath = path.join(projectRoot, 'backend', '.env');

  if (!fs.existsSync(backendEnvPath)) {
    const examplePath = path.join(projectRoot, 'backend', '.env.example');
    if (fs.existsSync(examplePath)) {
      log.gray('   Creating backend/.env from .env.example...');
      fs.copyFileSync(examplePath, backendEnvPath);
    } else {
      log.error('❌ backend/.env.example not found!');
      process.exit(1);
    }
  }

  updateEnvFile(backendEnvPath, {
    HOST: '0.0.0.0',
    CORS_ORIGIN: `http://${localIP}:3000`,
    API_BASE_URL: `http://${localIP}:4000`,
    GITHUB_CALLBACK_URL: `http://${localIP}:4000/api/auth/callback`,
  });

  log.success('✅ Backend configuration updated');
  console.log('');

  // Update frontend .env
  log.warn('📝 Updating frontend/.env...');
  const frontendEnvPath = path.join(projectRoot, 'frontend', '.env');

  if (!fs.existsSync(frontendEnvPath)) {
    const examplePath = path.join(projectRoot, 'frontend', '.env.example');
    if (fs.existsSync(examplePath)) {
      log.gray('   Creating frontend/.env from .env.example...');
      fs.copyFileSync(examplePath, frontendEnvPath);
    } else {
      log.error('❌ frontend/.env.example not found!');
      process.exit(1);
    }
  }

  updateEnvFile(frontendEnvPath, {
    VITE_API_URL: `http://${localIP}:4000`,
  });

  log.success('✅ Frontend configuration updated');
  console.log('');

  // Configure firewall (Windows only)
  if (!args.skipFirewall) {
    configureWindowsFirewall(localIP);
  } else {
    log.warn('⏭️  Skipping firewall configuration');
  }

  console.log('');
  log.success('=== Setup Complete ===');
  console.log('');
  log.info('📱 Access URLs:');
  log.white(`   Frontend: http://${localIP}:3000`);
  log.white(`   Backend:  http://${localIP}:4000`);
  log.white(`   Health:   http://${localIP}:4000/health`);
  console.log('');
  log.info('🚀 To start the services, run:');
  log.white('   npm run dev');
  console.log('');
  log.warn('💡 Tips:');
  log.white('   - Make sure Docker services are running (docker-compose up -d)');
  log.white(`   - Test backend: curl http://${localIP}:4000/health`);
  log.white('   - Full documentation: docs/LAN_ACCESS.md');
  console.log('');
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
