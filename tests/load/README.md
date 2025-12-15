# M3W Load Testing

k6 load testing scripts for M3W music player backend.

## Prerequisites

1. **Install k6**: https://k6.io/docs/get-started/installation/

   ```bash
   # macOS
   brew install k6

   # Windows (winget)
   winget install k6

   # Windows (choco)
   choco install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Running M3W instance**: The tests target a live M3W deployment.

3. **Test user credentials**: GitHub OAuth token or test user setup.

## Directory Structure

```
tests/load/
├── README.md           # This file
├── config.js           # Shared configuration
├── scripts/
│   ├── api.js          # API load test (CRUD operations)
│   ├── streaming.js    # Audio streaming test
│   ├── upload.js       # File upload test
│   └── helpers.js      # Shared utilities
└── data/
    └── .gitkeep        # Test audio files (not committed)
```

## Configuration

Edit `config.js` to set your target environment:

```javascript
export const CONFIG = {
  BASE_URL: 'http://localhost:4000',
  // ... other settings
};
```

Or use environment variables:

```bash
export K6_BASE_URL=http://localhost:4000
export K6_ACCESS_TOKEN=your-jwt-token
```

## Running Tests

### Quick Start (Smoke Test)

```bash
# Run a quick smoke test (1 VU, 30s)
k6 run tests/load/scripts/api.js --env SMOKE=true
```

### API Load Test

```bash
# Default: 10 VUs, 1 minute
k6 run tests/load/scripts/api.js

# Custom VUs and duration
k6 run tests/load/scripts/api.js --vus 50 --duration 5m

# With access token
k6 run tests/load/scripts/api.js --env ACCESS_TOKEN=eyJhbG...
```

### Audio Streaming Test

```bash
# Requires at least one song in the database
k6 run tests/load/scripts/streaming.js --env SONG_ID=clxxxxx

# Test with multiple songs
k6 run tests/load/scripts/streaming.js --env SONG_IDS=id1,id2,id3
```

### Upload Test

```bash
# Requires test audio files in tests/load/data/
k6 run tests/load/scripts/upload.js --env LIBRARY_ID=clxxxxx
```

### Full Suite

```bash
# Run all tests sequentially
k6 run tests/load/scripts/api.js && \
k6 run tests/load/scripts/streaming.js && \
k6 run tests/load/scripts/upload.js
```

## Test Scenarios

### 1. API Load Test (`api.js`)

Simulates typical API usage patterns:

| Scenario | Weight | Operations |
|----------|--------|------------|
| Browse | 60% | List libraries, playlists, songs |
| Playback | 30% | Get song metadata, update progress |
| Manage | 10% | Create/update/delete operations |

### 2. Streaming Test (`streaming.js`)

Tests audio streaming performance:

- Full file downloads
- Range requests (seek simulation)
- Concurrent streams
- Various file sizes (3-15MB)

### 3. Upload Test (`upload.js`)

Tests file upload pipeline:

- Single file uploads
- Concurrent uploads
- Metadata extraction timing
- Large file handling

## Metrics & Thresholds

Default thresholds (configurable in each script):

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p(95) < 500ms | 95th percentile response time |
| `http_req_failed` | < 1% | Error rate |
| `http_reqs` | - | Requests per second (informational) |

### Custom Metrics

Each test exports custom metrics:

- `api_browse_duration` - Time to list resources
- `api_crud_duration` - Time for CRUD operations
- `stream_ttfb` - Time to first byte for streaming
- `stream_throughput` - Bytes per second
- `upload_duration` - Total upload time

## Output Formats

### Console Summary (default)

```bash
k6 run tests/load/scripts/api.js
```

### JSON Output

```bash
k6 run tests/load/scripts/api.js --out json=results.json
```

### InfluxDB (for Grafana dashboards)

```bash
k6 run tests/load/scripts/api.js --out influxdb=http://localhost:8086/k6
```

### Cloud (k6 Cloud)

```bash
k6 cloud tests/load/scripts/api.js
```

## CI Integration

Example GitHub Actions workflow:

```yaml
- name: Run Load Tests
  run: |
    k6 run tests/load/scripts/api.js \
      --env BASE_URL=${{ secrets.TEST_BASE_URL }} \
      --env ACCESS_TOKEN=${{ secrets.TEST_ACCESS_TOKEN }} \
      --out json=k6-results.json
```

## Interpreting Results

### Good Performance

```
✓ http_req_duration..............: avg=45ms  p(95)=120ms
✓ http_req_failed................: 0.00%
  http_reqs......................: 15000  250/s
```

### Performance Issues

```
✗ http_req_duration..............: avg=850ms p(95)=2.5s   ← Too slow
✗ http_req_failed................: 5.2%                   ← High error rate
  http_reqs......................: 3000   50/s            ← Low throughput
```

## Troubleshooting

### "Connection refused"

- Ensure M3W is running at the configured BASE_URL
- Check firewall/network settings

### "401 Unauthorized"

- Provide valid ACCESS_TOKEN
- Token may have expired (6h default)

### "No songs found"

- Upload test songs first
- Provide SONG_ID or SONG_IDS environment variable

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
