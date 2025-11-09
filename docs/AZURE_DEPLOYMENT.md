# Azure 部署指南

## 部署架构概览

M3W 在 Azure 上采用以下架构:

```
┌─────────────────────────────────────────────────────────────┐
│                      Azure Resource Group                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           Azure Container Apps (Next.js)              │ │
│  │  - Auto-scaling (0-10 instances)                      │ │
│  │  - HTTPS endpoint                                     │ │
│  │  - Rolling updates                                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Virtual Network (VNet)                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │ │
│  │  │ PostgreSQL   │  │   Redis      │  │ Blob       │  │ │
│  │  │ Flexible     │  │   Cache      │  │ Storage    │  │ │
│  │  │ Server       │  │              │  │ (音频文件)  │  │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │       Azure Container Registry (ACR)                  │ │
│  │  - Private registry for Docker images                 │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           Application Insights (可选)                  │ │
│  │  - Performance monitoring                             │ │
│  │  - Log aggregation                                    │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Azure 服务选型

### 1. 计算服务: Azure Container Apps

**为什么选择 Container Apps:**
- **无服务器容器平台**: 按需扩展,按使用付费
- **内置 HTTPS 和自定义域**: 自动 SSL 证书管理
- **原生容器支持**: 直接运行 Docker 镜像
- **简化的部署**: 无需管理 Kubernetes 集群
- **成本优势**: 相比 AKS 更经济,适合中小规模应用

**替代方案:**
- Azure Kubernetes Service (AKS): 如需完整 Kubernetes 功能
- Azure App Service: 如不想使用容器

### 2. 数据库: Azure Database for PostgreSQL - Flexible Server

**配置建议:**
- **层级**: Burstable (B1ms) 或 General Purpose (D2s_v3)
- **存储**: 32GB SSD (可扩展到 16TB)
- **备份**: 自动备份,保留 7-35 天
- **高可用**: 生产环境启用 Zone-redundant HA

### 3. 缓存: Azure Cache for Redis

**配置建议:**
- **层级**: Basic C0 (250MB) 或 Standard C1 (1GB)
- **持久化**: Standard 层支持 RDB 备份
- **网络**: VNet 集成确保安全

### 4. 对象存储: Azure Blob Storage

**为什么用 Blob Storage 替代 MinIO:**
- **完全托管**: 无需维护 MinIO 实例
- **S3 兼容**: 支持 S3 API (通过兼容层)
- **成本效益**: 按实际使用付费
- **高可用**: 内置冗余和备份

**存储层级:**
- Hot tier: 频繁访问的音频文件
- Cool tier: 不常播放的归档音乐

### 5. 容器镜像: Azure Container Registry (ACR)

**配置建议:**
- **SKU**: Basic (开发/测试) 或 Standard (生产)
- **异地复制**: 可选,提高全球访问速度
- **内容信任**: 生产环境启用镜像签名

## 成本估算 (按月)

### 开发/测试环境
| 服务 | 配置 | 估算成本 (USD) |
|------|------|---------------|
| Container Apps | 0.5 vCPU, 1GB RAM | ~$15-30 |
| PostgreSQL | B1ms (1 vCore, 2GB) | ~$13 |
| Redis | Basic C0 (250MB) | ~$16 |
| Blob Storage | 10GB Hot + 出站流量 | ~$2-5 |
| ACR | Basic | ~$5 |
| **总计** | | **~$51-69/月** |

### 生产环境
| 服务 | 配置 | 估算成本 (USD) |
|------|------|---------------|
| Container Apps | 2 vCPU, 4GB RAM, 3 实例 | ~$150-250 |
| PostgreSQL | D2s_v3 (2 vCore, 8GB) | ~$145 |
| Redis | Standard C1 (1GB) | ~$74 |
| Blob Storage | 100GB Hot + 出站流量 | ~$20-50 |
| ACR | Standard | ~$20 |
| Application Insights | | ~$10-30 |
| **总计** | | **~$419-569/月** |

*注: 实际成本取决于流量、存储使用量和地区*

## 网络架构

### VNet 配置
```
Virtual Network: m3w-vnet (10.0.0.0/16)
├── Subnet: container-apps-subnet (10.0.0.0/23)
│   └── Container Apps Environment
├── Subnet: database-subnet (10.0.2.0/24)
│   ├── PostgreSQL Flexible Server
│   └── Redis Cache
└── Private Endpoints
    └── Blob Storage private endpoint
```

### 安全策略
- **Network Security Groups (NSG)**: 限制入站流量
- **Private Endpoints**: 数据库和存储服务不暴露公网
- **Managed Identity**: 应用无需存储密钥访问 Azure 资源
- **Key Vault**: 存储敏感配置(可选)

## 部署流程

### 前置要求

1. **Azure CLI 安装**
```bash
# macOS
brew install azure-cli

# 验证安装
az --version
```

2. **Azure 账户登录**
```bash
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

3. **GitHub Secrets 配置**

在 GitHub 仓库设置中添加以下 Secrets:
- `AZURE_CREDENTIALS`: Service Principal JSON
- `AZURE_SUBSCRIPTION_ID`: Azure 订阅 ID
- `AZURE_REGISTRY_USERNAME`: ACR 用户名
- `AZURE_REGISTRY_PASSWORD`: ACR 密码
- `DATABASE_URL`: PostgreSQL 连接字符串
- `REDIS_URL`: Redis 连接字符串
- `NEXTAUTH_SECRET`: NextAuth 密钥
- `GITHUB_CLIENT_ID`: GitHub OAuth ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth Secret

### 部署步骤

#### 1. 创建 Azure 资源

使用 Bicep 模板一键部署:
```bash
cd azure
./deploy.sh create-infra
```

或手动创建:
```bash
# 创建资源组
az group create --name m3w-rg --location eastasia

# 部署 Bicep 模板
az deployment group create \
  --resource-group m3w-rg \
  --template-file main.bicep \
  --parameters @parameters.json
```

#### 2. 配置容器镜像仓库

```bash
# 登录 ACR
az acr login --name m3wacr

# 构建并推送镜像
docker build -t m3wacr.azurecr.io/m3w:latest -f docker/Dockerfile .
docker push m3wacr.azurecr.io/m3w:latest
```

#### 3. 初始化数据库

```bash
# 运行数据库迁移
npm run db:migrate:deploy
```

#### 4. 部署应用到 Container Apps

```bash
cd azure
./deploy.sh deploy-app
```

#### 5. 配置自定义域名 (可选)

```bash
# 添加自定义域
az containerapp hostname add \
  --resource-group m3w-rg \
  --name m3w-app \
  --hostname music.yourdomain.com

# 绑定 SSL 证书 (自动通过 Let's Encrypt)
az containerapp hostname bind \
  --resource-group m3w-rg \
  --name m3w-app \
  --hostname music.yourdomain.com \
  --validation-method HTTP
```

### CI/CD 自动部署

GitHub Actions workflow 会在以下情况自动部署:
- **推送到 `main` 分支**: 部署到生产环境
- **推送到 `develop` 分支**: 部署到测试环境
- **手动触发**: 可选择环境和版本

Workflow 步骤:
1. 代码检出
2. 构建 Docker 镜像
3. 推送到 ACR
4. 运行数据库迁移
5. 更新 Container App
6. 健康检查

## 环境变量配置

在 Azure Portal 的 Container App 配置中设置:

```bash
# Database
DATABASE_URL=postgresql://user:pass@m3w-postgres.postgres.database.azure.com:5432/m3w?sslmode=require

# Redis
REDIS_URL=rediss://m3w-redis.redis.cache.windows.net:6380?password=YOUR_KEY

# Azure Blob Storage (替代 MinIO)
AZURE_STORAGE_ACCOUNT_NAME=m3wstorage
AZURE_STORAGE_ACCOUNT_KEY=YOUR_KEY
AZURE_STORAGE_CONTAINER_NAME=music

# NextAuth.js
NEXTAUTH_URL=https://m3w.azurecontainerapps.io
NEXTAUTH_SECRET=your-production-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-production-client-id
GITHUB_CLIENT_SECRET=your-production-client-secret

# Node Environment
NODE_ENV=production
```

## Blob Storage 集成

由于 Azure Blob Storage 替代了 MinIO,需要修改存储适配器:

### 代码改动 (已在 `src/lib/storage/` 中实现)

```typescript
// src/lib/storage/azure-blob.adapter.ts
import { BlobServiceClient } from '@azure/storage-blob';

export class AzureBlobStorageAdapter {
  private client: BlobServiceClient;
  
  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.client = BlobServiceClient.fromConnectionString(connectionString);
  }
  
  async uploadFile(buffer: Buffer, key: string) {
    const containerClient = this.client.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME
    );
    const blockBlobClient = containerClient.getBlockBlobClient(key);
    await blockBlobClient.upload(buffer, buffer.length);
  }
  
  async getFileUrl(key: string) {
    // 返回 SAS URL 用于临时访问
  }
}
```

## 监控和日志

### Application Insights 集成

```typescript
// src/lib/telemetry/azure.ts
import { ApplicationInsights } from '@azure/monitor-opentelemetry';

export const startTelemetry = () => {
  ApplicationInsights.start({
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  });
};
```

### 查看日志

```bash
# Container Apps 日志
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --follow

# 或在 Azure Portal 查看 Log Analytics
```

## 备份策略

### 数据库备份
- **自动备份**: 每日自动备份,保留 7 天
- **手动备份**: 关键操作前创建快照
- **时间点恢复**: 支持恢复到任意时间点

### Blob Storage 备份
- **软删除**: 启用 7-30 天软删除
- **版本控制**: 保留历史版本
- **异地复制**: 可选 GRS (异地冗余存储)

## 故障排查

### 常见问题

**1. 应用无法启动**
```bash
# 查看容器日志
az containerapp logs show --name m3w-app --resource-group m3w-rg --tail 100

# 检查环境变量
az containerapp show --name m3w-app --resource-group m3w-rg --query properties.configuration.secrets
```

**2. 数据库连接失败**
```bash
# 测试连接
psql "postgresql://user:pass@m3w-postgres.postgres.database.azure.com:5432/m3w?sslmode=require"

# 检查防火墙规则
az postgres flexible-server firewall-rule list --resource-group m3w-rg --name m3w-postgres
```

**3. 音频文件无法播放**
- 检查 Blob Storage 的 CORS 设置
- 验证 SAS token 是否有效
- 确认 Container App 有访问存储账户的权限

### 性能优化

1. **启用 Redis 缓存**: 缓存元数据和歌词查询
2. **CDN 集成**: Azure Front Door 加速静态资源
3. **图片优化**: Next.js Image Optimization
4. **数据库索引**: 优化常用查询
5. **连接池**: 配置合理的数据库连接池大小

## 扩展计划

### 横向扩展
```bash
# 手动调整实例数
az containerapp update \
  --name m3w-app \
  --resource-group m3w-rg \
  --min-replicas 2 \
  --max-replicas 10
```

### 自动扩展规则
- **CPU 使用率 > 70%**: 增加实例
- **内存使用率 > 80%**: 增加实例
- **HTTP 请求队列 > 100**: 增加实例
- **夜间低峰**: 缩减到最小实例数

## 安全最佳实践

1. ✅ 使用 Managed Identity 访问 Azure 资源
2. ✅ 启用 PostgreSQL SSL 连接
3. ✅ 使用 Private Endpoints 隔离数据服务
4. ✅ 定期轮换密钥和证书
5. ✅ 启用 Azure Defender (可选)
6. ✅ 配置 DDoS 保护
7. ✅ 实施最小权限原则

## 参考资源

- [Azure Container Apps 文档](https://learn.microsoft.com/azure/container-apps/)
- [Azure Database for PostgreSQL](https://learn.microsoft.com/azure/postgresql/)
- [Azure Cache for Redis](https://learn.microsoft.com/azure/azure-cache-for-redis/)
- [Azure Blob Storage](https://learn.microsoft.com/azure/storage/blobs/)
- [GitHub Actions for Azure](https://github.com/Azure/actions)

---

**文档版本**: v1.0  
**创建日期**: 2025-11-09  
**最后更新**: 2025-11-09
