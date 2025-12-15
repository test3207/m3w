/**
 * M3W Upload Load Test
 *
 * Tests file upload performance:
 * - Single file uploads
 * - Concurrent uploads
 * - Metadata extraction timing
 * - Various file sizes
 *
 * Prerequisites:
 * - Test audio files in tests/load/data/ directory
 * - Valid ACCESS_TOKEN
 * - LIBRARY_ID to upload to
 *
 * Usage:
 *   k6 run tests/load/scripts/upload.js --env LIBRARY_ID=clxxxxx
 */

import http from 'k6/http';
import { sleep, group, check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { CONFIG, ENDPOINTS, getOptions } from '../config.js';
import {
  buildUrl,
  getHeaders,
  authGet,
  parseJson,
  randomItem,
  randomString,
  formatBytes,
  verifySetup,
} from './helpers.js';

// Custom metrics
const uploadDuration = new Trend('upload_duration', true);
const uploadThroughput = new Trend('upload_throughput_bps', true);
const metadataExtractionTime = new Trend('metadata_extraction_time', true);
const uploadErrors = new Counter('upload_errors');
const uploadSuccess = new Rate('upload_success_rate');

// Test options - uploads are slow, use fewer VUs
export const options = {
  ...getOptions('load'),
  // Override for upload tests
  stages: CONFIG.SMOKE
    ? undefined
    : [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 5 },
        { duration: '30s', target: 0 },
      ],
  thresholds: {
    upload_duration: ['p(95)<30000'], // 30s for large files
    upload_success_rate: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
};

// Generate synthetic audio-like data
function generateTestAudioData(sizeBytes) {
  // Create a buffer that mimics MP3 structure
  // This is synthetic data - not a valid MP3, but tests upload mechanics
  const data = new Uint8Array(sizeBytes);

  // MP3 frame header (simplified)
  data[0] = 0xff;
  data[1] = 0xfb;
  data[2] = 0x90;
  data[3] = 0x00;

  // Fill rest with pseudo-random data
  for (let i = 4; i < sizeBytes; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }

  return data;
}

// Test file configurations
const TEST_FILES = [
  { name: 'small', size: 3 * 1024 * 1024 }, // 3MB
  { name: 'medium', size: 7 * 1024 * 1024 }, // 7MB
  { name: 'large', size: 15 * 1024 * 1024 }, // 15MB
];

// Setup
export function setup() {
  verifySetup();

  const data = {
    libraryId: CONFIG.LIBRARY_ID,
    testFiles: [],
  };

  // Get library ID if not provided
  if (!data.libraryId && CONFIG.ACCESS_TOKEN) {
    const libRes = authGet(ENDPOINTS.libraries);
    if (libRes.status === 200) {
      const libs = parseJson(libRes)?.data || [];
      if (libs.length > 0) {
        data.libraryId = libs[0].id;
        console.log(`Using library: ${libs[0].name} (${data.libraryId})`);
      }
    }
  }

  if (!data.libraryId) {
    console.warn(
      'No library ID available. Provide LIBRARY_ID environment variable.'
    );
  }

  if (!CONFIG.ACCESS_TOKEN) {
    console.warn('No ACCESS_TOKEN provided. Upload tests require authentication.');
  }

  // Pre-generate test data (only in setup, not per iteration)
  // Note: k6 doesn't persist large data well between setup and default
  // So we generate per-iteration instead

  console.log('Setup complete. Test files will be generated per iteration.');
  return data;
}

// Main test function
export default function (data) {
  if (!data.libraryId) {
    console.log('Skipping: No library ID');
    sleep(1);
    return;
  }

  if (!CONFIG.ACCESS_TOKEN) {
    console.log('Skipping: No access token');
    sleep(1);
    return;
  }

  // Select random file size
  const fileConfig = randomItem(TEST_FILES);
  uploadTest(data.libraryId, fileConfig);

  // Longer sleep for uploads (more server-intensive)
  sleep(Math.random() * 3 + 2);
}

/**
 * Upload test with synthetic file
 */
function uploadTest(libraryId, fileConfig) {
  group(`Upload ${fileConfig.name}`, () => {
    // Generate test file data
    const fileData = generateTestAudioData(fileConfig.size);
    const fileName = `loadtest_${randomString(8)}.mp3`;

    // Build multipart form data
    const url = buildUrl(ENDPOINTS.upload);

    // k6 binary file upload
    const formData = {
      libraryId: libraryId,
      file: http.file(fileData, fileName, 'audio/mpeg'),
    };

    const headers = {
      Authorization: `Bearer ${CONFIG.ACCESS_TOKEN}`,
      // Note: Don't set Content-Type for multipart - k6 handles it
    };

    const startTime = Date.now();
    const response = http.post(url, formData, { headers });
    const duration = Date.now() - startTime;

    uploadDuration.add(duration);

    // Calculate throughput
    const throughput = (fileConfig.size * 8) / (duration / 1000);
    uploadThroughput.add(throughput);

    // Check response
    const success = check(response, {
      [`Upload ${fileConfig.name}: status 200/201`]: (r) =>
        r.status === 200 || r.status === 201,
      [`Upload ${fileConfig.name}: has song data`]: (r) => {
        const json = parseJson(r);
        return json?.data?.id || json?.success;
      },
    });

    uploadSuccess.add(success);
    if (!success) {
      uploadErrors.add(1);
      if (CONFIG.DEBUG) {
        console.log(`Upload failed: ${response.status} - ${response.body}`);
      }
    }

    // Try to extract metadata timing from response
    const json = parseJson(response);
    if (json?.data?.processingTime) {
      metadataExtractionTime.add(json.data.processingTime);
    }

    if (CONFIG.DEBUG) {
      console.log(
        `Upload ${fileConfig.name}: ${formatBytes(fileConfig.size)} in ${duration}ms (${formatBytes(throughput / 8)}/s)`
      );
    }

    // Cleanup: delete uploaded file if successful
    if (success && json?.data?.id) {
      // Note: API may not support song deletion, so this is best-effort
      // The files will be cleaned up manually or by the test environment reset
    }
  });
}

// Teardown
export function teardown(data) {
  console.log('\n=== Upload Test Summary ===');
  console.log(`Library ID: ${data.libraryId || 'Not set'}`);
  console.log('Note: Test files were synthetic (not real MP3s)');
  console.log(
    'Metadata extraction may fail on synthetic files - this is expected.'
  );
}
