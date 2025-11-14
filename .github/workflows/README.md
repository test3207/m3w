# GitHub Actions Workflows

This directory contains CI/CD workflows for the M3W project.

## Workflows

### PR Check (`pr-check.yml`)

Automated checks that run on every pull request to `main` or `develop` branches.

**Triggered by:**

- Pull requests to `main` or `develop`
- Manual workflow dispatch (for testing)
- Called by other workflows (e.g., create-rc-branch.yml)

**Jobs:**

1. **Code Quality** (parallel)
   - ESLint linting (frontend)
   - TypeScript type checking (frontend + backend)
   - Prisma schema validation
   - Migration drift detection

2. **Build & Test** (parallel)
   - Vite frontend production build
   - Hono backend build
   - Vitest unit tests with coverage (frontend)
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

Coverage excludes (see `frontend/vitest.config.ts`):

- Config files (*.config.*, vitest.setup.ts)
- Type definitions (*.d.ts, frontend/src/types/**)
- Database (backend/prisma/**, backend/src/lib/prisma.ts)
- Test files (**/*.test.ts, frontend/src/test/**)
- UI components (covered by E2E tests)
- Generated code (frontend/src/locales/generated/**)

**Local Testing:**

```bash
# Run all checks locally
npm run lint --prefix frontend
npx tsc --noEmit --project frontend/tsconfig.json
npx tsc --noEmit --project backend/tsconfig.json
npx prisma validate --schema backend/prisma/schema.prisma
npm run build --prefix frontend
npm run build --prefix backend
npm run test:coverage --prefix frontend

# Build Docker image (backend only)
docker build -t m3w:test -f docker/Dockerfile .
```

│ Workflow: create-rc-branch.yml                                 │

Automated release branch creation that runs every Tuesday if there are new commits to `main`.

**Triggered by:**

- Schedule: Every Tuesday at 10:00 AM Beijing time (CST/UTC+8)
- Cron: `0 2 * * 2` (02:00 UTC = 10:00 Beijing)
- Manual workflow dispatch (for testing)

**Jobs:**

1. **Check for New Commits**
   - Checks if there are commits to `main` since last Tuesday (7 days ago)
   - If no commits, workflow exits early (no unnecessary runs)
   - Outputs: commit count, latest commit hash

2. **Run PR Checks** (conditional)
   - Only runs if new commits are detected
   - Calls `pr-check.yml` as a reusable workflow
   - Runs all quality checks, builds, and tests

3. **Create Release Branch** (conditional)
   - Only runs if commits exist AND PR checks pass
   - Uses current version from package.json (no increment)
   - Finds highest existing RC number for that version
   - Creates release branch: `release/v{current-version}-rc{N}`
   - Does NOT update package.json (version stays same)
   - Provides summary with branch URL and next steps

4. **Workflow Summary**
   - Generates comprehensive summary of all steps
   - Shows status of each job and final result

**Version Naming:**

- Uses **current** version from package.json: `MAJOR.MINOR.PATCH`
- Appends `-rcN` suffix (N starts at 1)
- Example: If package.json has `0.1.0`:
  - First release: `release/v0.1.0-rc1`
  - After bug fix: `release/v0.1.0-rc2`
  - After another fix: `release/v0.1.0-rc3`
- **Version in package.json is NOT changed** until merge back to main

**Example Flow:**

```text
Week 1 Monday: Commits A, B, C pushed to main
  package.json version: 0.1.0

Week 1 Tuesday 00:00 UTC: Timer triggers
  ✓ Found 3 commits since last Tuesday
  ✓ Run all PR checks
  ✓ Read version: 0.1.0 (no increment)
  ✓ Check for existing RCs: none found
  ✓ Create branch: release/v0.1.0-rc1
  ✓ package.json still shows: 0.1.0
  ✓ Push branch

Week 1 Wednesday: Bug found in rc1, fix merged to release/v0.1.0-rc1
  → RC increment workflow triggers
  ✓ Create branch: release/v0.1.0-rc2
  ✓ package.json still shows: 0.1.0

Week 1 Thursday: Another fix merged to release/v0.1.0-rc2
  → RC increment workflow triggers
  ✓ Create branch: release/v0.1.0-rc3
  ✓ package.json still shows: 0.1.0

Week 1 Friday: rc3 tested and approved
  → Create PR from release/v0.1.0-rc3 to main
  → Merge (version stays 0.1.0 or manually bump to 0.1.1)
  → Tag: v0.1.0 or v0.1.1

Week 2 Monday-Sunday: No commits
Week 3 Tuesday 00:00 UTC: Timer triggers
  ✗ No commits since last Tuesday
  → Workflow exits (no release needed)
```

**Manual Testing:**

```bash
# Test locally with git commands
git log --since="7 days ago" --oneline

# Check existing RC branches for a version
git branch -r | grep "release/v0.1.1-rc"

# Trigger workflow manually
# Go to: Actions → Scheduled Release → Run workflow
```

**Requirements:**

- `GITHUB_TOKEN` (automatically provided)
- `contents: write` permission (to create branches and update package.json)

**Next Steps After Release Branch Created:**

1. Review the release branch for any issues
2. Test the release candidate in staging environment
3. If bugs found, fix and merge into the release branch (triggers RC increment)
4. Repeat testing until ready for production
5. Create a Pull Request from latest RC branch to `main`
6. **During PR merge**: Optionally update package.json version (manual decision)
7. After merge, create a Git tag: `v{version}`
8. Deploy to production

│ Workflow: increment-rc-branch.yml                              │

Automatically creates the next RC branch when changes are merged into a release branch.

1. **Increment RC**
   - Parses current branch name to extract version and RC number
   - Calculates next RC number (current + 1)
   - Checks if next RC branch already exists
   - Creates new branch: `release/v{version}-rc{N+1}`
   - Provides summary with branch details

**How It Works:**

```text
Scenario: Bug fix workflow (package.json version: 0.1.0)

1. Initial release branch created: release/v0.1.0-rc1
   - package.json still shows: 0.1.0
   
2. Testing reveals a bug

3. Developer creates fix branch: fix/button-crash

4. PR created: fix/button-crash → release/v0.1.0-rc1

5. PR merged → Push to release/v0.1.0-rc1

6. Workflow triggers automatically:
   ✓ Detects push to release/v0.1.0-rc1
   ✓ Parses version: 0.1.0, RC: 1
   ✓ Calculates next RC: 2
   ✓ Creates branch: release/v0.1.0-rc2
   ✓ package.json still shows: 0.1.0
   
7. QA tests release/v0.1.0-rc2

8. If more fixes needed, repeat from step 3 (targets rc2)

9. When ready, merge release/v0.1.0-rc{final} to main
   - Optionally bump version in package.json during merge
   - Tag the release: v0.1.0 or v0.1.1
```

**Branch Naming Pattern:**

- Format: `release/v{MAJOR}.{MINOR}.{PATCH}-rc{N}`
- Uses **current** version from package.json (no auto-increment)
- Examples (package.json shows 0.1.0):
  - `release/v0.1.0-rc1` (first RC)
  - `release/v0.1.0-rc2` (after first bug fix)
  - `release/v0.1.0-rc3` (after second bug fix)
- Examples (package.json shows 1.0.0):
  - `release/v1.0.0-rc1` (major version, first RC)

**Important Notes:**

- RC increment is automatic—no manual action needed
- **package.json version is NOT changed** by release workflows
- Each RC branch is a snapshot of that point in time
- Always test the latest RC branch before merging to main
- Old RC branches remain for reference/rollback
- The latest RC number indicates how many iterations were needed
- Version update happens manually during merge to main (if needed)

## Future Workflows

### Docker Build & Push (planned)

Will build and publish Docker images on:

- Push to `main` → `latest` tag
- Git tags (v*.*.*) → version tags

### Deploy (planned)

Deployment workflows for staging and production environments.

## Monorepo Structure

The project uses npm workspaces with separate frontend and backend:

- **Frontend** (`frontend/`): Vite + React SPA
- **Backend** (`backend/`): Hono REST API
- **Shared** (`shared/`): Common types and schemas

CI/CD workflows handle:

- Independent type checking for frontend and backend
- Separate build processes for each workspace
- Backend-only Docker image (backend + shared dependencies)

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

1. Run `npx prisma migrate dev --schema backend/prisma/schema.prisma` locally
2. Commit the generated migration files
3. Push to your PR branch

## Best Practices

1. **Always run checks locally before pushing**

   ```bash
   # Frontend checks
   npm run lint --prefix frontend
   npm run build --prefix frontend
   npm run test --prefix frontend
   
   # Backend checks
   npx tsc --noEmit --project backend/tsconfig.json
   npm run build --prefix backend
   ```

2. **Keep PR checks fast**
   - PR checks run on every push to PR
   - Currently takes ~5-8 minutes total
   - Docker build uses layer caching
   - Backend-only Docker image (no frontend in production image)

3. **Monitor coverage trends**
   - Aim for >80% coverage on business logic
   - UI components covered by E2E tests (future)
   - Check coverage reports in PR comments

4. **Docker build optimization**
   - Multi-stage build keeps image size small
   - Only rebuilds changed layers
   - Production image ~200-300MB
