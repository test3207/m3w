# M3W All-in-One Deployment (Simple)

This is the simplest deployment option - everything runs in a single container.

## Features

- ✅ Single container (frontend + backend)
- ✅ Minimal configuration
- ✅ Perfect for personal use or testing

## Quick Start

1. **Configure environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your settings (JWT_SECRET, GitHub OAuth, etc.)
   ```

2. **Start services**:

   ```bash
   docker-compose up -d
   ```

3. **Access the app**:
   - Open <http://localhost:4000>
   - Both frontend and backend on same port

## Environment Variables

See `.env.example` for all available options. Key variables:

- `JWT_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: From GitHub OAuth app
- `GITHUB_CALLBACK_URL`: Set to `http://localhost:4000/api/auth/callback`
- `API_BASE_URL`: Set to `http://localhost:4000`
- `CORS_ORIGIN`: Set to `http://localhost:4000`

## Scaling Limitations

This deployment is not suitable for:

- High traffic (frontend and backend share resources)
- Independent scaling (both are in one container)
- CDN integration (frontend is served by backend)

For production or scaling needs, use the **standard** or **production** examples.
