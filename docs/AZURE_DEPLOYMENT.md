# Azure Deployment Guide

## Cost Estimation (~$40-60/month)

| Service | Configuration | Monthly Cost (USD) |
|---------|--------------|-------------------|
| Container Apps | 0.5 vCPU, 1GB RAM, Scale to zero | $15-25 |
| PostgreSQL Flexible | B1ms (1 vCore, 2GB) | $13 |
| Storage Account | Standard LRS, Pay-as-you-go | $5-10 |
| Container Registry | Basic | $5 |
| Log Analytics | Pay-as-you-go | $2-7 |
| **Total** | | **$40-60** |

## Cost Optimization Strategies

### 1. Container Apps
- ✅ **Scale to Zero**: Auto-scale to 0 instances when no traffic, no compute cost
- ✅ **Minimal Resources**: 0.5 vCPU + 1GB RAM
- ✅ **Max 2 Instances**: Limit maximum concurrent instances
- ✅ **Per-Second Billing**: Pay only for actual runtime

### 2. PostgreSQL
- ✅ **Burstable Tier**: B1ms minimum configuration
- ✅ **32GB Storage**: Minimum storage capacity
- ✅ **No High Availability**: Single instance mode
- ✅ **Local Redundancy**: No geo-redundant backup

### 3. Storage
- ✅ **LRS**: Locally redundant storage (cheapest option)
- ✅ **Hot Tier**: Hot tier access (suitable for music files)
- ✅ **Pay-as-you-go**: Pay only for actual storage and bandwidth

### 4. Container Registry
- ✅ **Basic ACR**: Basic tier container registry
- ✅ **Image Caching**: Reduce build time and cost

### 5. No Redis
- ✅ **Temporarily Removed**: Redis Cache costs $16-74/month
- 💡 **Add Later**: Enable when needed

## Quick Start

### 1. Deploy Infrastructure

```bash
cd azure

# Create resource group and deploy
az group create --name m3w-rg --location eastasia

az deployment group create \
  --resource-group m3w-rg \
  --template-file main.bicep \
  --parameters @parameters.json
```

### 2. Get Connection Information

```bash
# After deployment completes, get output values
az deployment group show \
  --resource-group m3w-rg \
  --name <deployment-name> \
  --query properties.outputs
```

### 3. Configure GitHub Secrets

Add these secrets in repository settings:

```
AZURE_CREDENTIALS                    # Service Principal JSON
AZURE_REGISTRY_LOGIN_SERVER          # Get from deployment output
AZURE_REGISTRY_USERNAME              # Get from deployment output
AZURE_REGISTRY_PASSWORD              # Get from deployment output
DATABASE_URL                         # Get from deployment output
NEXTAUTH_URL                         # Your application URL
NEXTAUTH_SECRET                      # Generate random string
GITHUB_CLIENT_ID                     # GitHub OAuth
GITHUB_CLIENT_SECRET                 # GitHub OAuth
```

### 4. Initial Deployment

Push to main branch will automatically trigger deployment:

```bash
git push origin main
```

Or manually trigger:

```bash
# In GitHub Actions page
# Select "Azure Deployment"
# Click "Run workflow"
# Action: deploy
```

## Rollback Mechanism

Container Apps retains the last 3 revision versions.

### Automatic Rollback

If deployment fails, Container Apps automatically maintains the previous healthy version.

### Manual Rollback

**Method 1: via GitHub Actions**

```bash
# In GitHub Actions page
# Select "Azure Deployment"
# Click "Run workflow"
# Action: rollback
# Revision: (leave empty to rollback to previous version)
```

**Method 2: via Azure CLI**

```bash
# List all revisions
az containerapp revision list \
  --name m3w-app \
  --resource-group m3w-rg \
  --output table

# Rollback to specific revision
az containerapp revision activate \
  --name m3w-app \
  --resource-group m3w-rg \
  --revision <revision-name>
```

**Method 3: via Azure Portal**

1. Open Azure Portal
2. Navigate to Container Apps → m3w-app
3. Select "Revisions" from left menu
4. Choose a previous healthy revision
5. Click "Activate" to activate

### Revision Management

Container Apps revision pattern:
- `m3w-app--<random>`: Auto-generated revision name
- New revision created for each deployment
- Maximum 3 inactive revisions retained
- Quick traffic switching between revisions

## Monitoring and Logs

### View Live Logs

```bash
# Stream logs
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --follow

# View last 100 lines
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --tail 100
```

### View in Azure Portal

1. Container Apps → m3w-app → Log stream
2. Or use Log Analytics for queries

## Cost Monitoring

### Set Budget Alerts

```bash
# Create budget
az consumption budget create \
  --budget-name m3w-monthly-budget \
  --amount 60 \
  --time-grain Monthly \
  --start-date $(date +%Y-%m-01) \
  --end-date 2026-12-31 \
  --resource-group m3w-rg
```

### View Costs

```bash
# View current month costs
az consumption usage list \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date +%Y-%m-%d) \
  --query "[].{Service:instanceName, Cost:pretaxCost}" \
  --output table
```

Or in Azure Portal:
- Cost Management + Billing → Cost Analysis

## Performance Optimization

### 1. Enable Scale to Zero

When no traffic, app automatically scales to 0 instances:
- Cold start time: ~10-15 seconds
- Suitable for personal projects or low-traffic applications

### 2. Database Connection Pool

Configure in `DATABASE_URL`:
```
postgresql://user:pass@server:5432/db?connection_limit=5&pool_timeout=10
```

### 3. Storage Access

Use CDN or migrate static assets to Storage Static Website (free):
```bash
az storage blob service-properties update \
  --account-name m3wstorageXXX \
  --static-website \
  --index-document index.html
```

## Further Cost Reduction

### If You Need Even More Savings

1. **Use Free Tier Database** (Development/Testing Only):
   - Azure Database for PostgreSQL has no free tier
   - Consider Supabase free tier (500MB)
   - Or Neon.tech free tier

2. **Stop Database When Idle**:
   ```bash
   # Stop PostgreSQL when not in use
   az postgres flexible-server stop \
     --name m3w-postgres-XXX \
     --resource-group m3w-rg
   
   # Start when needed
   az postgres flexible-server start \
     --name m3w-postgres-XXX \
     --resource-group m3w-rg
   ```

3. **Scheduled Shutdown** (Nighttime):
   Use Azure Automation or Azure Functions to stop services on schedule

4. **Use Azure Student Subscription**:
   - $100 free credit monthly
   - 12 months of free services

## Troubleshooting

### Application Fails to Start

```bash
# Check latest revision status
az containerapp revision list \
  --name m3w-app \
  --resource-group m3w-rg

# If failed, rollback immediately
az containerapp revision activate \
  --name m3w-app \
  --resource-group m3w-rg \
  --revision <previous-working-revision>
```

### Database Connection Failure

```bash
# Test connection
psql "$DATABASE_URL"

# Check firewall rules
az postgres flexible-server firewall-rule list \
  --name m3w-postgres-XXX \
  --resource-group m3w-rg
```

## Resource Cleanup

Delete all resources when no longer needed:

```bash
az group delete --name m3w-rg --yes --no-wait
```

---

**Estimated Monthly Cost**: $40-60  
**Use Cases**: Personal projects, low-traffic applications  
**Advantages**: Auto-scaling, quick rollback, low cost
