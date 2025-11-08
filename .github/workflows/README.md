# GitHub Actions Workflows

This directory contains CI/CD workflows for the M3W project.

## Workflows

### PR Check (`pr-check.yml`)

Automated checks that run on every pull request to `main` or `develop` branches.

**Triggered by:**

- Pull requests to `main` or `develop`
- Manual workflow dispatch (for testing)

**Jobs:**

1. **Code Quality** (parallel)
   - ESLint linting
   - TypeScript type checking
   - Prisma schema validation
   - Migration drift detection

2. **Build & Test** (parallel)
   - Next.js production build
   - Vitest unit tests with coverage
   - Coverage reports uploaded to Codecov
   - Coverage summary posted as PR comment

3. **Docker Build** (after code-quality and build-and-test)
   - Docker image build validation (linux/amd64 only)
   - Build cache optimization with GitHub Actions cache

4. **Summary**
   - Final status check for all jobs
   - Fails if any job fails

**Requirements:**

- `CODECOV_TOKEN` secret (optional, for coverage reports)
  - Get token from <https://codecov.io/>
  - Add to repository secrets: Settings → Secrets → Actions → New repository secret

**Coverage Configuration:**

Coverage excludes (see `vitest.config.ts`):

- Config files (*.config.*, vitest.setup.ts)
- Type definitions (*.d.ts, src/types/**)
- Database (prisma/**, src/lib/db/prisma.ts)
- Test files (**/*.test.ts, src/test/**)
- UI components (covered by E2E tests)
- Generated code (src/generated/**)

**Local Testing:**

```bash
# Run all checks locally
npm run lint
npx tsc --noEmit
npx prisma validate
npm run build
npm run test:coverage

# Build Docker image
docker build -t m3w:test -f docker/Dockerfile .
```

## Future Workflows

### Docker Build & Push (planned)

Will build and publish Docker images on:

- Push to `main` → `latest` tag
- Git tags (v*.*.*) → version tags

### Deploy (planned)

Deployment workflows for staging and production environments.

## Troubleshooting

### Coverage Upload Fails

If Codecov upload fails:

1. Check if `CODECOV_TOKEN` is set in repository secrets
2. The workflow won't fail if coverage upload fails (`fail_ci_if_error: false`)

### Docker Build Cache Issues

If Docker build is slow or cache isn't working:

1. GitHub Actions cache has 10GB limit per repository
2. Old caches are automatically cleaned up
3. You can manually clear cache: Settings → Actions → Caches

### Migration Drift Detection Fails

If migration check fails:

1. Run `npx prisma migrate dev` locally
2. Commit the generated migration files
3. Push to your PR branch

## Best Practices

1. **Always run checks locally before pushing**

   ```bash
   npm run lint && npm run build && npm run test
   ```

2. **Keep PR checks fast**
   - PR checks run on every push to PR
   - Currently takes ~5-8 minutes total
   - Docker build uses layer caching

3. **Monitor coverage trends**
   - Aim for >80% coverage on business logic
   - UI components covered by E2E tests (future)
   - Check coverage reports in PR comments

4. **Docker build optimization**
   - Multi-stage build keeps image size small
   - Only rebuilds changed layers
   - Production image ~200-300MB
