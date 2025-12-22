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
 */

const fs = require('fs');

// Helper function to extract scores from report
function getScores(report) {
  return {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    'best-practices': Math.round(report.categories['best-practices'].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    pwa: Math.round((report.categories.pwa?.score || 0) * 100)
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
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace each badge
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
  if (badges.pwa) {
    content = content.replace(
      /https:\/\/img\.shields\.io\/badge\/PWA-\d+%25-\w+/g,
      badges.pwa
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

function main() {
  // Read manifest
  const manifestPath = (process.env.MANIFEST_PATH && process.env.MANIFEST_PATH.trim()) || '.lighthouseci/manifest.json';
  let manifest;
  
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    // Try alternative path if manifest file is not readable
    let files = [];
    try {
      if (fs.existsSync('.lighthouseci')) {
        files = fs
          .readdirSync('.lighthouseci')
          .filter(f => f.endsWith('.json') && f !== 'manifest.json');
      }
    } catch (dirErr) {
      // Ignore and handle as "no results"
    }
    
    if (files.length > 0) {
      manifest = [{ summary: '.lighthouseci/' + files[0] }];
    } else {
      console.error('No lighthouse results found');
      process.exit(1);
    }
  }
  
  // Get the first result
  const result = Array.isArray(manifest) ? manifest[0] : manifest;
  const summaryPath = result.summary || result.jsonPath;
  
  let scores;
  if (summaryPath && fs.existsSync(summaryPath)) {
    const report = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    scores = getScores(report);
  } else {
    // Try to find lhr file
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
  fs.writeFileSync('assets/lighthouse/scores.json', JSON.stringify({ scores, badges, timestamp: new Date().toISOString() }, null, 2));
  console.log('Scores saved to assets/lighthouse/scores.json');
  
  // Update READMEs
  updateReadme('README.md', badges);
  updateReadme('README.zh-CN.md', badges);
}

main();
