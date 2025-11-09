# Azure Deployment

M3W's single-environment Azure deployment configuration.

## Cost

- **Estimated Monthly Cost**: $40-60
- **Use Cases**: Personal projects, small team usage

## Quick Start

```bash
# 1. Create infrastructure
./deploy.sh create

# 2. View connection information
./deploy.sh secrets

# 3. Configure GitHub Secrets
# Add the output above to your GitHub repository Secrets

# 4. Full deployment
./deploy.sh full v1.0.0
```

## Rollback

```bash
# View all revisions
./deploy.sh revisions

# Rollback to previous revision
./deploy.sh rollback
```

## Documentation

For complete documentation, see: [docs/AZURE_DEPLOYMENT.md](../docs/AZURE_DEPLOYMENT.md)

## File Descriptions

- `main.bicep` - Infrastructure template (Container Apps, PostgreSQL, Storage, Registry)
- `parameters.json` - Parameter configuration
- `deploy.sh` - Deployment automation script
- `.github/workflows/azure-deploy.yml` - CI/CD pipeline

## Key Features

- ✅ Scale to Zero - Automatically scale down to 0 when no traffic
- ✅ Quick Rollback - Keep last 3 revisions
- ✅ Auto-scaling - Automatically scale based on load (0-2 instances)
- ✅ Health Checks - Automatic application health monitoring
- ✅ Low Cost - Pay-as-you-go pricing
