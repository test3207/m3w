/**
 * Generate optimized PWA icons from source image
 * Requires sharp: npm install -D sharp (in root)
 *
 * All output images are optimized for size:
 * - favicon.png: 32x32, target < 10KB
 * - pwa-192x192.png: 192x192, optimized
 * - pwa-512x512.png: 512x512, optimized
 * - apple-touch-icon.png: 180x180, optimized
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = path.join(__dirname, '../assets/image/fav.png');
const OUTPUT_DIR = path.join(__dirname, '../frontend/public');

// PNG optimization settings
const PNG_OPTIONS = {
  compressionLevel: 9, // Maximum compression
  palette: true, // Use palette-based PNG (smaller file size)
};

const SIZES = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon.png' }, // Favicon should be small!
];

async function generateIcons() {
  console.log('🎨 Generating optimized PWA icons...\n');

  // Check if source image exists
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error(`❌ Source image not found: ${SOURCE_IMAGE}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let totalSaved = 0;

  // Generate each size with optimization
  for (const { size, name } of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, name);

    try {
      // Get original size if file exists
      let originalSize = 0;
      if (fs.existsSync(outputPath)) {
        originalSize = fs.statSync(outputPath).size;
      }

      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png(PNG_OPTIONS)
        .toFile(outputPath);

      const newSize = fs.statSync(outputPath).size;
      const sizeKB = (newSize / 1024).toFixed(2);

      if (originalSize > 0) {
        const savedKB = ((originalSize - newSize) / 1024).toFixed(2);
        const savedPercent = (
          ((originalSize - newSize) / originalSize) *
          100
        ).toFixed(1);
        totalSaved += originalSize - newSize;
        console.log(
          `✅ ${name.padEnd(22)} ${size}x${size} → ${sizeKB}KB (saved ${savedKB}KB, ${savedPercent}%)`
        );
      } else {
        console.log(`✅ ${name.padEnd(22)} ${size}x${size} → ${sizeKB}KB`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }

  console.log('\n✨ Icon generation completed!');
  if (totalSaved > 0) {
    console.log(`📉 Total saved: ${(totalSaved / 1024).toFixed(2)}KB`);
  }
}

generateIcons().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
