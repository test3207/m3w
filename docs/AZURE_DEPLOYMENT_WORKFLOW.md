# Azure Deployment Workflow

## Overview

The Azure deployment workflow includes comprehensive pre-deployment checks to ensure code quality before deploying to production. If any check fails, the deployment is automatically aborted.

## Workflow Stages

```
┌─────────────────────────────────────────────────────────────┐
│                     Trigger Events                          │
│  • Push to main branch                                      │
│  • Manual workflow dispatch (deploy/rollback)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Stage 1: Pre-Deployment Checks                 │
│                                                             │
│  Job 1: code-quality                                        │
│  ├─ ESLint (npm run lint)                                   │
│  ├─ TypeScript type check (tsc --noEmit)                    │
│  ├─ Prisma schema validation                                │
│  └─ Migration drift check                                   │
│                                                             │
│  Job 2: build-and-test (runs in parallel)                   │
│  ├─ Install dependencies                                    │
│  ├─ Generate Prisma Client                                  │
│  ├─ Build Next.js (npm run build)                           │
│  ├─ Run tests with coverage (npm run test)                  │
│  └─ Upload test results                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                    ✅ All checks pass
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Stage 2: Build & Push Docker Image                  │
│  ├─ Generate image tag from commit SHA                      │
│  ├─ Build Docker image (docker/Dockerfile)                  │
│  ├─ Push to Azure Container Registry                        │
│  └─ Tag as :latest and :<commit-sha>                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Stage 3: Database Migration                       │
│  ├─ Install dependencies                                    │
│  ├─ Generate Prisma Client                                  │
│  ├─ Run migrations (prisma migrate deploy)                  │
│  └─ Verify migration status                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│        Stage 4: Deploy to Container Apps                    │
│  ├─ Azure login                                             │
│  ├─ Deploy new container revision                           │
│  ├─ Configure environment variables                         │
│  ├─ Wait for deployment (30s)                               │
│  └─ Health check (5 retries, 10s interval)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Stage 5: Notification                          │
│  └─ Report deployment status                                │
│     ├─ ✅ Success: All checks + deployment                  │
│     └─ ❌ Failure: Show which stage failed                  │
└─────────────────────────────────────────────────────────────┘
```

## Failure Handling

### Stage 1 Failure (Pre-Deployment Checks)

If **code-quality** or **build-and-test** fails:
- ❌ Deployment is **immediately aborted**
- No Docker image is built
- No changes are made to Azure resources
- Notification job reports which check failed

**Example failures:**
- ESLint errors (code style issues)
- TypeScript compilation errors
- Prisma schema validation errors
- Uncommitted migration files
- Build failures
- Test failures

**Resolution:**
1. Fix the reported issues locally
2. Commit and push fixes
3. Workflow automatically retries on new push

### Stage 2-4 Failure (Build/Deploy)

If Docker build, migration, or deployment fails:
- Previous revision remains active (zero downtime)
- Container Apps keeps 3 recent revisions for rollback
- Use manual rollback if needed

**Manual rollback:**
```bash
# Via GitHub Actions
# Go to Actions → Azure Deployment → Run workflow
# Select action: rollback

# Via Azure CLI
az containerapp revision list \
  --name m3w-app \
  --resource-group m3w-rg

az containerapp revision activate \
  --name m3w-app \
  --resource-group m3w-rg \
  --revision <previous-revision-name>
```

## Job Dependencies

```
code-quality ─────┐
                  ├──> build-and-push ──> database-migration ──> deploy ──> notify
build-and-test ───┘
```

- `build-and-push` requires **both** `code-quality` and `build-and-test` to succeed
- If either pre-deployment check fails, `build-and-push` will not run
- Subsequent jobs (`database-migration`, `deploy`, `notify`) are skipped

## Environment Variables Required

### GitHub Secrets

For deployment to work, configure these secrets in your GitHub repository:

```
AZURE_CREDENTIALS              # Azure service principal JSON
AZURE_REGISTRY_LOGIN_SERVER    # ACR login server (e.g., m3wacr.azurecr.io)
AZURE_REGISTRY_USERNAME        # ACR username
AZURE_REGISTRY_PASSWORD        # ACR password
DATABASE_URL                   # PostgreSQL connection string
NEXTAUTH_URL                   # Application URL
NEXTAUTH_SECRET                # NextAuth.js secret
GITHUB_CLIENT_ID               # GitHub OAuth client ID
GITHUB_CLIENT_SECRET           # GitHub OAuth client secret
```

### How to Get These Secrets

Run the deployment script:
```bash
cd azure
./deploy.sh secrets
```

Copy the output to GitHub → Settings → Secrets and variables → Actions.

## Comparison with PR Checks

The deployment workflow includes **the same checks** as PR checks:

| Check | PR Workflow | Deploy Workflow |
|-------|-------------|-----------------|
| ESLint | ✅ | ✅ |
| TypeScript type check | ✅ | ✅ |
| Prisma validation | ✅ | ✅ |
| Migration drift | ✅ | ✅ |
| Build | ✅ | ✅ |
| Tests | ✅ | ✅ |
| Docker build | ✅ | ✅ |
| Coverage report | ✅ | ✅ (artifact) |
| Docker push | ❌ | ✅ |
| Database migration | ❌ | ✅ |
| Container Apps deploy | ❌ | ✅ |
| Health check | ❌ | ✅ |

**Key difference:** PR checks validate without deploying; deploy workflow validates **then** deploys.

## Monitoring Deployment

### View Workflow Status

```bash
# In GitHub UI
# Go to: Actions → Azure Deployment → Select run

# Shows:
# - Which stage is running
# - Logs for each job
# - Success/failure status
```

### View Live Deployment

```bash
# Watch Container Apps logs
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --follow

# Check current revision
az containerapp revision list \
  --name m3w-app \
  --resource-group m3w-rg \
  --query "[?properties.active==\`true\`]"
```

## Best Practices

1. **Always run PR checks first** - Don't push directly to `main` without PR review
2. **Monitor first deployment** - Watch logs to ensure health check passes
3. **Keep revisions clean** - Old revisions are auto-deactivated but stored for 7 days
4. **Test rollback** - Verify rollback works before you need it in production
5. **Set up alerts** - Configure Azure Monitor alerts for deployment failures

## Troubleshooting

### Deployment stuck at health check

```bash
# Check application logs
az containerapp logs show \
  --name m3w-app \
  --resource-group m3w-rg \
  --tail 100

# Check health endpoint manually
curl https://<app-url>.azurecontainerapps.io/api/health
```

### Tests pass locally but fail in CI

Common causes:
- Missing environment variables in workflow
- Different Node.js version (workflow uses Node 22)
- Timezone or locale differences
- File path case sensitivity

### Pre-deployment checks failed but I need to deploy urgently

**Not recommended**, but if absolutely necessary:
1. Comment out the failing check temporarily
2. Deploy using workflow_dispatch
3. Fix the issue ASAP
4. Restore the check

**Never skip:**
- Build step (deployment will fail anyway)
- Prisma validation (can break database)
- Migration drift check (can cause data issues)

## Cost Impact

Pre-deployment checks add ~3-5 minutes to deployment time but **prevent costly rollbacks**:

- Failed deployment with rollback: 10-15 minutes downtime
- Caught by pre-checks: 0 minutes downtime, $0 wasted compute

**Estimated CI/CD costs:**
- GitHub Actions: Free for public repos, included in GitHub Pro/Team
- Per deployment: ~0.5 vCPU hours (~$0.02)
- Monthly (10 deployments): ~$0.20

Compare to Container Apps deployment cost: $15-25/month runtime cost.

## Summary

✅ **Pre-deployment checks ensure:**
- Code quality (linting, type safety)
- Build succeeds
- Tests pass
- Database schema is valid
- No uncommitted migrations

❌ **If checks fail:**
- Deployment stops immediately
- No resources are changed
- Zero downtime impact

🔄 **If deployment fails after checks:**
- Previous revision stays active
- Use rollback feature
- Zero downtime guaranteed
