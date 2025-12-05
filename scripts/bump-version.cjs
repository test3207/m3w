#!/usr/bin/env node

/**
 * Version Bump Script
 *
 * Bumps the version number in all package.json files across the monorepo.
 * Cross-platform replacement for bump-version.ps1.
 *
 * Features:
 *   - Updates version in root, frontend, backend, and shared package.json
 *   - Supports semantic versioning (patch, minor, major)
 *   - Optional git commit with version tag
 *   - Interactive confirmation before changes
 *
 * Usage:
 *   node scripts/bump-version.cjs patch          # 0.1.0 -> 0.1.1
 *   node scripts/bump-version.cjs minor          # 0.1.0 -> 0.2.0
 *   node scripts/bump-version.cjs major          # 0.1.0 -> 1.0.0
 *   node scripts/bump-version.cjs patch --commit # Bump and git commit
 *   node scripts/bump-version.cjs --help         # Show help
 *
 * npm scripts:
 *   npm run version:patch                        # Bump patch and commit
 *   npm run version:minor                        # Bump minor and commit
 *   npm run version:major                        # Bump major and commit
 *
 * Related scripts:
 *   - build-docker.cjs: Build Docker images after version bump
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  white: (msg) => console.log(`${colors.white}${msg}${colors.reset}`),
  blank: () => console.log(''),
};

// Prompt for user input
async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    type: args.find(a => ['patch', 'minor', 'major'].includes(a.toLowerCase()))?.toLowerCase() || null,
    yes: args.includes('--yes') || args.includes('-y'),
    commit: args.includes('--commit'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

// Show help message
function showHelp() {
  log.info('Version Bump Script');
  log.info('===================');
  log.blank();
  log.white('Usage: node scripts/bump-version.cjs <type> [options]');
  log.blank();
  log.white('Types:');
  log.white('  patch    Bump patch version (0.1.0 -> 0.1.1)');
  log.white('  minor    Bump minor version (0.1.0 -> 0.2.0)');
  log.white('  major    Bump major version (0.1.0 -> 1.0.0)');
  log.blank();
  log.white('Options:');
  log.white('  --yes, -y    Skip confirmation prompts (for CI)');
  log.white('  --commit     Create git commit after bump');
  log.white('  --help, -h   Show this help message');
  log.blank();
  log.white('Examples:');
  log.white('  node scripts/bump-version.cjs patch              # Interactive');
  log.white('  node scripts/bump-version.cjs patch --yes        # Non-interactive');
  log.white('  node scripts/bump-version.cjs minor -y --commit  # CI mode');
}

// Parse version string
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

// Calculate new version
function bumpVersion(current, type) {
  const v = parseVersion(current);

  switch (type) {
    case 'patch':
      v.patch++;
      break;
    case 'minor':
      v.minor++;
      v.patch = 0;
      break;
    case 'major':
      v.major++;
      v.minor = 0;
      v.patch = 0;
      break;
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }

  return `${v.major}.${v.minor}.${v.patch}`;
}

// Update version in package.json file
function updatePackageJson(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(content);
  pkg.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
}

async function main() {
  const args = parseArgs();

  // Show help
  if (args.help || !args.type) {
    showHelp();
    process.exit(args.help ? 0 : 1);
  }

  const type = args.type;

  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  // Read current version
  const rootPackagePath = path.join(projectRoot, 'package.json');
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  const currentVersion = rootPackage.version;

  log.info(`📦 Current version: v${currentVersion}`);

  // Calculate new version
  const newVersion = bumpVersion(currentVersion, type);

  log.success(`🆕 New version: v${newVersion}`);
  log.blank();

  // Confirm (skip if --yes)
  if (!args.yes) {
    const answer = await prompt(`Update package.json files to v${newVersion}? (y/N) `);
    if (answer !== 'y') {
      log.warn('❌ Aborted');
      process.exit(0);
    }
  }

  // Update all package.json files
  const packageFiles = [
    'package.json',
    'frontend/package.json',
    'backend/package.json',
    'shared/package.json',
  ];

  for (const file of packageFiles) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      updatePackageJson(filePath, newVersion);
    }
  }

  log.success('✅ Updated package.json files');
  log.blank();

  // Git commit (auto if --commit, ask otherwise)
  const shouldCommit = args.commit || (!args.yes && (await prompt('Create git commit? (y/N) ')) === 'y');
  if (shouldCommit) {
    try {
      execSync(`git add ${packageFiles.join(' ')}`, { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to v${newVersion}"`, { stdio: 'inherit' });

      log.success('✅ Committed version bump');
      log.blank();
      log.info('📌 Next steps:');
      log.white('   1. Review the commit: git log -1');
      log.white('   2. Push to remote: git push');
    } catch {
      log.error('❌ Git commit failed');
    }
  } else {
    log.warn('⏭️  Skipped git commit');
    log.blank();
    log.info('📌 Remember to commit manually:');
    log.white(`   git add ${packageFiles.join(' ')}`);
    log.white(`   git commit -m "chore: bump version to v${newVersion}"`);
  }

  log.blank();
  log.success(`✨ Done! Version bumped from v${currentVersion} to v${newVersion}`);
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
