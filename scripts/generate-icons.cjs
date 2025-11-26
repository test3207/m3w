/**
 * Generate PWA icons from source image
 * Requires sharp: npm install sharp --save-dev
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = path.join(__dirname, '../assets/image/fav.png');
const OUTPUT_DIR = path.join(__dirname, '../frontend/public');

const SIZES = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  // Check if source image exists
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error(`❌ Source image not found: ${SOURCE_IMAGE}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate each size
  for (const { size, name } of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, name);
    
    try {
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }

  // Generate favicon.ico (using 32x32 as base)
  try {
    const faviconPath = path.join(OUTPUT_DIR, 'favicon.ico');
    await sharp(SOURCE_IMAGE)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath.replace('.ico', '-temp.png'));
    
    // Note: Converting PNG to ICO requires additional tools
    // For now, just copy the PNG as favicon.png
    const faviconPngPath = path.join(OUTPUT_DIR, 'favicon.png');
    if (!fs.existsSync(faviconPngPath)) {
      fs.copyFileSync(SOURCE_IMAGE, faviconPngPath);
    }
    
    console.log(`✅ Copied favicon.png`);
  } catch (error) {
    console.error(`❌ Failed to generate favicon:`, error.message);
  }

  console.log('\n✨ Icon generation completed!');
}

generateIcons().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
