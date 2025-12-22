/**
 * Update Lighthouse badges in README files
 * 
 * This script parses Lighthouse CI results and updates badge URLs in README.md
 * and README.zh-CN.md with the actual scores.
 * 
 * Usage: node scripts/update-lighthouse-badges.cjs
 * 
 * Environment variables:
 *   MANIFEST_PATH - Path to Lighthouse CI manifest.json (optional)
 *                   If not provided, defaults to '.lighthouseci/manifest.json'
 * 
 * Fallback behavior:
 *   1. Try MANIFEST_PATH or default manifest.json
 *   2. If manifest not found, look for any .json file in .lighthouseci/
 *   3. If no manifest available, try lhr-*.json files directly
 */

const fs = require('fs');

/**
 * Extract scores from Lighthouse report
 * @param {Object} report - Lighthouse report object
 * @returns {Object} Scores object with performance, accessibility, best-practices, seo, pwa
 * @throws {Error} If report structure is invalid
 */
function getScores(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Invalid Lighthouse report: report is missing or not an object');
  }
  
  const categories = report.categories;
  if (!categories || typeof categories !== 'object') {
    throw new Error('Invalid Lighthouse report: "categories" is missing or not an object');
  }
  
  const requiredCategories = ['performance', 'accessibility', 'best-practices', 'seo'];
  for (const key of requiredCategories) {
    const category = categories[key];
    if (!category || typeof category.score !== 'number') {
      throw new Error(`Invalid Lighthouse report: missing or invalid "score" for category "${key}"`);
    }
  }
  
  return {
    performance: Math.round(categories.performance.score * 100),
    accessibility: Math.round(categories.accessibility.score * 100),
    'best-practices': Math.round(categories['best-practices'].score * 100),
    seo: Math.round(categories.seo.score * 100),
    // PWA is optional - may not be present in all Lighthouse reports
    pwa: Math.round((categories.pwa?.score || 0) * 100)
  };
}

// Color based on score
function getColor(score) {
  if (score >= 90) return 'brightgreen';
  if (score >= 50) return 'orange';
  return 'red';
}

// Update README badges
function updateReadme(filePath, badges) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
    return;
  }
  
  // Replace each badge - always update all badges including PWA
  content = content.replace(
    /https:\/\/img\.shields\.io\/badge\/Performance-\d+%25-\w+/g,
    badges.performance
  );
  content = content.replace(
    /https:\/\/img\.shields\.io\/badge\/Accessibility-\d+%25-\w+/g,
    badges.accessibility
  );
  content = content.replace(
    /https:\/\/img\.shields\.io\/badge\/Best%20Practices-\d+%25-\w+/g,
    badges['best-practices']
  );
  content = content.replace(
    /https:\/\/img\.shields\.io\/badge\/SEO-\d+%25-\w+/g,
    badges.seo
  );
  content = content.replace(
    /https:\/\/img\.shields\.io\/badge\/PWA-\d+%25-\w+/g,
    badges.pwa
  );
  
  try {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  } catch (err) {
    console.error(`Failed to write ${filePath}: ${err.message}`);
  }
}

function main() {
  // Step 1: Try to read manifest from MANIFEST_PATH or default location
  const manifestPath = (process.env.MANIFEST_PATH && process.env.MANIFEST_PATH.trim()) || '.lighthouseci/manifest.json';
  let manifest;
  
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    // Step 2: Manifest not found - look for any .json file in .lighthouseci/
    // This handles cases where Lighthouse CI output structure varies
    let files = [];
    try {
      if (fs.existsSync('.lighthouseci')) {
        files = fs
          .readdirSync('.lighthouseci')
          .filter(f => f.endsWith('.json') && f !== 'manifest.json');
      }
    } catch (dirErr) {
      // Directory doesn't exist or not readable - will be handled below
    }
    
    if (files.length > 0) {
      manifest = [{ summary: '.lighthouseci/' + files[0] }];
    } else {
      console.error('No lighthouse results found');
      process.exit(1);
    }
  }
  
  // Step 3: Extract report path from manifest
  const result = Array.isArray(manifest) ? manifest[0] : manifest;
  const summaryPath = result.summary || result.jsonPath;
  
  let scores;
  if (summaryPath && fs.existsSync(summaryPath)) {
    const report = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    scores = getScores(report);
  } else {
    // Step 4: Direct fallback - try lhr-*.json files if summary path is invalid
    if (fs.existsSync('.lighthouseci')) {
      const lhrFiles = fs.readdirSync('.lighthouseci').filter(f => f.startsWith('lhr-') && f.endsWith('.json'));
      if (lhrFiles.length > 0) {
        const report = JSON.parse(fs.readFileSync('.lighthouseci/' + lhrFiles[0], 'utf8'));
        scores = getScores(report);
      }
    }
  }
  
  if (!scores) {
    console.error('Could not extract scores');
    process.exit(1);
  }
  
  console.log('Scores:', scores);
  
  // Special case labels (acronyms should be uppercase)
  const labelMap = {
    'performance': 'Performance',
    'accessibility': 'Accessibility',
    'best-practices': 'Best Practices',
    'seo': 'SEO',
    'pwa': 'PWA'
  };
  
  // Generate badge URLs for shields.io
  const badges = {};
  for (const [key, score] of Object.entries(scores)) {
    const label = labelMap[key] || key
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const color = getColor(score);
    badges[key] = `https://img.shields.io/badge/${encodeURIComponent(label)}-${score}%25-${color}`;
  }
  
  // Save scores JSON for README generation
  try {
    fs.writeFileSync('assets/lighthouse/scores.json', JSON.stringify({ scores, badges, timestamp: new Date().toISOString() }, null, 2));
    console.log('Scores saved to assets/lighthouse/scores.json');
  } catch (err) {
    console.error(`Failed to write scores.json: ${err.message}`);
  }
  
  // Update READMEs
  updateReadme('README.md', badges);
  updateReadme('README.zh-CN.md', badges);
}

main();
