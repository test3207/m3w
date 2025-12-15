/**
 * M3W API Load Test
 *
 * Tests typical API usage patterns:
 * - Browse: List libraries, playlists, songs (60%)
 * - Playback: Get song metadata, update progress (30%)
 * - Manage: Create/update/delete operations (10%)
 *
 * Usage:
 *   k6 run tests/load/scripts/api.js
 *   k6 run tests/load/scripts/api.js --env SMOKE=true
 *   k6 run tests/load/scripts/api.js --vus 50 --duration 5m
 */

import { sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { CONFIG, ENDPOINTS, getOptions } from '../config.js';
import {
  authGet,
  authPost,
  authPut,
  authDelete,
  checkResponse,
  parseJson,
  randomItem,
  randomString,
  weightedRandom,
  verifySetup,
} from './helpers.js';

// Custom metrics
const browseDuration = new Trend('api_browse_duration', true);
const playbackDuration = new Trend('api_playback_duration', true);
const crudDuration = new Trend('api_crud_duration', true);
const apiErrors = new Counter('api_errors');
const successRate = new Rate('api_success_rate');

// Test options
export const options = getOptions('load');

// Setup: verify server is reachable
export function setup() {
  verifySetup();

  // Fetch initial data for test
  const data = {
    libraries: [],
    playlists: [],
    songs: [],
  };

  if (CONFIG.ACCESS_TOKEN) {
    // Get libraries
    const libRes = authGet(ENDPOINTS.libraries);
    if (libRes.status === 200) {
      const json = parseJson(libRes);
      data.libraries = json?.data || [];
    }

    // Get playlists
    const playlistRes = authGet(ENDPOINTS.playlists);
    if (playlistRes.status === 200) {
      const json = parseJson(playlistRes);
      data.playlists = json?.data || [];
    }

    // Get songs from first library
    if (data.libraries.length > 0) {
      const songsRes = authGet(ENDPOINTS.librarySongs(data.libraries[0].id));
      if (songsRes.status === 200) {
        const json = parseJson(songsRes);
        data.songs = json?.data || [];
      }
    }

    console.log(
      `Setup complete: ${data.libraries.length} libraries, ${data.playlists.length} playlists, ${data.songs.length} songs`
    );
  } else {
    console.log('No ACCESS_TOKEN provided, running unauthenticated tests only');
  }

  return data;
}

// Main test function
export default function (data) {
  // Select scenario based on weight
  const scenario = weightedRandom([
    { weight: 60, value: 'browse' },
    { weight: 30, value: 'playback' },
    { weight: 10, value: 'manage' },
  ]);

  switch (scenario) {
    case 'browse':
      browseScenario(data);
      break;
    case 'playback':
      playbackScenario(data);
      break;
    case 'manage':
      manageScenario(data);
      break;
  }

  // Think time between iterations
  sleep(Math.random() * 2 + 1);
}

/**
 * Browse scenario: List libraries, playlists, songs
 */
function browseScenario(data) {
  group('Browse', () => {
    // List libraries
    const libStart = Date.now();
    const libRes = authGet(ENDPOINTS.libraries);
    browseDuration.add(Date.now() - libStart);

    const libSuccess = checkResponse(libRes, 'List libraries');
    successRate.add(libSuccess);
    if (!libSuccess) apiErrors.add(1);

    sleep(0.5);

    // List playlists
    const playlistStart = Date.now();
    const playlistRes = authGet(ENDPOINTS.playlists);
    browseDuration.add(Date.now() - playlistStart);

    const playlistSuccess = checkResponse(playlistRes, 'List playlists');
    successRate.add(playlistSuccess);
    if (!playlistSuccess) apiErrors.add(1);

    sleep(0.5);

    // Get songs from a library
    const library = randomItem(data.libraries);
    if (library) {
      const songsStart = Date.now();
      const songsRes = authGet(ENDPOINTS.librarySongs(library.id));
      browseDuration.add(Date.now() - songsStart);

      const songsSuccess = checkResponse(songsRes, 'List library songs');
      successRate.add(songsSuccess);
      if (!songsSuccess) apiErrors.add(1);
    }
  });
}

/**
 * Playback scenario: Get song metadata, update progress
 */
function playbackScenario(data) {
  group('Playback', () => {
    const song = randomItem(data.songs);

    if (!song) {
      // Fallback: just get preferences
      const prefStart = Date.now();
      const prefRes = authGet(ENDPOINTS.playerPreferences);
      playbackDuration.add(Date.now() - prefStart);

      const prefSuccess = checkResponse(prefRes, 'Get preferences');
      successRate.add(prefSuccess);
      if (!prefSuccess) apiErrors.add(1);
      return;
    }

    // Get song metadata
    const metaStart = Date.now();
    const metaRes = authGet(ENDPOINTS.song(song.id));
    playbackDuration.add(Date.now() - metaStart);

    const metaSuccess = checkResponse(metaRes, 'Get song metadata');
    successRate.add(metaSuccess);
    if (!metaSuccess) apiErrors.add(1);

    sleep(0.3);

    // Update playback progress (simulate playing)
    const progressStart = Date.now();
    const progressRes = authPut(ENDPOINTS.playerProgress, {
      songId: song.id,
      progress: Math.floor(Math.random() * 180), // Random progress 0-180s
    });
    playbackDuration.add(Date.now() - progressStart);

    const progressSuccess = checkResponse(progressRes, 'Update progress');
    successRate.add(progressSuccess);
    if (!progressSuccess) apiErrors.add(1);

    sleep(0.3);

    // Get preferences
    const prefStart = Date.now();
    const prefRes = authGet(ENDPOINTS.playerPreferences);
    playbackDuration.add(Date.now() - prefStart);

    const prefSuccess = checkResponse(prefRes, 'Get preferences');
    successRate.add(prefSuccess);
    if (!prefSuccess) apiErrors.add(1);
  });
}

/**
 * Manage scenario: Create/update/delete operations
 */
function manageScenario(data) {
  group('Manage', () => {
    // Create a test playlist
    const playlistName = `LoadTest_${randomString(6)}`;
    const createStart = Date.now();
    const createRes = authPost(ENDPOINTS.playlists, {
      name: playlistName,
    });
    crudDuration.add(Date.now() - createStart);

    const createSuccess = checkResponse(createRes, 'Create playlist');
    successRate.add(createSuccess);
    if (!createSuccess) {
      apiErrors.add(1);
      return;
    }

    const created = parseJson(createRes);
    const playlistId = created?.data?.id;

    if (!playlistId) {
      apiErrors.add(1);
      return;
    }

    sleep(0.5);

    // Update the playlist
    const updateStart = Date.now();
    const updateRes = authPut(ENDPOINTS.playlist(playlistId), {
      name: `${playlistName}_updated`,
    });
    crudDuration.add(Date.now() - updateStart);

    const updateSuccess = checkResponse(updateRes, 'Update playlist');
    successRate.add(updateSuccess);
    if (!updateSuccess) apiErrors.add(1);

    sleep(0.5);

    // Delete the playlist (cleanup)
    const deleteStart = Date.now();
    const deleteRes = authDelete(ENDPOINTS.playlist(playlistId));
    crudDuration.add(Date.now() - deleteStart);

    const deleteSuccess = checkResponse(deleteRes, 'Delete playlist');
    successRate.add(deleteSuccess);
    if (!deleteSuccess) apiErrors.add(1);
  });
}

// Teardown: cleanup and summary
export function teardown(data) {
  console.log('\n=== Test Summary ===');
  console.log(`Libraries available: ${data.libraries.length}`);
  console.log(`Playlists available: ${data.playlists.length}`);
  console.log(`Songs available: ${data.songs.length}`);
}
