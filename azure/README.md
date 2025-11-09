# Azure Deployment README

This directory contains Azure deployment configurations for M3W.

## Files Overview

- **main.bicep**: Main infrastructure-as-code template defining all Azure resources
- **parameters.json**: Production environment parameters
- **parameters.staging.json**: Staging environment parameters
- **deploy.sh**: Deployment automation script

## Quick Start

### 1. Prerequisites

```bash
# Install Azure CLI
brew install azure-cli

# Login to Azure
az login

# Set your subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### 2. Create GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
AZURE_CREDENTIALS           # Service Principal JSON
AZURE_SUBSCRIPTION_ID       # Your Azure subscription ID
AZURE_REGISTRY_USERNAME     # ACR username (after deployment)
AZURE_REGISTRY_PASSWORD     # ACR password (after deployment)
DATABASE_URL                # PostgreSQL connection string
REDIS_URL                   # Redis connection string
NEXTAUTH_SECRET             # NextAuth secret key
GITHUB_CLIENT_ID            # GitHub OAuth client ID
GITHUB_CLIENT_SECRET        # GitHub OAuth secret
AZURE_STORAGE_CONNECTION_STRING  # Storage account connection string
AZURE_STORAGE_CONTAINER_NAME     # Blob container name (music)
```

### 3. Deploy Infrastructure

```bash
# Create resource group and deploy all resources
./deploy.sh create-infra production

# Or for staging
./deploy.sh create-infra staging
```

### 4. Get Connection Strings

```bash
# Retrieve all secrets and connection strings
./deploy.sh secrets production
```

### 5. Build and Deploy Application

```bash
# Build Docker image and push to ACR
./deploy.sh build-image production v1.0.0

# Run database migrations
DATABASE_URL="postgresql://..." ./deploy.sh migrate production

# Deploy to Container Apps
./deploy.sh deploy-app production v1.0.0

# Or run all steps at once
./deploy.sh full-deploy production v1.0.0
```

## Script Commands

```bash
# Setup
./deploy.sh setup [env]              # Create resource group
./deploy.sh create-infra [env]       # Deploy infrastructure

# Application
./deploy.sh build-image [env] [tag]  # Build and push Docker image
./deploy.sh migrate [env]            # Run database migrations
./deploy.sh deploy-app [env] [tag]   # Deploy to Container Apps
./deploy.sh full-deploy [env] [tag]  # Complete deployment

# Operations
./deploy.sh logs [env]               # Stream application logs
./deploy.sh secrets [env]            # Show connection strings
./deploy.sh cleanup [env]            # Delete all resources
```

## Creating Service Principal for GitHub Actions

```bash
# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create service principal with contributor role
az ad sp create-for-rbac \
  --name "m3w-github-actions" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/m3w-rg" \
  --sdk-auth

# Copy the entire JSON output to AZURE_CREDENTIALS secret in GitHub
```

## Updating Parameters

Edit `parameters.json` or `parameters.staging.json` to customize:

- VM sizes (PostgreSQL, Redis tiers)
- Replica counts (min/max instances)
- Storage configurations
- Network settings

Then redeploy:

```bash
./deploy.sh create-infra production
```

## Monitoring

### View Logs

```bash
# Stream live logs
./deploy.sh logs production

# Or use Azure CLI directly
az containerapp logs show \
  --name m3w-app-production \
  --resource-group m3w-rg \
  --follow
```

### Application Insights

Access metrics and logs in Azure Portal:
1. Navigate to your Application Insights resource
2. View Live Metrics, Performance, Failures, etc.

## Troubleshooting

### Deployment Fails

```bash
# Check deployment status
az deployment group show \
  --resource-group m3w-rg \
  --name DEPLOYMENT_NAME \
  --query properties.error

# Validate template before deploying
az deployment group validate \
  --resource-group m3w-rg \
  --template-file main.bicep \
  --parameters @parameters.json
```

### Container App Not Starting

```bash
# Check container logs
az containerapp logs show \
  --name m3w-app-production \
  --resource-group m3w-rg \
  --tail 100

# Check revision status
az containerapp revision list \
  --name m3w-app-production \
  --resource-group m3w-rg
```

### Database Connection Issues

```bash
# Test connection from local machine
psql "postgresql://user:pass@server.postgres.database.azure.com:5432/m3w?sslmode=require"

# Check firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group m3w-rg \
  --name m3w-postgres-XXXXX
```

## Cost Optimization

### Development Environment

Set `minReplicas: 0` in parameters to scale to zero when not in use:

```json
{
  "minReplicas": {
    "value": 0
  }
}
```

### Storage Tiers

Move infrequently accessed audio to Cool tier:

```bash
az storage blob set-tier \
  --account-name m3wstorageXXXXX \
  --container-name music \
  --name "old-songs/*" \
  --tier Cool
```

## Cleanup

To delete all resources:

```bash
./deploy.sh cleanup production
```

⚠️ **Warning**: This will permanently delete all data!

## References

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
