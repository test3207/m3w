<p align="center">
  <img src="assets/image/fav.png" width="128" alt="M3W Logo" />
</p>

<h1 align="center">M3W</h1>

<p align="center">
  <strong>自托管音乐播放器</strong><br>
  你的音乐，随处播放
</p>

<p align="center">
  <a href="https://github.com/test3207/m3w/releases"><img src="https://img.shields.io/github/v/release/test3207/m3w?include_prereleases&label=version" alt="Version"></a>
  <a href="https://github.com/test3207/m3w/blob/main/LICENSE"><img src="https://img.shields.io/github/license/test3207/m3w" alt="License"></a>
  <a href="https://github.com/test3207/m3w/actions"><img src="https://img.shields.io/github/actions/workflow/status/test3207/m3w/pr-check.yml?label=build" alt="Build"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="#功能特性">功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#文档">文档</a>
</p>

---

## 功能特性

- 🎵 **多音乐库** — 创建多个独立的音乐库，分类管理
- 📝 **跨库播放列表** — 从不同音乐库组合歌曲
- 📱 **移动优先** — 专为手机设计，桌面端同样可用
- 🔌 **离线模式** — 无需账户或网络即可使用完整功能
- 🏠 **自托管** — 数据完全存储在你自己的服务器上
- ⚡ **PWA 支持** — 可安装为应用，离线播放已缓存的音乐

## 快速开始

### 方式一：离线模式（无需配置）

无需任何服务器配置，即刻体验 M3W：

1. 访问 [m3w.test3207.top](https://m3w.test3207.top) 或部署你自己的实例
2. 在登录页点击 **"离线模式"**
3. 导入本地音乐文件，开始播放

所有数据保存在浏览器中，无需账户。

### 方式二：Docker 部署

```bash
# 最简单：仅离线模式（无需数据库）
docker run -d --name m3w -p 4000:4000 ghcr.io/test3207/m3w:latest

# 访问 http://localhost:4000
```

这将以纯离线模式运行 M3W，所有数据存储在浏览器中。

<details>
<summary><b>🔧 完整配置（GitHub 登录 + 多设备同步）</b></summary>

如需持久化存储和多设备同步，需要 PostgreSQL 和 MinIO：

```bash
# 下载包含所有服务的 compose 文件
curl -sL https://raw.githubusercontent.com/test3207/m3w/main/docker/examples/simple/docker-compose.yml \
  -o docker-compose.yml

# 配置 GitHub OAuth（编辑 docker-compose.yml）
# GITHUB_CLIENT_ID=your-client-id
# GITHUB_CLIENT_SECRET=your-client-secret

# 启动所有服务
docker compose up -d
```

详细配置选项请参考 [部署指南](./docker/README.md)。

</details>

### 方式三：开发环境

```bash
git clone https://github.com/test3207/m3w.git
cd m3w
node scripts/setup.cjs  # 安装依赖、启动容器、运行迁移
npm run dev             # http://localhost:3000
```

完整说明请参考 [开发指南](./docs/DEVELOPMENT.md)。

## 截图

<!-- 即将添加 -->
<p align="center">
  <em>截图即将添加</em>
</p>

## 工作原理

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

**离线模式**：所有功能在浏览器中运行，音乐文件缓存在本地。

**连接服务器**：多设备同步、持久化存储、GitHub 身份验证。

## 技术栈

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white" alt="Hono">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white" alt="PWA">
</p>

## 文档

| 文档 | 描述 |
|------|------|
| [部署指南](./docker/README.md) | Docker/Podman 部署选项 |
| [开发指南](./docs/DEVELOPMENT.md) | 本地开发环境配置 |
| [PWA 与离线](./docs/PWA_OFFLINE_GUIDE.md) | 离线功能详解 |
| [局域网访问](./docs/LAN_ACCESS.md) | 从其他设备访问 |
| [中国用户](./docs/CHINA_REGISTRY.md) | 镜像源配置 |

## 路线图

- [x] 核心播放功能与离线支持
- [x] 多音乐库与播放列表管理
- [x] PWA 完整离线能力
- [ ] 多设备同步
- [ ] 歌词显示
- [ ] 桌面应用 (Tauri)

## 参与贡献

欢迎贡献！请先阅读 [开发指南](./docs/DEVELOPMENT.md)。

```bash
# Fork 并克隆，然后：
git checkout -b feature/your-feature
npm run test
npm run lint
git commit -m "feat: your feature"
```

## 许可证

[MIT](./LICENSE) © 2025 test3207
