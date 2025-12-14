<p align="center">
  <img src="assets/image/fav.png" width="128" alt="M3W Logo" />
</p>

<h1 align="center">M3W</h1>

<p align="center">
  <strong>Self-hosted Music Player</strong><br>
  Own your music. Play anywhere.
</p>

<p align="center">
  <a href="https://github.com/test3207/m3w/releases"><img src="https://img.shields.io/github/v/release/test3207/m3w?include_prereleases&label=version" alt="Version"></a>
  <a href="https://github.com/test3207/m3w/blob/main/LICENSE"><img src="https://img.shields.io/github/license/test3207/m3w" alt="License"></a>
  <a href="https://github.com/test3207/m3w/actions"><img src="https://img.shields.io/github/actions/workflow/status/test3207/m3w/pr-check.yml?label=build" alt="Build"></a>
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Docs</a>
</p>

---

## Why Self-Host?

> *"Due to licensing restrictions, this song is no longer available in your region."*
>
> — Every streaming service, eventually

With M3W, **your music stays yours**. No songs mysteriously disappearing. No "this content is unavailable." No algorithms deciding what you can listen to.

## Features

- 🎵 **Multiple Libraries** — Organize music into separate collections
- 📝 **Cross-Library Playlists** — Mix songs from different libraries
- 📱 **Mobile-First** — Designed for phones, works on desktop
- 🔌 **Offline Mode** — Full functionality without an account or internet
- 🏠 **Self-Hosted** — Your data stays on your server, forever
- ⚡ **PWA Ready** — Install as an app, play cached music offline

## Quick Start

### Online Demo

Try M3W at [m3w.test3207.top](https://m3w.test3207.top)

- **Online Mode**: Sign in with GitHub for multi-device sync
- **Offline Mode**: Click "Offline Mode" to use locally in your browser

> ⚠️ Demo data is reset periodically. For permanent storage, deploy your own instance.

### Self-Hosted Deployment

Deploy M3W with Docker Compose (PostgreSQL + MinIO included):

```bash
# Download compose file
curl -sL https://raw.githubusercontent.com/test3207/m3w/main/docker/examples/simple/docker-compose.yml \
  -o docker-compose.yml

# Configure environment (edit docker-compose.yml)
# - Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for login
# - Or leave empty for offline-only mode

# Start all services
docker compose up -d

# Visit http://localhost:4000
```

See [Deployment Guide](./docker/README.md) for detailed configuration options.

### Build from Source

```bash
git clone https://github.com/test3207/m3w.git
cd m3w
node scripts/setup.cjs   # Install deps, start containers, run migrations
npm run dev              # http://localhost:3000
```

Requires Node.js 25+ and Docker/Podman. See [Development Guide](./docs/DEVELOPMENT.md).

## Screenshots

<!-- Coming soon -->
<p align="center">
  <em>Screenshots coming soon</em>
</p>

## How It Works

```
+---------------------------------------------+
|                   Browser                   |
|                                             |
|  +---------+  +---------+  +---------+      |
|  |Libraries|  |Playlists|  | Player  |      |
|  +---------+  +---------+  +---------+      |
|                    |                        |
|         +----------+----------+             |
|         |  Offline Mode (PWA) |             |
|         | IndexedDB + Cache   |             |
|         +----------+----------+             |
+--------------------+------------------------+
                     |
                     v (optional)
          +----------------------+
          |  Self-Hosted Server  |
          | PostgreSQL  + MinIO  |
          +----------------------+
```

**Offline Mode**: Everything runs in your browser. Music files are cached locally.

**With Server**: Sync across devices, persistent storage, GitHub authentication.

## Tech Stack

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white" alt="Hono">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white" alt="PWA">
</p>

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](./docker/README.md) | Docker Compose deployment options |
| [Development Guide](./docs/DEVELOPMENT.md) | Local development setup |
| [PWA & Offline](./docs/PWA_OFFLINE_GUIDE.md) | Offline functionality details |
| [LAN Access](./docs/LAN_ACCESS.md) | Access from other devices |

## Roadmap

### ✅ Completed

- Core playback with offline PWA support
- Multi-library & playlist management
- Mobile-first responsive UI
- GitHub OAuth authentication
- Demo mode with periodic data reset
- Offline browsing for logged-in users

### 📋 Planned

- Guest data migration to account
- Lyrics display
- Desktop app

See [GitHub Issues](https://github.com/test3207/m3w/issues) for detailed progress.

## Contributing

Contributions are welcome! Please read the [Development Guide](./docs/DEVELOPMENT.md) first.

```bash
# Fork, clone, then:
git checkout -b feature/your-feature
npm run test
npm run lint
git commit -m "feat: your feature"
```

## License

[MIT](./LICENSE) © 2025 test3207
