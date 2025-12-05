#!/usr/bin/env node

/**
 * Docker Image Build Script
 *
 * Cross-platform script that builds Docker images for M3W.
 * Replaces build-docker.ps1 and build-docker.sh.
 *
 * Features:
 *   - Builds artifacts inside Docker container (consistent environment)
 *   - Creates All-in-One, Backend-only, and Frontend-only images
 *   - Supports production and release candidate (RC) builds
 *   - Auto-detects container runtime (Docker or Podman)
 *   - Optional image testing and registry push
 *
 * Usage:
 *   node scripts/build-docker.cjs --type prod              # Production build
 *   node scripts/build-docker.cjs --type rc --rc 1         # RC build (rc.1)
 *   node scripts/build-docker.cjs --type prod --push       # Build and push
 *   node scripts/build-docker.cjs --type prod --test       # Build and test AIO
 *   node scripts/build-docker.cjs --type prod --skip-artifacts  # Use existing
 *   node scripts/build-docker.cjs --help                   # Show help
 *
 * npm scripts:
 *   npm run docker:build        # Production build
 *   npm run docker:build:rc     # RC build
 *   npm run docker:build:test   # Build and test
 *
 * Environment variables:
 *   DOCKER_REGISTRY    Override default registry (ghcr.io/test3207)
 *
 * Build process:
 *   1. Run docker-build.sh inside container to create artifacts
 *   2. Copy artifacts to docker-build-output/
 *   3. Build Docker images using Dockerfiles
 *   4. Optionally test and/or push images
 *
 * Related files:
 *   - scripts/docker-build.sh: Runs inside container (Linux only)
 *   - docker/Dockerfile: All-in-One image
 *   - docker/Dockerfile.backend: Backend-only image
 *   - docker/Dockerfile.frontend: Frontend-only image
 *   - docker/docker-version.conf: Node.js image version
 *
 * CI Integration:
 *   - Called by .github/workflows/build-release.yml
 *   - Called by .github/workflows/build-rc.yml
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
    type: 'prod',
    rcNumber: 1,
    push: false,
    test: false,
    skipArtifacts: false,
    help: false,
    registry: process.env.DOCKER_REGISTRY || 'ghcr.io/test3207',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--push') {
      result.push = true;
    } else if (arg === '--test') {
      result.test = true;
    } else if (arg === '--skip-artifacts') {
      result.skipArtifacts = true;
    } else if (arg === '--registry' && args[i + 1]) {
      result.registry = args[++i];
    } else if (arg === '--type' && args[i + 1]) {
      result.type = args[++i];
    } else if (arg === '--rc' && args[i + 1]) {
      result.rcNumber = parseInt(args[++i], 10);
    } else if (arg === 'prod' || arg === 'rc') {
      // Legacy positional argument support
      result.type = arg;
    } else if (/^\d+$/.test(arg)) {
      // Legacy positional RC number
      result.rcNumber = parseInt(arg, 10);
    }
  }

  return result;
}

// Show help message
function showHelp() {
  console.log(`
${colors.cyan}M3W Docker Image Build Script${colors.reset}
==============================

Usage: node scripts/build-docker.cjs [options]

Options:
  --type <type>     Build type: prod (default) or rc
  --rc <number>     RC number for rc builds (default: 1)
  --push            Push images to registry after build
  --test            Test the AIO image after build
  --skip-artifacts  Skip artifact build (use existing docker-build-output/)
  --registry <url>  Override registry (default: ghcr.io/test3207)
  --help, -h        Show this help message

Examples:
  node scripts/build-docker.cjs --type prod                   # Production build
  node scripts/build-docker.cjs --type rc --rc 1              # RC build (v0.1.0-rc.1)
  node scripts/build-docker.cjs --type prod --push            # Build and push
  node scripts/build-docker.cjs --type prod --test            # Build and test
  node scripts/build-docker.cjs --type prod --skip-artifacts  # Use existing artifacts

npm scripts:
  npm run docker:build        # Production build
  npm run docker:build:rc     # RC build
  npm run docker:build:test   # Build and test

Environment:
  DOCKER_REGISTRY   Override default registry

Build process:
  1. Builds artifacts inside Docker container (scripts/docker-build.sh)
  2. Copies artifacts to docker-build-output/
  3. Builds Docker images (AIO, Backend, Frontend)
  4. Optionally tests and/or pushes images
`);
}

// Detect container runtime (docker or podman)
function getContainerRuntime() {
  // Try docker first
  try {
    execSync('docker info', { stdio: 'ignore' });
    return { runtime: 'docker', compose: 'docker compose' };
  } catch {
    // Try podman
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

// Read NODE_IMAGE from docker/docker-version.conf
function getNodeImage(projectRoot) {
  const configFile = path.join(projectRoot, 'docker', 'docker-version.conf');
  let nodeImage = 'node:25.2.1-alpine'; // fallback

  if (fs.existsSync(configFile)) {
    const content = fs.readFileSync(configFile, 'utf8');
    const match = content.match(/^NODE_IMAGE=(.+)$/m);
    if (match) {
      nodeImage = match[1].trim();
    }
  }

  return nodeImage;
}

// Read version from package.json
function getVersion(projectRoot) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  return packageJson.version;
}

// Build version string and tags
function getVersionTags(baseVersion, type, rcNumber) {
  let version;
  let additionalTags;

  if (type === 'rc') {
    version = `v${baseVersion}-rc.${rcNumber}`;
    additionalTags = ['rc'];
  } else {
    version = `v${baseVersion}`;
    const parts = baseVersion.split('.');
    const minorVersion = `${parts[0]}.${parts[1]}`;
    const majorVersion = parts[0];
    additionalTags = [`v${minorVersion}`, `v${majorVersion}`, 'latest'];
  }

  return { version, allTags: [version, ...additionalTags] };
}

// Build Docker image with tags
function buildImage(container, registry, name, dockerfile, outputDir, allTags, projectRoot) {
  log.gray(`  Building ${name}...`);

  const tagArgs = allTags.map((tag) => `-t ${registry}/${name}:${tag}`).join(' ');
  const dockerfilePath = path.join(projectRoot, dockerfile);

  const cmd = `${container.runtime} build ${tagArgs} -f "${dockerfilePath}" "${outputDir}"`;

  if (!exec(cmd)) {
    log.error(`❌ Failed to build ${name}`);
    process.exit(1);
  }

  log.success(`  ✅ ${name} built`);
}

// Check if running in CI/container environment
function isInContainer() {
  // Check for Docker container
  if (fs.existsSync('/.dockerenv')) {
    return true;
  }
  // Check for CI environment variables
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI) {
    return true;
  }
  return false;
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const projectRoot = path.resolve(__dirname, '..');
  process.chdir(projectRoot);

  const outputDir = path.join(projectRoot, 'docker-build-output');

  // Detect container runtime
  const container = getContainerRuntime();
  if (!container) {
    log.error('❌ No container runtime found (docker/podman)');
    process.exit(1);
  }

  // Get configuration
  const nodeImage = getNodeImage(projectRoot);
  const baseVersion = getVersion(projectRoot);
  const { version, allTags } = getVersionTags(baseVersion, args.type, args.rcNumber);

  console.log('');
  log.info('========================================');
  log.info('  M3W Docker Build Script');
  log.info('========================================');
  console.log('');
  log.success(`  Version:  ${version}`);
  log.success(`  Type:     ${args.type}`);
  log.success(`  Registry: ${args.registry}`);
  log.success(`  Runtime:  ${container.runtime}`);
  console.log('');

  // ============================================
  // Step 1: Build artifacts
  // ============================================
  if (!args.skipArtifacts) {
    log.warn('📦 Step 1: Building artifacts in Linux container...');
    console.log('');

    // Clean output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // Determine build target based on type
    const buildTarget = args.type === 'rc' ? 'rc' : 'prod';

    // Check if we're in container/CI or need to spawn one
    if (isInContainer()) {
      // Running in container or CI - build directly
      log.gray(`   Running build directly (CI/container environment, BUILD_TARGET=${buildTarget})...`);

      process.env.BUILD_TARGET = buildTarget;
      if (!exec(`sh "${path.join(projectRoot, 'scripts', 'docker-build.sh')}"`)) {
        log.error('❌ Artifact build failed!');
        process.exit(1);
      }
    } else {
      // Running on host - use container for consistency
      log.gray(`   Running container build (BUILD_TARGET=${buildTarget})...`);

      const cmd = `${container.runtime} run --rm ` +
        `-v "${projectRoot}:/app:ro" ` +
        `-v "${outputDir}:/output" ` +
        `-e "BUILD_TARGET=${buildTarget}" ` +
        `${nodeImage} ` +
        `sh -c "mkdir -p /build && sh /app/scripts/docker-build.sh"`;

      if (!exec(cmd)) {
        log.error('❌ Artifact build failed!');
        process.exit(1);
      }
    }

    console.log('');
    log.success('✅ Artifacts built successfully');
    console.log('');
  } else {
    log.warn('⏭️  Skipping artifact build (--skip-artifacts)');
    console.log('');

    if (!fs.existsSync(outputDir)) {
      log.error(`❌ Output directory not found: ${outputDir}`);
      log.warn('   Run without --skip-artifacts first');
      process.exit(1);
    }
  }

  // ============================================
  // Step 2: Build Docker images
  // ============================================
  log.warn('🐳 Step 2: Building Docker images...');
  console.log('');

  // Build all images
  buildImage(container, args.registry, 'm3w', 'docker/Dockerfile', outputDir, allTags, projectRoot);
  buildImage(container, args.registry, 'm3w-backend', 'docker/Dockerfile.backend', outputDir, allTags, projectRoot);
  buildImage(container, args.registry, 'm3w-frontend', 'docker/Dockerfile.frontend', outputDir, allTags, projectRoot);

  console.log('');
  log.success('✅ All images built successfully');

  // ============================================
  // Step 3: Show results
  // ============================================
  console.log('');
  log.info('========================================');
  log.info('  Build Results');
  log.info('========================================');
  console.log('');

  // Show image sizes
  log.warn('📊 Image sizes:');
  exec(`${container.runtime} images --filter "reference=${args.registry}/m3w*" --format "table {{.Repository}}:{{.Tag}}\\t{{.Size}}" | head -12`);

  console.log('');
  log.warn('📋 Built tags:');
  for (const img of ['m3w', 'm3w-backend', 'm3w-frontend']) {
    log.gray(`  ${args.registry}/${img}: ${allTags.join(', ')}`);
  }

  // ============================================
  // Step 4: Push (optional)
  // ============================================
  if (args.push) {
    console.log('');
    log.warn('🚀 Pushing images to registry...');
    console.log('');

    for (const img of ['m3w', 'm3w-backend', 'm3w-frontend']) {
      for (const tag of allTags) {
        log.gray(`  Pushing ${args.registry}/${img}:${tag}...`);
        if (!exec(`${container.runtime} push "${args.registry}/${img}:${tag}"`)) {
          log.error(`❌ Failed to push ${img}:${tag}`);
          process.exit(1);
        }
      }
    }

    console.log('');
    log.success('✅ All images pushed');
  } else {
    console.log('');
    log.warn(`💡 To push: node scripts/build-docker.cjs ${args.type} --push`);
  }

  // ============================================
  // Step 5: Test (optional)
  // ============================================
  if (args.test) {
    console.log('');
    log.info('========================================');
    log.info('  Testing AIO Image');
    log.info('========================================');
    console.log('');

    // Check prerequisites
    const envDockerFile = path.join(projectRoot, 'backend', '.env.docker');
    if (!fs.existsSync(envDockerFile)) {
      log.warn('⚠️  backend/.env.docker not found');

      const envFile = path.join(projectRoot, 'backend', '.env');
      const envDockerExample = path.join(projectRoot, 'backend', '.env.docker.example');

      if (fs.existsSync(envFile)) {
        log.gray('   Creating from backend/.env...');
        let envContent = fs.readFileSync(envFile, 'utf8');
        envContent = envContent
          .replace(/DATABASE_URL=postgresql:\/\/[^@]+@localhost:/g, 'DATABASE_URL=postgresql://postgres:postgres@m3w-postgres:')
          .replace(/MINIO_ENDPOINT=localhost/g, 'MINIO_ENDPOINT=m3w-minio')
          .replace(/CORS_ORIGIN=http:\/\/localhost:3000/g, 'CORS_ORIGIN=http://localhost:4000');
        fs.writeFileSync(envDockerFile, envContent);
        log.success('   ✅ Created with Docker network settings');
      } else if (fs.existsSync(envDockerExample)) {
        log.gray('   Creating from .env.docker.example...');
        fs.copyFileSync(envDockerExample, envDockerFile);
        log.success('   ✅ Created from template');
        log.warn('   ⚠️  Please update GitHub OAuth credentials in backend/.env.docker');
      } else {
        log.error('❌ Neither .env nor .env.docker.example found');
        process.exit(1);
      }
    }

    // Check if m3w_default network exists
    const networks = execOutput(`${container.runtime} network ls --format "{{.Name}}"`);
    if (!networks.includes('m3w_default')) {
      log.warn("⚠️  Docker network 'm3w_default' not found");
      log.gray('   Starting PostgreSQL and MinIO with docker-compose...');

      exec(`${container.compose} up -d`);
      await sleep(5000);
    }

    // Stop existing test container
    const containers = execOutput(`${container.runtime} ps -a --format "{{.Names}}"`);
    if (containers.includes('m3w-test')) {
      log.gray('   Stopping existing test container...');
      exec(`${container.runtime} stop m3w-test`, { silent: true });
      exec(`${container.runtime} rm m3w-test`, { silent: true });
    }

    // Start test container using docker-compose.test.yml
    console.log('');
    log.warn('🚀 Starting AIO container...');

    const testComposeFile = path.join(projectRoot, 'docker', 'docker-compose.test.yml');
    process.env.M3W_IMAGE = `${args.registry}/m3w:${version}`;

    if (!exec(`${container.compose} -f "${testComposeFile}" up -d`)) {
      log.error('❌ Failed to start test container');
      process.exit(1);
    }

    // Wait for container to be ready
    log.gray('   Waiting for container to be ready...');
    await sleep(5000);

    // Health check
    console.log('');
    log.warn('🔍 Running health checks...');

    const maxRetries = 10;
    let retryCount = 0;
    let healthy = false;

    while (retryCount < maxRetries && !healthy) {
      try {
        execSync('curl -s -f "http://localhost:4000/api/health"', { stdio: 'ignore' });
        healthy = true;
      } catch {
        retryCount++;
        if (retryCount < maxRetries) {
          log.gray(`   Retry ${retryCount}/${maxRetries}...`);
          await sleep(2000);
        }
      }
    }

    if (healthy) {
      log.success('   ✅ API health check passed');

      // Test frontend
      try {
        const frontendResponse = execOutput('curl -s "http://localhost:4000/"');
        if (frontendResponse.includes('<!DOCTYPE html>')) {
          log.success('   ✅ Frontend serving correctly');
        }
      } catch {
        log.warn('   ⚠️  Frontend check failed');
      }

      console.log('');
      log.success('========================================');
      log.success('  Test Passed! 🎉');
      log.success('========================================');
      console.log('');
      log.info('  AIO container running at: http://localhost:4000');
      console.log('');
      log.gray('  Commands:');
      log.gray(`    View logs:  ${container.runtime} logs -f m3w-test`);
      log.gray(`    Stop:       ${container.compose} -f docker/docker-compose.test.yml down`);
      console.log('');
    } else {
      log.error(`   ❌ Health check failed after ${maxRetries} retries`);
      console.log('');
      log.warn('   Container logs:');
      exec(`${container.runtime} logs m3w-test 2>&1 | tail -30`);
      process.exit(1);
    }
  }

  console.log('');
  log.success('✨ Done!');
  console.log('');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
