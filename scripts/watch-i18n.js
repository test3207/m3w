#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * i18n Watcher
 * 
 * Watches en.json for changes and triggers rebuild.
 * Used during `next dev` to auto-regenerate types and translations.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const EN_FILE = path.join(__dirname, '../src/locales/messages/en.json');

console.log('👀 Watching for i18n changes...');
console.log(`📂 Watching: ${EN_FILE}\n`);

let isBuilding = false;

function rebuild() {
  if (isBuilding) {
    console.log('⏳ Build already in progress, skipping...');
    return;
  }
  
  isBuilding = true;
  console.log('🔨 Detected change, rebuilding i18n...');
  
  exec('node scripts/build-i18n.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Build failed:', error);
      console.error(stderr);
    } else {
      console.log(stdout);
    }
    isBuilding = false;
  });
}

// Watch en.json for changes
if (fs.existsSync(EN_FILE)) {
  fs.watch(EN_FILE, (eventType) => {
    if (eventType === 'change') {
      rebuild();
    }
  });
  
  console.log('✅ Watcher started successfully');
  console.log('💡 Edit en.json to trigger auto-rebuild\n');
} else {
  console.error(`❌ File not found: ${EN_FILE}`);
  console.log('💡 Please create src/locales/messages/en.json first');
  process.exit(1);
}

// Keep process alive
process.stdin.resume();
