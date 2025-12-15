/**
 * M3W Load Test Configuration
 *
 * Configuration can be overridden via environment variables:
 *   k6 run script.js --env BASE_URL=http://example.com
 */

// Base configuration
export const CONFIG = {
  // Target server URL
  BASE_URL: __ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:4000',

  // Authentication
  ACCESS_TOKEN: __ENV.ACCESS_TOKEN || __ENV.K6_ACCESS_TOKEN || '',

  // Test data IDs (comma-separated for multiple)
  LIBRARY_ID: __ENV.LIBRARY_ID || '',
  PLAYLIST_ID: __ENV.PLAYLIST_ID || '',
  SONG_ID: __ENV.SONG_ID || '',
  SONG_IDS: __ENV.SONG_IDS ? __ENV.SONG_IDS.split(',') : [],

  // Test mode
  SMOKE: __ENV.SMOKE === 'true',
  DEBUG: __ENV.DEBUG === 'true',
};

// Default load test options
export const DEFAULT_OPTIONS = {
  // Smoke test: quick validation
  smoke: {
    vus: 1,
    duration: '30s',
    thresholds: {
      http_req_duration: ['p(95)<1000'],
      http_req_failed: ['rate<0.05'],
    },
  },

  // Load test: normal traffic simulation
  load: {
    stages: [
      { duration: '30s', target: 10 }, // Ramp up
      { duration: '1m', target: 10 }, // Steady state
      { duration: '30s', target: 20 }, // Peak
      { duration: '30s', target: 0 }, // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: ['rate<0.01'],
    },
  },

  // Stress test: find breaking point
  stress: {
    stages: [
      { duration: '1m', target: 20 },
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000'],
      http_req_failed: ['rate<0.10'],
    },
  },

  // Soak test: long-running stability
  soak: {
    stages: [
      { duration: '2m', target: 20 },
      { duration: '30m', target: 20 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<500'],
      http_req_failed: ['rate<0.01'],
    },
  },
};

// Get options based on test mode
export function getOptions(testType = 'load') {
  if (CONFIG.SMOKE) {
    return DEFAULT_OPTIONS.smoke;
  }

  const mode = __ENV.TEST_MODE || testType;
  return DEFAULT_OPTIONS[mode] || DEFAULT_OPTIONS.load;
}

// API endpoints
export const ENDPOINTS = {
  // Health
  health: '/health',
  ready: '/ready',

  // Auth
  authMe: '/api/auth/me',
  authRefresh: '/api/auth/refresh',

  // Libraries
  libraries: '/api/libraries',
  library: (id) => `/api/libraries/${id}`,
  librarySongs: (id) => `/api/libraries/${id}/songs`,

  // Playlists
  playlists: '/api/playlists',
  playlist: (id) => `/api/playlists/${id}`,
  playlistSongs: (id) => `/api/playlists/${id}/songs`,

  // Songs
  song: (id) => `/api/songs/${id}`,
  songStream: (id) => `/api/songs/${id}/stream`,
  songCover: (id) => `/api/songs/${id}/cover`,

  // Upload
  upload: '/api/upload',

  // Player
  playerPreferences: '/api/player/preferences',
  playerProgress: '/api/player/progress',
};
