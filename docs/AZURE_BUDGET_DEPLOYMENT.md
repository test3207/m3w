# Azure 低成本部署方案

## 成本估算 (~$40-60/月)

| 服务 | 配置 | 月成本 (USD) |
|------|------|-------------|
| Container Apps | 0.5 vCPU, 1GB RAM, 可缩放到 0 | $15-25 |
| PostgreSQL Flexible | B1ms (1 vCore, 2GB) | $13 |
| Storage Account | Standard LRS, 按使用量 | $5-10 |
| Container Registry | Basic | $5 |
| Log Analytics | 按数据量 | $2-7 |
| **总计** | | **$40-60** |

## 成本优化措施

### 1. Container Apps
- ✅ **Scale to Zero**: 无流量时自动缩减到 0 实例,不产生计算费用
- ✅ **最小规格**: 0.5 vCPU + 1GB RAM
- ✅ **最大 2 实例**: 限制最大并发实例数
- ✅ **按秒计费**: 只为实际运行时间付费

### 2. PostgreSQL
- ✅ **Burstable 层**: B1ms 最低配置
- ✅ **32GB 存储**: 最小存储容量
- ✅ **无高可用**: 单实例模式
- ✅ **本地冗余**: 无异地备份

### 3. 存储
- ✅ **LRS**: 本地冗余存储(最便宜)
- ✅ **Hot 层**: 热层访问(适合音乐文件)
- ✅ **按需付费**: 只为实际存储和流量付费

### 4. 容器镜像
- ✅ **Basic ACR**: 基础版容器注册表
- ✅ **镜像缓存**: 减少构建时间和费用

### 5. 无 Redis
- ✅ **暂时移除**: Redis Cache 每月 $16-74
- 💡 **后续可加**: 需要时再启用

## 快速开始

### 1. 部署基础设施

```bash
cd azure

# 使用预算版模板
az group create --name m3w-rg --location eastasia

az deployment group create \
  --resource-group m3w-rg \
  --template-file main.budget.bicep \
  --parameters @parameters.budget.json
```

### 2. 获取连接信息

```bash
# 部署完成后,获取输出值
az deployment group show \
  --resource-group m3w-rg \
  --name <deployment-name> \
  --query properties.outputs
```

### 3. 配置 GitHub Secrets

在仓库设置中添加:

```
AZURE_CREDENTIALS                    # Service Principal JSON
AZURE_REGISTRY_LOGIN_SERVER          # 从输出获取
AZURE_REGISTRY_USERNAME              # 从输出获取
AZURE_REGISTRY_PASSWORD              # 从输出获取
DATABASE_URL                         # 从输出获取
NEXTAUTH_URL                         # 你的应用 URL
NEXTAUTH_SECRET                      # 生成随机字符串
GITHUB_CLIENT_ID                     # GitHub OAuth
GITHUB_CLIENT_SECRET                 # GitHub OAuth
```

### 4. 首次部署

推送到 main 分支会自动触发部署:

```bash
git push origin main
```

或手动触发:

```bash
# 在 GitHub Actions 页面
# 选择 "Azure Budget Deployment"
# 点击 "Run workflow"
# Action: deploy
```

## 回滚机制

Container Apps 会保留最近 3 个版本的修订版本(revisions)。

### 自动回滚

如果部署失败,Container Apps 会自动保持在上一个健康的版本运行。

### 手动回滚

**方法 1: 通过 GitHub Actions**

```bash
# 在 GitHub Actions 页面
# 选择 "Azure Budget Deployment"
# 点击 "Run workflow"
# Action: rollback
# Revision: (留空自动回滚到上一个版本)
```

**方法 2: 通过 Azure CLI**

```bash
# 查看所有版本
az containerapp revision list \
  --name m3w-app \
  --resource-group m3w-rg \
  --output table

# 回滚到指定版本
az containerapp revision activate \
  --name m3w-app \
  --resource-group m3w-rg \
  --revision <revision-name>
```

**方法 3: 通过 Azure Portal**

1. 打开 Azure Portal
2. 导航到 Container Apps → m3w-app
3. 左侧菜单选择 "Revisions"
4. 选择之前的健康版本
5. 点击 "Activate" 激活

### 版本管理

Container Apps 的版本模式:
- `m3w-app--<random>`: 自动生成的版本名称
- 每次部署创建新版本
- 最多保留 3 个非活动版本
- 可以在多个版本间快速切换流量

## 监控和日志

### 查看实时日志

```bash
# 流式查看日志
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --follow

# 查看最近 100 行
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --tail 100
```

### 在 Azure Portal 查看

1. Container Apps → m3w-app → Log stream
2. 或使用 Log Analytics 进行查询

## 成本监控

### 设置预算警报

```bash
# 创建预算
az consumption budget create \
  --budget-name m3w-monthly-budget \
  --amount 60 \
  --time-grain Monthly \
  --start-date $(date +%Y-%m-01) \
  --end-date 2026-12-31 \
  --resource-group m3w-rg
```

### 查看成本

```bash
# 查看本月成本
az consumption usage list \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date +%Y-%m-%d) \
  --query "[].{Service:instanceName, Cost:pretaxCost}" \
  --output table
```

或在 Azure Portal:
- Cost Management + Billing → Cost Analysis

## 性能优化

### 1. 启用 Scale to Zero

当无流量时,应用会自动缩减到 0 实例:
- 冷启动时间: ~10-15 秒
- 适合个人项目或低流量应用

### 2. 数据库连接池

在 `DATABASE_URL` 中配置:
```
postgresql://user:pass@server:5432/db?connection_limit=5&pool_timeout=10
```

### 3. 存储访问

使用 CDN 或将静态资源移到 Storage Static Website (免费):
```bash
az storage blob service-properties update \
  --account-name m3wstorageXXX \
  --static-website \
  --index-document index.html
```

## 进一步降低成本

### 如果需要更省钱

1. **使用 Free Tier 数据库** (仅开发/测试):
   - Azure Database for PostgreSQL 无免费层
   - 考虑使用 Supabase 免费层(500MB)
   - 或 Neon.tech 免费层

2. **停止数据库**:
   ```bash
   # 不使用时停止 PostgreSQL
   az postgres flexible-server stop \
     --name m3w-postgres-XXX \
     --resource-group m3w-rg
   
   # 需要时再启动
   az postgres flexible-server start \
     --name m3w-postgres-XXX \
     --resource-group m3w-rg
   ```

3. **定时关闭**(夜间):
   使用 Azure Automation 或 Azure Functions 定时停止服务

4. **使用 Azure 学生订阅**:
   - 每月 $100 免费额度
   - 12 个月免费服务

## 故障排查

### 应用无法启动

```bash
# 检查最新版本状态
az containerapp revision list \
  --name m3w-app \
  --resource-group m3w-rg

# 如果失败,立即回滚
az containerapp revision activate \
  --name m3w-app \
  --resource-group m3w-rg \
  --revision <previous-working-revision>
```

### 数据库连接失败

```bash
# 测试连接
psql "$DATABASE_URL"

# 检查防火墙
az postgres flexible-server firewall-rule list \
  --name m3w-postgres-XXX \
  --resource-group m3w-rg
```

## 清理资源

不用时删除所有资源:

```bash
az group delete --name m3w-rg --yes --no-wait
```

---

**预计月成本**: $40-60  
**适用场景**: 个人项目、低流量应用  
**优势**: 自动缩放、快速回滚、低成本
