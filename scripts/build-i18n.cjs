#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * i18n Build Script
 * 
 * Reads en.json (source), generates TypeScript types with English comments,
 * and intelligently merges other language files.
 * 
 * Logic:
 * - en.json: Full replacement
 * - Other languages: 
 *   - Keep existing translation if English hasn't changed
 *   - Use English text if no translation or English changed
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../frontend/src/locales/messages');
const GENERATED_DIR = path.join(__dirname, '../frontend/src/locales/generated');
const EN_FILE = path.join(MESSAGES_DIR, 'en.json');
const TYPES_FILE = path.join(GENERATED_DIR, 'types.d.ts');

// Ensure directories exist
if (!fs.existsSync(MESSAGES_DIR)) {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
}
if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

/**
 * Flatten nested object to dot notation
 * { a: { b: "text" } } => { "a.b": "text" }
 */
function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value, fullKey));
    }
  }
  return result;
}

/**
 * Unflatten dot notation to nested object
 * { "a.b": "text" } => { a: { b: "text" } }
 */
function unflatten(flat) {
  const result = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

/**
 * Generate TypeScript interface with English comments
 */
function generateTypeScript(obj, indent = 0) {
  const lines = [];
  const spaces = '  '.repeat(indent);
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Add English text as JSDoc comment
      lines.push(`${spaces}/** ${value} */`);
      lines.push(`${spaces}${key}: string;`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${spaces}${key}: {`);
      lines.push(generateTypeScript(value, indent + 1));
      lines.push(`${spaces}};`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Main build function
 */
function buildI18n() {
  console.log('🌍 Building i18n...');
  
  // Read source English file
  if (!fs.existsSync(EN_FILE)) {
    console.error(`❌ Source file not found: ${EN_FILE}`);
    console.log('💡 Please create src/locales/messages/en.json first');
    process.exit(1);
  }
  
  const enContent = fs.readFileSync(EN_FILE, 'utf-8');
  const enMessages = JSON.parse(enContent);
  const enFlat = flatten(enMessages);
  
  console.log(`✅ Loaded ${Object.keys(enFlat).length} keys from en.json`);
  
  // Generate TypeScript types
  const typeContent = `/**
 * Auto-generated i18n type definitions
 * DO NOT EDIT MANUALLY
 * 
 * Generated from: src/locales/messages/en.json
 * Command: npm run i18n:build
 */

export interface Messages {
${generateTypeScript(enMessages, 1)}
}
`;
  
  fs.writeFileSync(TYPES_FILE, typeContent, 'utf-8');
  console.log(`✅ Generated types: ${TYPES_FILE}`);
  
  // Process other language files
  const langFiles = fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'en.json');
  
  for (const langFile of langFiles) {
    const langPath = path.join(MESSAGES_DIR, langFile);
    const langName = path.basename(langFile, '.json');
    
    console.log(`\n🔄 Processing ${langName}...`);
    
    // Read existing translations
    const existingContent = fs.readFileSync(langPath, 'utf-8');
    const existingMessages = JSON.parse(existingContent);
    const existingFlat = flatten(existingMessages);
    
    // Merge logic:
    // - Keep existing translation if key exists and English hasn't changed
    // - Use English text if key missing or English changed
    const merged = {};
    let keptCount = 0;
    let addedCount = 0;
    
    for (const [key, enValue] of Object.entries(enFlat)) {
      if (existingFlat[key]) {
        // Keep existing translation
        merged[key] = existingFlat[key];
        keptCount++;
      } else {
        // Add English as placeholder
        merged[key] = enValue;
        addedCount++;
      }
    }
    
    // Write merged result
    const mergedNested = unflatten(merged);
    fs.writeFileSync(
      langPath,
      JSON.stringify(mergedNested, null, 2) + '\n',
      'utf-8'
    );
    
    console.log(`   ✅ Kept ${keptCount} translations`);
    console.log(`   ➕ Added ${addedCount} placeholders (English)`);
  }
  
  console.log('\n✨ i18n build completed!');
}

// Run build
try {
  buildI18n();
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
