# Azure Deployment

M3W 的 Azure 单环境部署配置。

## 成本

- **预计月成本**: $40-60
- **适用场景**: 个人项目、小团队使用

## 快速开始

```bash
# 1. 创建基础设施
./deploy.sh create

# 2. 查看连接信息
./deploy.sh secrets

# 3. 配置 GitHub Secrets
# 将上面输出的信息添加到 GitHub 仓库的 Secrets

# 4. 完整部署
./deploy.sh full v1.0.0
```

## 回滚

```bash
# 查看所有版本
./deploy.sh revisions

# 回滚到上一个版本
./deploy.sh rollback
```

## 文档

完整文档请查看: [docs/AZURE_DEPLOYMENT.md](../docs/AZURE_DEPLOYMENT.md)

## 文件说明

- `main.bicep` - 基础设施模板 (Container Apps, PostgreSQL, Storage, Registry)
- `parameters.json` - 参数配置
- `deploy.sh` - 部署自动化脚本
- `.github/workflows/azure-deploy.yml` - CI/CD pipeline

## 主要特性

- ✅ Scale to Zero - 无流量时自动缩减到 0
- ✅ 快速回滚 - 保留最近 3 个版本
- ✅ 自动扩展 - 根据负载自动扩展 (0-2 实例)
- ✅ 健康检查 - 自动监控应用健康状态
- ✅ 低成本 - 按使用量付费
