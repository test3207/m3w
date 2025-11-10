# PWA 离线功能使用指南

## 概述

M3W 现已实现完整的 PWA 离线功能,包括:

- 元数据自动同步到 IndexedDB
- 持久化存储管理
- 音频文件离线缓存
- 离线播放支持

## 架构组件

### 1. 元数据同步服务 (`lib/sync/metadata-sync.ts`)

**功能**:

- 自动从后端下载 libraries、playlists、songs 元数据到 IndexedDB
- 定时同步(每 5 分钟检查一次)
- 手动触发同步
- 记录最后同步时间

**使用方法**:

```typescript
import { startAutoSync, manualSync, getSyncStatus } from '@/lib/sync/metadata-sync';

// 启动自动同步(应用启动时调用)
startAutoSync();

// 手动触发同步
const result = await manualSync();
console.log(`同步完成: ${result.libraries} 个库, ${result.songs} 首歌曲`);

// 获取同步状态
const status = getSyncStatus();
console.log(`上次同步: ${status.lastSyncTimeFormatted}`);
```

### 2. 存储配额管理 (`lib/storage/quota-manager.ts`)

**功能**:

- 检测 PWA 安装状态
- 请求持久化存储权限
- 监控存储配额使用情况
- 提供存储容量信息

**使用方法**:

```typescript
import { 
  isPWAInstalled, 
  requestPersistentStorage, 
  getStorageQuota 
} from '@/lib/storage/quota-manager';

// 检查 PWA 安装状态
const isInstalled = isPWAInstalled();

// 请求持久化存储
const granted = await requestPersistentStorage();

// 获取存储配额信息
const quota = await getStorageQuota();
console.log(`已用: ${quota.usageFormatted} / ${quota.quotaFormatted}`);
```

### 3. 音频缓存服务 (`lib/storage/audio-cache.ts`)

**功能**:

- 缓存音频文件到 Cache Storage
- 支持单曲、播放列表、音乐库批量缓存
- 缓存进度跟踪
- LRU 缓存淘汰策略
- 检查歌曲缓存状态

**使用方法**:

```typescript
import { 
  cacheSong, 
  cachePlaylist, 
  isSongCached,
  getCachedSongs 
} from '@/lib/storage/audio-cache';

// 缓存单首歌曲
await cacheSong(songId, (progress) => {
  console.log(`${progress.title}: ${progress.progress}%`);
});

// 缓存整个播放列表
await cachePlaylist(playlistId, (progress) => {
  console.log(`正在缓存: ${progress.title}`);
});

// 检查歌曲是否已缓存
const cached = await isSongCached(songId);

// 获取所有已缓存的歌曲 ID
const cachedIds = await getCachedSongs();
```

### 4. PWA 初始化模块 (`lib/pwa/index.ts`)

**功能**:

- 统一初始化所有 PWA 功能
- 监听 PWA 安装事件
- 处理网络状态变化
- 提供 PWA 状态查询

**使用方法**:

```typescript
import { setupPWA, getPWAStatus } from '@/lib/pwa';

// 应用启动时调用(在 main.tsx 中)
await setupPWA({
  onInstallPrompt: (event) => {
    // 可选:自定义安装提示 UI
    console.log('PWA 安装提示可用');
  }
});

// 获取 PWA 状态
const status = await getPWAStatus();
console.log('PWA 已安装:', status.isPWAInstalled);
console.log('存储已持久化:', status.isStoragePersisted);
console.log('可缓存音频:', status.canCacheAudio);
```

### 5. React Hooks (`hooks/usePWA.ts`)

**功能**:

- 提供 React 组件友好的 API
- 自动管理状态和副作用
- 封装常用操作

**使用方法**:

```typescript
import { 
  usePWAStatus, 
  useStorageQuota, 
  useAudioCache, 
  useMetadataSync 
} from '@/hooks/usePWA';

function MyComponent() {
  // PWA 状态
  const { status, loading } = usePWAStatus();
  
  // 存储配额
  const { quota } = useStorageQuota();
  
  // 音频缓存
  const { isCached, cacheSong, progress } = useAudioCache();
  
  // 元数据同步
  const { syncing, triggerSync } = useMetadataSync();
  
  return (
    <div>
      <p>PWA 已安装: {status?.isPWAInstalled ? '是' : '否'}</p>
      <p>存储使用: {quota?.usageFormatted} / {quota?.quotaFormatted}</p>
      
      <button onClick={() => cacheSong(songId)}>
        {isCached(songId) ? '已缓存' : '缓存歌曲'}
      </button>
      
      {progress && <p>{progress.title}: {progress.progress}%</p>}
      
      <button onClick={triggerSync} disabled={syncing}>
        {syncing ? '同步中...' : '手动同步'}
      </button>
    </div>
  );
}
```

## 集成到应用

### 1. 在 `main.tsx` 中初始化

```typescript
import { setupPWA } from '@/lib/pwa';

async function initApp() {
  // 初始化 PWA 功能
  await setupPWA();
  
  // 渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
```

### 2. 在仪表板添加存储状态 UI

```typescript
function DashboardPage() {
  const { status } = usePWAStatus();
  const { quota } = useStorageQuota();
  
  return (
    <div>
      {status?.isPWAInstalled && (
        <Card>
          <CardHeader>
            <CardTitle>离线存储</CardTitle>
          </CardHeader>
          <CardContent>
            <p>已用空间: {quota?.usageFormatted}</p>
            <p>总容量: {quota?.quotaFormatted}</p>
            <Progress value={quota?.usagePercent || 0} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 3. 在歌曲列表添加缓存按钮

```typescript
function SongItem({ song }) {
  const { isCached, cacheSong, loading, progress } = useAudioCache();
  
  const handleCache = async () => {
    try {
      await cacheSong(song.id);
      toast.success(`${song.title} 已缓存`);
    } catch (error) {
      toast.error('缓存失败');
    }
  };
  
  return (
    <div>
      <span>{song.title}</span>
      <Button 
        onClick={handleCache} 
        disabled={loading || isCached(song.id)}
        variant={isCached(song.id) ? "secondary" : "default"}
      >
        {isCached(song.id) ? '✓ 已缓存' : '↓ 缓存'}
      </Button>
      
      {progress?.songId === song.id && (
        <Progress value={progress.progress} />
      )}
    </div>
  );
}
```

### 4. 在播放列表添加批量缓存

```typescript
function PlaylistDetailPage({ playlistId }) {
  const { cachePlaylist, loading, progress } = useAudioCache();
  
  const handleCacheAll = async () => {
    try {
      await cachePlaylist(playlistId);
      toast.success('播放列表已缓存');
    } catch (error) {
      toast.error('缓存失败');
    }
  };
  
  return (
    <div>
      <Button onClick={handleCacheAll} disabled={loading}>
        {loading ? '缓存中...' : '缓存所有歌曲'}
      </Button>
      
      {progress && (
        <div>
          <p>正在缓存: {progress.title}</p>
          <Progress value={progress.progress} />
        </div>
      )}
    </div>
  );
}
```

## 工作流程

### 首次使用流程

1. **用户访问网站** → PWA 安装提示出现
2. **用户安装 PWA** → 自动请求持久化存储权限
3. **权限获批** → 开始元数据同步
4. **同步完成** → 离线浏览元数据可用
5. **用户标记歌曲/播放列表** → 下载音频文件
6. **离线时** → 可播放已缓存的歌曲

### 自动同步流程

```Text
应用启动 → 检查网络状态
  ├─ 在线 → 启动自动同步服务
  │         ↓
  │    每 5 分钟检查是否需要同步
  │         ↓
  │    下载新数据到 IndexedDB
  │
  └─ 离线 → 使用 IndexedDB 缓存数据
```

### 离线缓存决策

```Text
用户操作 → 检查 PWA 状态
  ├─ PWA 已安装 + 存储持久化 → 允许缓存
  │    ↓
  │  检查可用配额
  │    ├─ 配额充足 → 下载音频到 Cache Storage
  │    └─ 配额不足 → 淘汰旧缓存(LRU)
  │
  └─ PWA 未安装 / 存储未持久化 → 提示安装 PWA
```

## API 参考

### 元数据同步

```typescript
// 启动自动同步
startAutoSync(): void

// 停止自动同步
stopAutoSync(): void

// 手动触发同步
manualSync(): Promise<SyncResult>

// 检查是否需要同步
shouldSync(forceSync?: boolean): boolean

// 获取同步状态
getSyncStatus(): SyncStatus
```

### 存储管理

```typescript
// 检查 PWA 安装状态
isPWAInstalled(): boolean

// 请求持久化存储
requestPersistentStorage(): Promise<boolean>

// 检查存储是否持久化
isStoragePersisted(): Promise<boolean>

// 获取存储配额
getStorageQuota(): Promise<StorageQuota | null>

// 检查配额是否足够
hasEnoughQuota(requiredBytes: number): Promise<boolean>

// 获取综合状态
getStorageStatus(): Promise<StorageStatus>
```

### 音频缓存

```typescript
// 缓存单首歌曲
cacheSong(songId: string, onProgress?: (progress: CacheProgress) => void): Promise<void>

// 缓存多首歌曲
cacheSongs(songIds: string[], onProgress?: (progress: CacheProgress) => void): Promise<void>

// 缓存播放列表
cachePlaylist(playlistId: string, onProgress?: (progress: CacheProgress) => void): Promise<void>

// 缓存音乐库
cacheLibrary(libraryId: string, onProgress?: (progress: CacheProgress) => void): Promise<void>

// 检查歌曲是否已缓存
isSongCached(songId: string): Promise<boolean>

// 获取所有已缓存歌曲
getCachedSongs(): Promise<string[]>

// 移除缓存的歌曲
removeCachedSong(songId: string): Promise<boolean>

// 获取缓存统计
getCacheStats(): Promise<CacheStats>

// 清空所有缓存
clearAudioCache(): Promise<boolean>

// 淘汰最旧的缓存
evictOldestCachedSongs(count: number): Promise<void>
```

## 类型定义

```typescript
interface SyncResult {
  success: boolean;
  libraries?: number;
  playlists?: number;
  songs?: number;
  playlistSongs?: number;
  error?: string;
}

interface StorageQuota {
  usage: number;
  quota: number;
  usagePercent: number;
  usageFormatted: string;
  quotaFormatted: string;
  availableFormatted: string;
}

interface CacheProgress {
  songId: string;
  title: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

interface PWAStatus {
  isPWAInstalled: boolean;
  isStoragePersisted: boolean;
  canCacheAudio: boolean;
  syncStatus: {
    lastSyncTime: number | null;
    autoSyncRunning: boolean;
  };
}
```

## 注意事项

1. **存储配额**: 音频缓存只在 PWA 安装并获得持久化存储权限后才可用
2. **网络优先**: 元数据同步优先使用在线数据,离线时使用 IndexedDB 缓存
3. **自动淘汰**: 当存储配额不足时,自动淘汰最旧的缓存(预留 100MB 空间)
4. **批量操作**: 缓存播放列表/音乐库时逐个下载,失败不影响后续歌曲
5. **同步频率**: 自动同步每 5 分钟检查一次,避免频繁请求后端

## 未来增强

- [ ] 智能缓存:根据播放历史自动缓存常听歌曲
- [ ] 缓存优先级:支持用户设置缓存优先级
- [ ] 后台同步:使用 Background Sync API 在网络恢复时自动同步
- [ ] 增量同步:只同步变更的数据,减少网络传输
- [ ] 缓存分析:提供缓存使用分析报告
