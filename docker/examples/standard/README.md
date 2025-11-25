# M3W Standard Deployment (Separated Containers)

Frontend and backend run in separate containers with internal Nginx reverse proxy.

## Features

- ✅ Separated frontend/backend
- ✅ Independent scaling
- ✅ Built-in Nginx (no host configuration needed)
- ✅ Single entry point (port 80)

## Architecture

```Text
┌─────────────────────────────────────┐
│  http://localhost                   │
└───────────────┬─────────────────────┘
                │
        ┌───────▼────────┐
        │  Frontend      │
        │  (Nginx:80)    │
        │  - Serve static│
        │  - Proxy /api  │
        └───────┬────────┘
                │ /api
        ┌───────▼────────┐
        │  Backend       │
        │  (Node:4000)   │
        └────────────────┘
```

## Quick Start

1. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env
   ```

2. **Start services**:

   ```bash
   docker-compose up -d
   ```

3. **Access**: <http://localhost> (port 80)

## Environment Variables

- `API_BASE_URL`: Set to `http://localhost` (frontend domain)
- `CORS_ORIGIN`: Set to `http://localhost`
- `GITHUB_CALLBACK_URL`: Set to `http://localhost/api/auth/callback`

## Use Cases

- Medium traffic websites
- When you need independent frontend/backend scaling
- Staging environments
