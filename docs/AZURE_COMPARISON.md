# Azure 部署方案对比

## 完整版 vs 预算版

| 特性 | 完整版 | 预算版 |
|------|--------|--------|
| **月成本** | $419-569 | $40-60 |
| **环境数量** | 3 (dev/staging/prod) | 1 (单环境) |
| **Container Apps** | 2-10 实例 | 0-2 实例 (可缩放到 0) |
| **CPU/内存** | 2 vCPU / 4GB | 0.5 vCPU / 1GB |
| **PostgreSQL** | D2s_v3 (2核8GB) | B1ms (1核2GB) |
| **高可用** | 区域冗余 | 单实例 |
| **Redis** | Standard C1 | 无 |
| **存储冗余** | GRS (异地) | LRS (本地) |
| **监控** | Application Insights | Log Analytics 基础 |
| **VNet** | 私有网络 + 端点 | 公网访问 |
| **适用场景** | 生产环境 | 个人项目 |

## 推荐选择

### 选择预算版,如果:
- ✅ 个人项目或小团队使用
- ✅ 流量较低(日活 < 100)
- ✅ 可接受偶尔冷启动(10-15秒)
- ✅ 预算有限($150/月内)
- ✅ 无需多环境

### 选择完整版,如果:
- ✅ 商业项目
- ✅ 需要高可用性
- ✅ 流量较大
- ✅ 需要多环境测试
- ✅ 需要 Redis 缓存
- ✅ 有充足预算

## 部署文件

### 预算版
- `azure/main.budget.bicep` - 基础设施模板
- `azure/parameters.budget.json` - 参数配置
- `azure/deploy-budget.sh` - 部署脚本
- `.github/workflows/azure-budget-deploy.yml` - CI/CD
- `docs/AZURE_BUDGET_DEPLOYMENT.md` - 详细文档

### 完整版
- `azure/main.bicep` - 基础设施模板
- `azure/parameters.json` - 生产参数
- `azure/parameters.staging.json` - 测试参数
- `azure/deploy.sh` - 部署脚本
- `.github/workflows/azure-deploy.yml` - CI/CD
- `docs/AZURE_DEPLOYMENT.md` - 详细文档

## 快速开始

### 预算版部署

```bash
# 1. 创建资源
cd azure
./deploy-budget.sh create

# 2. 配置 GitHub Secrets(从输出获取)
./deploy-budget.sh secrets

# 3. 完整部署
./deploy-budget.sh full v1.0.0
```

### 完整版部署

```bash
# 1. 创建资源
cd azure
./deploy.sh create-infra production

# 2. 配置 GitHub Secrets
./deploy.sh secrets production

# 3. 完整部署
./deploy.sh full-deploy production v1.0.0
```

## 成本优化建议

### 进一步降低预算版成本

1. **使用时启动,不用时停止**
   ```bash
   # 停止数据库
   az postgres flexible-server stop --name m3w-postgres-XXX --resource-group m3w-rg
   
   # Scale to Zero 已自动处理 Container Apps
   ```

2. **使用免费数据库服务**
   - Supabase (500MB 免费)
   - Neon.tech (0.5GB 免费)
   - PlanetScale (5GB 免费)

3. **Azure 学生订阅**
   - $100/月免费额度
   - 12 个月免费服务

4. **定期清理未使用的镜像**
   ```bash
   az acr repository list --name m3wacrXXX --output table
   az acr repository delete --name m3wacrXXX --repository m3w --tag old-tag
   ```

## 迁移路径

### 从预算版升级到完整版

1. 导出当前数据库
2. 部署完整版基础设施
3. 迁移数据
4. 切换 DNS/流量

### 从完整版降级到预算版

1. 备份生产数据
2. 部署预算版
3. 恢复数据
4. 监控性能

---

**建议**: 从预算版开始,根据实际使用情况决定是否升级到完整版。
