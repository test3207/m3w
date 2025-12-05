#!/usr/bin/env node

/**
 * Create Release Archives Script
 *
 * Creates tar.gz and zip archives from docker-build-output/ directory
 * for distribution via GitHub Releases.
 *
 * Features:
 *   - Creates archives for All-in-One, Backend-only, and Frontend-only
 *   - Generates both .tar.gz (Linux/macOS) and .zip (Windows) formats
 *   - Uses native tar/zip on Unix, PowerShell Compress-Archive on Windows
 *   - Verifies archive contents after creation
 *
 * Usage:
 *   node scripts/create-archives.cjs <version>
 *   node scripts/create-archives.cjs v0.1.0-rc.1
 *   node scripts/create-archives.cjs --help
 *
 * npm scripts:
 *   npm run archives                         # Called by CI, requires version arg
 *
 * Output (in project root):
 *   - m3w-<version>.tar.gz          (All-in-One)
 *   - m3w-<version>.zip
 *   - m3w-backend-<version>.tar.gz  (Backend only)
 *   - m3w-backend-<version>.zip
 *   - m3w-frontend-<version>.tar.gz (Frontend only)
 *   - m3w-frontend-<version>.zip
 *
 * Prerequisites:
 *   - docker-build-output/ directory must exist (run build-docker.cjs first)
 *   - tar command (Unix) or PowerShell (Windows)
 *
 * Related scripts:
 *   - build-docker.cjs: Run first to create docker-build-output/
 *
 * CI Integration:
 *   - Called by .github/workflows/build-release.yml
 *   - Called by .github/workflows/build-rc.yml
 */

const { execSync } = require('child_process');
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

// Execute command
function exec(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: options.silent ? 'ignore' : 'inherit', ...options });
    return true;
  } catch {
    return false;
  }
}

// Get file size in human-readable format
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const bytes = stats.size;
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  } catch {
    return '0 B';
  }
}

// Show help message
function showHelp() {
  console.log(`
${colors.cyan}Create Release Archives Script${colors.reset}
================================

Creates tar.gz and zip archives from docker-build-output/ directory.

Usage: node scripts/create-archives.cjs <version>

Arguments:
  version    Version string (e.g., v0.1.0-rc.1)

Options:
  --help, -h    Show this help message

Output files (in project root):
  m3w-<version>.tar.gz          All-in-One archive
  m3w-<version>.zip
  m3w-backend-<version>.tar.gz  Backend only
  m3w-backend-<version>.zip
  m3w-frontend-<version>.tar.gz Frontend only
  m3w-frontend-<version>.zip

Examples:
  node scripts/create-archives.cjs v0.1.0
  node scripts/create-archives.cjs v0.1.0-rc.1
`);
}

// Create tar.gz archive (cross-platform)
function createTarGz(srcDir, destFile, contents) {
  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    // Use tar on Windows (built-in since Windows 10)
    if (contents === '.') {
      exec(`tar -czvf "${destFile}" -C "${srcDir}" .`, { silent: true });
    } else {
      exec(`tar -czvf "${destFile}" -C "${srcDir}" ${contents}`, { silent: true });
    }
  } else {
    if (contents === '.') {
      exec(`tar -czvf "${destFile}" -C "${srcDir}" .`, { silent: true });
    } else {
      exec(`tar -czvf "${destFile}" -C "${srcDir}" ${contents}`, { silent: true });
    }
  }
}

// Create zip archive (cross-platform)
function createZip(srcDir, destFile, contents) {
  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    // Use PowerShell Compress-Archive on Windows
    if (contents === '.') {
      exec(
        `powershell -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${destFile}' -Force"`,
        { silent: true }
      );
    } else {
      exec(
        `powershell -Command "Compress-Archive -Path '${path.join(srcDir, contents)}' -DestinationPath '${destFile}' -Force"`,
        { silent: true }
      );
    }
  } else {
    // Use zip command on Unix
    const cwd = process.cwd();
    process.chdir(srcDir);
    if (contents === '.') {
      exec(`zip -r "${destFile}" .`, { silent: true });
    } else {
      exec(`zip -r "${destFile}" ${contents}`, { silent: true });
    }
    process.chdir(cwd);
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Get version argument
  const version = args[0];
  if (!version) {
    log.error('❌ Error: Version argument required');
    log.white('   Usage: node scripts/create-archives.cjs <version>');
    log.white('   Example: node scripts/create-archives.cjs v0.1.0-rc.1');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const outputDir = path.join(projectRoot, 'docker-build-output');

  console.log('');
  log.info('📦 Creating Release Archives');
  log.info('============================');
  log.white(`   Version: ${version}`);
  log.white(`   Source:  ${outputDir}`);
  console.log('');

  // Verify output directory exists
  if (!fs.existsSync(outputDir)) {
    log.error('❌ Error: docker-build-output/ directory not found');
    log.warn('   Run build-docker script first to create build artifacts');
    process.exit(1);
  }

  // Verify required directories exist
  const backendDir = path.join(outputDir, 'backend');
  const frontendDir = path.join(outputDir, 'frontend');

  if (!fs.existsSync(backendDir)) {
    log.error('❌ Error: backend/ not found in docker-build-output/');
    process.exit(1);
  }

  if (!fs.existsSync(frontendDir)) {
    log.error('❌ Error: frontend/ not found in docker-build-output/');
    process.exit(1);
  }

  // Define archives to create
  const archives = [
    { name: 'AIO', prefix: 'm3w', contents: '.' },
    { name: 'Backend', prefix: 'm3w-backend', contents: 'backend' },
    { name: 'Frontend', prefix: 'm3w-frontend', contents: 'frontend' },
  ];

  // Create archives
  for (const archive of archives) {
    log.gray(`📁 Creating ${archive.name} archives...`);

    const tarFile = path.join(projectRoot, `${archive.prefix}-${version}.tar.gz`);
    const zipFile = path.join(projectRoot, `${archive.prefix}-${version}.zip`);

    // Remove existing files
    if (fs.existsSync(tarFile)) fs.unlinkSync(tarFile);
    if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

    // Create archives
    createTarGz(outputDir, tarFile, archive.contents);
    createZip(outputDir, zipFile, archive.contents);

    log.success(`   ✓ ${archive.prefix}-${version}.tar.gz`);
    log.success(`   ✓ ${archive.prefix}-${version}.zip`);
  }

  console.log('');
  log.success('✅ Archives created successfully!');
  console.log('');

  // Show archive sizes
  log.info('📊 Archive sizes:');
  for (const archive of archives) {
    const tarFile = path.join(projectRoot, `${archive.prefix}-${version}.tar.gz`);
    const zipFile = path.join(projectRoot, `${archive.prefix}-${version}.zip`);

    if (fs.existsSync(tarFile)) {
      log.white(`   ${archive.prefix}-${version}.tar.gz: ${getFileSize(tarFile)}`);
    }
    if (fs.existsSync(zipFile)) {
      log.white(`   ${archive.prefix}-${version}.zip: ${getFileSize(zipFile)}`);
    }
  }

  console.log('');
  log.info('📋 Files created:');
  for (const archive of archives) {
    for (const ext of ['.tar.gz', '.zip']) {
      const file = `${archive.prefix}-${version}${ext}`;
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        log.success(`   ✓ ${file}`);
      } else {
        log.error(`   ✗ ${file} (missing)`);
      }
    }
  }
  console.log('');
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
