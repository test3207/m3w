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
  <a href="https://codecov.io/gh/test3207/m3w"><img src="https://codecov.io/gh/test3207/m3w/branch/main/graph/badge.svg" alt="Coverage"></a>
</p>

<p align="center">
  <a href="https://developer.chrome.com/docs/lighthouse/overview"><img src="https://img.shields.io/badge/Lighthouse-Audit-orange?logo=lighthouse&logoColor=white" alt="Lighthouse"></a>
  <img src="https://img.shields.io/badge/Performance-100%25-brightgreen" alt="Lighthouse Performance">
  <img src="https://img.shields.io/badge/Accessibility-100%25-brightgreen" alt="Lighthouse Accessibility">
  <img src="https://img.shields.io/badge/Best%20Practices-100%25-brightgreen" alt="Lighthouse Best Practices">
  <img src="https://img.shields.io/badge/SEO-100%25-brightgreen" alt="Lighthouse SEO">
</p>

<p align="center">
  <a href="./README.md">English</a> •
  <a href="#功能特性">功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#文档">文档</a>
</p>

---

## 为什么要自托管？

> *「由于版权限制，该歌曲在您所在的地区不可用。」*
>
> — 迟早会发生在每个流媒体平台

使用 M3W，**你的音乐永远属于你**。没有歌曲莫名下架，没有「该内容已失效」，没有算法替你决定能听什么。

## 功能特性

- 🎵 **多音乐库** — 创建多个独立的音乐库，分类管理
- 📝 **跨库播放列表** — 从不同音乐库组合歌曲
- 📱 **移动优先** — 专为手机设计，桌面端同样可用
- 🔌 **离线模式** — 无需账户或网络即可使用完整功能
- 🏠 **自托管** — 数据永远存储在你自己的服务器上
- ⚡ **PWA 支持** — 可安装为应用，离线播放已缓存的音乐

## 快速开始

### 在线演示

访问 [m3w.test3207.top](https://m3w.test3207.top) 体验 M3W

- **在线模式**：使用 GitHub 登录，支持多设备同步
- **离线模式**：点击「离线模式」，在浏览器本地使用

> ⚠️ 演示站数据会定期清理。如需长期使用，请部署自己的实例。

### 自托管部署

使用 Docker Compose 部署（包含 PostgreSQL + MinIO）：

```bash
# 下载 compose 文件
curl -sL https://raw.githubusercontent.com/test3207/m3w/main/docker/examples/simple/docker-compose.yml \
  -o docker-compose.yml

# 配置环境变量（编辑 docker-compose.yml）
# - 设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 启用登录
# - 或留空，仅使用离线模式

# 启动所有服务
docker compose up -d

# 访问 http://localhost:4000
```

详细配置选项请参考 [部署指南](./docker/README.md)。

### 从源码构建

```bash
git clone https://github.com/test3207/m3w.git
cd m3w
node scripts/setup.cjs  # 安装依赖、启动容器、运行迁移
npm run dev             # http://localhost:3000
```

需要 Node.js 25+ 和 Docker/Podman。详见 [开发指南](./docs/DEVELOPMENT.md)。

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
| ------ | ------ |
| [部署指南](./docker/README.md) | Docker Compose 部署选项 |
| [开发指南](./docs/DEVELOPMENT.md) | 本地开发环境配置 |
| [PWA 与离线](./docs/PWA_OFFLINE_GUIDE.md) | 离线功能详解 |
| [局域网访问](./docs/LAN_ACCESS.md) | 从其他设备访问 |
| [中国用户](./docs/CHINA_REGISTRY.md) | 镜像源配置 |

## 路线图

### ✅ 已完成

- 核心播放功能与离线 PWA 支持
- 多音乐库与播放列表管理
- 移动优先的响应式界面
- GitHub OAuth 身份验证
- 演示模式（定期数据清理）
- 已登录用户离线浏览

### 📋 计划中

- 访客数据迁移到账户
- 歌词显示
- 桌面应用

详细进度请查看 [GitHub Issues](https://github.com/test3207/m3w/issues)。

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
