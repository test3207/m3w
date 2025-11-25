# M3W Production Deployment (Custom Reverse Proxy)

For production environments with existing reverse proxy (Nginx, Caddy, Traefik) and real domain.

## Features

- ✅ HTTPS support (via your reverse proxy)
- ✅ Custom domain
- ✅ Use existing infrastructure
- ✅ Maximum flexibility

## Architecture

```Text
┌──────────────────────────────────────┐
│  https://music.example.com           │
└───────────────┬──────────────────────┘
                │
        ┌───────▼────────┐
        │  Your Nginx    │  (Host server)
        │  - SSL termination
        │  - Reverse proxy
        └────┬──────┬────┘
             │      │
    ┌────────▼─┐ ┌─▼────────┐
    │Frontend  │ │ Backend  │  (Docker containers)
    │:3000     │ │ :4000    │
    └──────────┘ └──────────┘
```

## Quick Start

1. **Configure Docker services**:

   ```bash
   cp .env.example .env
   # Edit .env with your domain
   ```

2. **Start containers**:

   ```bash
   docker-compose up -d
   ```

3. **Configure your Nginx** (see `nginx-host-example.conf`)

4. **Access**: <https://music.example.com>

## Environment Variables

⚠️ Update these for your domain:

- `API_BASE_URL=https://music.example.com`
- `CORS_ORIGIN=https://music.example.com`
- `GITHUB_CALLBACK_URL=https://music.example.com/api/auth/callback`

## Host Nginx Configuration

See `nginx-host-example.conf` for a complete example.

Key points:

- SSL termination at host level
- Forward / to frontend container (:3000)
- Forward /api to backend container (:4000)
- Set X-Forwarded-* headers

## Alternatives to Nginx

### Caddy

```caddy
music.example.com {
  reverse_proxy / localhost:3000
  reverse_proxy /api/* localhost:4000
}
```

### Traefik (Docker labels)

See docker-compose.traefik.yml for example.
