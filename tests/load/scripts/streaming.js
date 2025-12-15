/**
 * M3W Audio Streaming Load Test
 *
 * Tests audio streaming performance:
 * - Full file downloads
 * - Range requests (seek simulation)
 * - Concurrent streams
 * - Time to first byte (TTFB)
 *
 * Usage:
 *   k6 run tests/load/scripts/streaming.js --env SONG_ID=clxxxxx
 *   k6 run tests/load/scripts/streaming.js --env SONG_IDS=id1,id2,id3
 */

import http from 'k6/http';
import { sleep, group, check } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';
import { CONFIG, ENDPOINTS, getOptions } from '../config.js';
import {
  buildUrl,
  getHeaders,
  authGet,
  parseJson,
  randomItem,
  formatBytes,
  verifySetup,
} from './helpers.js';

// Custom metrics
const streamTtfb = new Trend('stream_ttfb', true);
const streamDuration = new Trend('stream_duration', true);
const streamThroughput = new Gauge('stream_throughput_bps');
const rangeRequestDuration = new Trend('range_request_duration', true);
const streamErrors = new Counter('stream_errors');

// Test options - streaming is more resource intensive
export const options = {
  ...getOptions('load'),
  thresholds: {
    ...getOptions('load').thresholds,
    stream_ttfb: ['p(95)<200'], // TTFB under 200ms
    stream_duration: ['p(95)<5000'], // Full stream under 5s
  },
};

// Setup: get available songs
export function setup() {
  verifySetup();

  const data = {
    songs: [],
  };

  // Use provided song IDs
  if (CONFIG.SONG_IDS.length > 0) {
    data.songs = CONFIG.SONG_IDS.map((id) => ({ id }));
    console.log(`Using ${data.songs.length} provided song IDs`);
    return data;
  }

  if (CONFIG.SONG_ID) {
    data.songs = [{ id: CONFIG.SONG_ID }];
    console.log(`Using single song ID: ${CONFIG.SONG_ID}`);
    return data;
  }

  // Fetch songs from API
  if (CONFIG.ACCESS_TOKEN) {
    const libRes = authGet(ENDPOINTS.libraries);
    if (libRes.status === 200) {
      const libs = parseJson(libRes)?.data || [];
      if (libs.length > 0) {
        const songsRes = authGet(ENDPOINTS.librarySongs(libs[0].id));
        if (songsRes.status === 200) {
          data.songs = parseJson(songsRes)?.data || [];
        }
      }
    }
  }

  if (data.songs.length === 0) {
    console.warn(
      'No songs available. Provide SONG_ID or SONG_IDS environment variable.'
    );
  } else {
    console.log(`Setup complete: ${data.songs.length} songs available`);
  }

  return data;
}

// Main test function
export default function (data) {
  if (data.songs.length === 0) {
    console.log('Skipping: No songs available');
    sleep(1);
    return;
  }

  const song = randomItem(data.songs);

  // Randomly choose test type
  const testType = Math.random();

  if (testType < 0.4) {
    fullStreamTest(song);
  } else if (testType < 0.8) {
    rangeRequestTest(song);
  } else {
    seekSimulationTest(song);
  }

  sleep(Math.random() * 2 + 0.5);
}

/**
 * Test: Full audio stream download
 */
function fullStreamTest(song) {
  group('Full Stream', () => {
    const url = buildUrl(ENDPOINTS.songStream(song.id));
    const headers = getHeaders();

    const startTime = Date.now();
    const response = http.get(url, {
      headers,
      responseType: 'binary',
    });
    const duration = Date.now() - startTime;

    // Record metrics
    streamTtfb.add(response.timings.waiting);
    streamDuration.add(duration);

    const bodySize = response.body ? response.body.byteLength || 0 : 0;
    if (duration > 0 && bodySize > 0) {
      const throughput = (bodySize * 8) / (duration / 1000); // bits per second
      streamThroughput.add(throughput);
    }

    const success = check(response, {
      'Full stream: status is 200': (r) => r.status === 200,
      'Full stream: has content': (r) =>
        r.body && (r.body.byteLength || r.body.length) > 0,
      'Full stream: content-type is audio': (r) =>
        r.headers['Content-Type']?.includes('audio') ||
        r.headers['content-type']?.includes('audio'),
    });

    if (!success) {
      streamErrors.add(1);
      if (CONFIG.DEBUG) {
        console.log(`Stream failed: ${response.status} - ${response.body}`);
      }
    }

    if (CONFIG.DEBUG) {
      console.log(
        `Full stream: ${formatBytes(bodySize)} in ${duration}ms (TTFB: ${response.timings.waiting}ms)`
      );
    }
  });
}

/**
 * Test: Range request (partial content)
 */
function rangeRequestTest(song) {
  group('Range Request', () => {
    const url = buildUrl(ENDPOINTS.songStream(song.id));
    const headers = {
      ...getHeaders(),
      Range: 'bytes=0-65535', // First 64KB
    };

    const startTime = Date.now();
    const response = http.get(url, {
      headers,
      responseType: 'binary',
    });
    const duration = Date.now() - startTime;

    rangeRequestDuration.add(duration);
    streamTtfb.add(response.timings.waiting);

    const success = check(response, {
      'Range request: status is 206 or 200': (r) =>
        r.status === 206 || r.status === 200,
      'Range request: has content': (r) =>
        r.body && (r.body.byteLength || r.body.length) > 0,
    });

    if (!success) {
      streamErrors.add(1);
    }

    if (CONFIG.DEBUG) {
      const bodySize = response.body ? response.body.byteLength || 0 : 0;
      console.log(
        `Range request: ${formatBytes(bodySize)} in ${duration}ms (status: ${response.status})`
      );
    }
  });
}

/**
 * Test: Seek simulation (multiple range requests)
 */
function seekSimulationTest(song) {
  group('Seek Simulation', () => {
    // Simulate user seeking through a song
    const seekPositions = [0, 0.25, 0.5, 0.75, 0.9]; // Seek to different parts
    const chunkSize = 65536; // 64KB per request

    for (const position of seekPositions) {
      // Calculate byte offset (assume ~5MB file)
      const fileSize = 5 * 1024 * 1024;
      const startByte = Math.floor(fileSize * position);
      const endByte = startByte + chunkSize - 1;

      const url = buildUrl(ENDPOINTS.songStream(song.id));
      const headers = {
        ...getHeaders(),
        Range: `bytes=${startByte}-${endByte}`,
      };

      const startTime = Date.now();
      const response = http.get(url, {
        headers,
        responseType: 'binary',
      });
      const duration = Date.now() - startTime;

      rangeRequestDuration.add(duration);

      const success = check(response, {
        [`Seek ${Math.floor(position * 100)}%: status ok`]: (r) =>
          r.status === 206 || r.status === 200,
      });

      if (!success) {
        streamErrors.add(1);
      }

      // Small delay between seeks
      sleep(0.2);
    }
  });
}

// Teardown
export function teardown(data) {
  console.log('\n=== Streaming Test Summary ===');
  console.log(`Songs tested: ${data.songs.length}`);
}
