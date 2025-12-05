# Development Standards Instruction

## Project Portability Principles
- Keep the project portable and runnable without modification.
- Use `.env` (not `.env.local`) for all environment variables; `.env` stays git-ignored and `.env.example` is committed.
- Document all npm dependencies in `package.json`; use official npm registry by default and document mirror usage for restricted networks.
- Container configurations must rely on standard images with documented fallback mirrors.
- Handle paths with cross-platform utilities such as `path.join` and `path.resolve`; never hardcode absolute paths.
- Document prerequisites, setup instructions, and troubleshooting steps for all major platforms.
- Update this document immediately when new technical decisions are made.

## Module System Standards
- Root package.json has `"type": "module"` to treat .js files as ES modules.
- Build scripts use CommonJS (`require`, `module.exports`) and must have `.cjs` extension.
- Frontend and backend use ES modules (`import`/`export`) for all application code.
- Configuration files that use CommonJS must use `.cjs` extension (e.g., `postcss.config.cjs`).

## Testing and Type Safety
- Favor complete objects or factory helpers in tests to satisfy type constraints instead of chaining `as unknown as`.
- Introduce named type aliases for composite shapes to keep intent clear.
- Align mock return values with their interfaces; if a gap is unavoidable, use a single `as` with a clarifying comment.
- Extend shared fixtures in `frontend/src/test/fixtures/metadata.ts` and `backend/src/test/fixtures/prisma.ts` before creating new mock data sources.

## Key Technical Decisions
- File storage uses hash-based deduplication with reference counting; metadata remains user-specific.
- Audio cover art is extracted during upload, stored in MinIO under `covers/{fileHash}.jpg`, and always exposed as an absolute URL (built from `API_BASE_URL` + `/api/songs/:id/cover`) via the cover URL helper so future migrations (for example presigned URLs) do not require data changes and the fully separated frontend can consume the value directly.
- Audio streaming uses API proxy pattern (`/api/songs/[songId]/stream`) with Range request support; MinIO is never exposed to clients and remains internal to the backend network.
- Metadata extraction prioritizes user edits over backend extraction, and backend extraction over frontend extraction.
- Environment configuration requires separate `.env` files for frontend and backend.
- Backend environment variables in `backend/.env` (DATABASE_URL, JWT_SECRET, GITHUB_CLIENT_*, MinIO).
- Frontend environment variables in `frontend/.env` (VITE_API_URL).
- Container environments use `.env.docker` with `host.containers.internal` to access host services; local development uses `.env` with `localhost`.
- When the production container joins the docker-compose network (`m3w_default`), use container service names (`m3w-postgres`, `m3w-minio`) instead of `host.containers.internal`.
- Authentication uses JWT tokens with GitHub OAuth; no session database.
- PWA with offline-first architecture using IndexedDB via Dexie and Service Worker with Workbox.
- User feedback flows through the toast store defined in `frontend/src/components/ui/use-toast.ts` with a single `<Toaster />` in `frontend/src/main.tsx`.
- **Demo Mode**: Compile-time controlled via `BUILD_TARGET=rc` (includes code) or `BUILD_TARGET=prod` (tree-shaken), runtime enabled via `DEMO_MODE=true` in backend `.env`; provides storage limits, hourly reset (optional), and user-facing banner with free music links.

## UI Component Standards & Accessibility (a11y)

### Component Usage Requirements
- **NEVER use raw HTML elements** (`<div>`, `<span>`, `<button>`) for UI construction.
- **ALWAYS use component library** components from `frontend/src/components/ui/` or create reusable components when needed.
- **Rationale**: Ensures consistent styling, built-in a11y support, and maintainable codebase.

### Available UI Components
- **Layout**: `Stack` (flex layouts with gap/align/justify), `Separator` (semantic dividers)
- **Typography**: `Text` (semantic headings/body with auto-mapping to h1-h6/p/span)
- **Interactive**: `Button`, `Dialog`, `Sheet`, `DropdownMenu`, `Select`
- **Display**: `Badge`, `Card`, `Avatar`, `EmptyState`
- **Forms**: `Input`, `Textarea`, `Label`, `FormDescription`
- **Feedback**: `toast` (via `useToast` hook), `PageLoader`
- **Lists**: `ListItem` for consistent list styling

### Accessibility Requirements
1. **Semantic HTML**:
   - Use `<nav>`, `<aside>`, `<main>`, `<article>`, `<section>` for structural elements
   - Use `<ul>`/`<li>` for lists (not div stacks)
   - Use `<button>` for clickable actions (not `<div onClick>`)
   - Use `<a>` for navigation links with proper `href`

2. **ARIA Attributes**:
   - Add `role` when semantic HTML is insufficient (e.g., `role="banner"`)
   - Use `aria-label` for elements without visible text
   - Use `aria-hidden="true"` for decorative elements (icons, separators)
   - Provide `aria-describedby` for complex interactions

3. **Keyboard Navigation**:
   - All interactive elements must be keyboard accessible
   - Add visible focus states: `focus:ring-2 focus:ring-primary focus:ring-offset-2`
   - Maintain logical tab order
   - Support Escape key for closing modals/drawers

4. **Screen Reader Support**:
   - Provide text alternatives for non-text content
   - Use `visually-hidden` class for screen-reader-only text when needed
   - Announce dynamic content changes with `aria-live` when appropriate

5. **Color & Contrast**:
   - Ensure WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
   - Don't rely solely on color to convey information
   - Use Tailwind's semantic color tokens (`text-foreground`, `bg-muted`, etc.)

### Example: Good vs Bad

❌ **Bad** (raw elements, no a11y):
```tsx
<div className="flex gap-2">
  <div onClick={handleClick}>Click me</div>
  <div>|</div>
  <div className="flex gap-1">
    <a href="#">Link 1</a>
    <span>·</span>
    <a href="#">Link 2</a>
  </div>
</div>
```

✅ **Good** (components, semantic HTML, a11y):
```tsx
<Stack direction="horizontal" gap="sm" align="center">
  <Button onClick={handleClick}>Click me</Button>
  <Separator orientation="vertical" className="h-4" aria-hidden="true" />
  <nav aria-label="Quick links">
    <ul className="flex gap-1 list-none">
      <li><a href="#link1" className="focus:ring-2 focus:ring-primary">Link 1</a></li>
      <li aria-hidden="true">·</li>
      <li><a href="#link2" className="focus:ring-2 focus:ring-primary">Link 2</a></li>
    </ul>
  </nav>
</Stack>
```

## TypeScript Standards
- `strict: true` must remain enabled.
- Avoid `any` unless explicitly annotated with `// @ts-ignore` and justified.
- Prefer `interface` for object type definitions.
- Use Zod for runtime validation.

## Code Organization
- Keep business logic in `backend/src/lib/services`.
- Keep API routes thin and delegate to services.
- Frontend components organized by purpose: `components/ui` (primitives), `components/features` (domain), `components/layouts` (structure).
- Dashboard routes render inside `DashboardLayoutShell`; compose page sections with `AdaptiveLayout` and `AdaptiveSection` so base and minimum heights stay consistent across breakpoints.

## API Response Patterns
- API routes return `ApiResponse<T>` with `{ success, data?, error?, details? }` structure.
- Export shared types from `@m3w/shared` (types are organized in `shared/src/types/` directory).
- Perform boundary validation with Zod or typed helpers before calling services.
- Log developer diagnostics through `backend/src/lib/logger.ts` while keeping user-facing messages concise.
- Client components map API responses to toasts using the `useToast` hook.

## Naming Conventions
- Components use PascalCase.
- Functions and variables use camelCase.
- Constants use UPPER_SNAKE_CASE.
- Files use kebab-case for routes and PascalCase for components.

## Pre-Commit Local Testing

Before committing code, run the following checks to catch issues early:

### Required Checks (Always Run)
```powershell
# 1. Lint check (from project root)
npm run lint --workspaces

# 2. Type check (run in each workspace - no unified command)
cd frontend; npx tsc --noEmit; cd ..
cd backend; npx tsc --noEmit; cd ..
cd shared; npx tsc --noEmit; cd ..

# 3. Run tests
npm test --workspaces

# 4. Build verification
npm run build
```

**Quick One-Liner (PowerShell):**
```powershell
npm run lint --workspaces; cd frontend; npx tsc --noEmit; cd ..; cd backend; npx tsc --noEmit; cd ..; npm test --workspaces; npm run build
```

### When to Run Docker Image Testing

Run local Docker image verification when changes affect:
- Backend API routes or services
- Dockerfile or build configuration
- Environment variables or configuration files
- Database schema (Prisma migrations)
- Build scripts or dependencies

**Docker Build Test Workflow:**
```bash
# 1. Build production image
docker build -t m3w:test -f docker/Dockerfile --build-arg BUILD_TARGET=prod .

# 2. Ensure services are running
docker-compose up -d

# 3. Create backend/.env.docker (if not exists)
# Key differences from .env:
#   DATABASE_URL=postgresql://postgres:postgres@m3w-postgres:5432/m3w
#   MINIO_ENDPOINT=m3w-minio

# 4. Run container in docker-compose network
docker run -d \
  --name m3w-test \
  --network m3w_default \
  -p 4000:4000 \
  --env-file backend/.env.docker \
  m3w:test

# 5. Run migrations
docker exec m3w-test npx prisma migrate deploy

# 6. Smoke tests
curl http://localhost:4000/api/auth/me  # Should return 401
docker logs m3w-test | grep -i error     # Check for errors

# 7. Functional test (optional)
# - Start frontend: cd frontend && npm run dev
# - Test sign-in, upload, playback flows

# 8. Cleanup
docker stop m3w-test && docker rm m3w-test && docker rmi m3w:test
```

**For RC builds** (with demo mode):
```bash
docker build -t m3w:rc -f docker/Dockerfile --build-arg BUILD_TARGET=rc .
docker run -d --name m3w-rc --network m3w_default -p 4000:4000 \
  --env-file backend/.env.docker -e DEMO_MODE=true m3w:rc
```

## Git Workflow

### Branch Protection Rules

- **NEVER push directly to `main` branch**. All changes to `main` must go through Pull Requests.
- Feature branches can be pushed freely for backup and CI.
- Only commit or push when explicitly requested by the user; keep the working state ready for commits at all times.

### Mandatory Binding Chain

Every PR must be traceable through the full hierarchy:

```
PR → Issue → Epic → Milestone
```

- **No Issue? Create one first.** Even small fixes need an issue for tracking.
- **No Epic? Find or create one.** Group related issues under domain Epics.
- **No Milestone? Assign one.** All Epics must belong to a Milestone.

### Branch Naming

- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `refactor/<description>` - Code refactoring
- `docs/<description>` - Documentation updates
- `chore/<description>` - Maintenance tasks

### PR Workflow

1. **Create Issue** (if not exists) with Epic reference in body
2. **Update Epic checklist** to include new issue
3. **Create feature branch** from `main`
4. **Run local pre-commit checks** (lint/type-check/test/build)
5. **Make commits** following Conventional Commits format
6. **Push feature branch** to remote
7. **Create Pull Request** with:
   - Clear English title and description
   - `Closes #XX` to auto-close the linked issue
8. **Monitor PR checks** using `gh pr checks --watch`
9. **Handle Copilot reviews** (see below)
10. **Merge** when all checks pass (squash merge preferred)
11. **Update Epic checklist** to mark issue as completed

### Commit Message Format

Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

**All PR content must be in English** (title, description, comments) for consistency and broader collaboration.

## Project Management

### Structure Overview

The project uses a **two-layer management structure**:

```
Milestone (deadline-driven)
└── Epic (feature domain aggregation)
    └── Issue (specific task)
```

### Resources

| Resource | URL | Purpose |
|----------|-----|----------|
| **Milestone 1** | https://github.com/test3207/m3w/milestone/1 | Core Product Release (Closed: 2025-11-30) |
| **Milestone 2** | https://github.com/test3207/m3w/milestone/2 | Enhanced Offline & Quality (Due: 2025-12-30) |
| **Project Board** | https://github.com/users/test3207/projects/3 | Kanban view for task tracking |

### Active Epics (Milestone 2)

| Epic | Issue # | Description |
|------|---------|-------------|
| Epic 5: Auth User Offline | #87 | Offline capabilities for authenticated users |
| Epic 6: UX Polish | #88 | User experience improvements |
| Epic 7: Infrastructure & Quality | #89 | Code quality, testing, infrastructure |

### Issue Management Rules

1. **Milestone only links Epics**: Individual issues are NOT directly linked to Milestone
2. **Epic tracks sub-issues via checklist**: Each Epic body contains `- [x] #XX` checklist for progress tracking
3. **Issue references Epic in body**: Use "Parent Issue: Epic X (#YY)" in issue description
4. **GitHub auto-calculates progress**: Epic checklist shows completion percentage

### Issue Lifecycle

#### Creating a New Issue

1. **Create the issue** with proper body referencing parent Epic:
```bash
gh issue create --title "Feature description" --body "Parent Issue: Epic X (#YY)

## Summary
...

## Acceptance Criteria
- [ ] ..."
```

2. **Link issue to Epic as sub-issue** (formal parent-child relationship):
```typescript
// Use the issue's node ID (from creation response) to add as sub-issue
mcp_github_sub_issue_write({
  method: 'add',
  owner: 'test3207',
  repo: 'm3w',
  issue_number: 89,        // Parent Epic number
  sub_issue_id: 3697251100 // Child issue's numeric ID (not issue number!)
})
```

3. **Update the parent Epic's checklist** to include the new issue:
```typescript
// Fetch current Epic body, append new checklist item
mcp_github_issue_read({ method: 'get', owner: 'test3207', repo: 'm3w', issue_number: 89 })
// Then update with new item added
mcp_github_issue_write({
  method: 'update',
  owner: 'test3207',
  repo: 'm3w',
  issue_number: 89,
  body: `...existing content...
- [ ] #XX New sub-issue`
})
```

**Important**: Step 2 creates the formal GitHub sub-issue relationship. Step 3 maintains a human-readable checklist. Both are required.

#### Closing an Issue

When closing an issue (via PR merge or manual close):

1. **Use `Closes #XX`** in PR description or commit message for auto-close
2. **Update Epic checklist**: Change `- [ ] #XX` to `- [x] #XX` with completion note:
   ```markdown
   - [x] #95 Issue title *(closed: resolved in PR #96)*
   ```
3. **If not auto-closed**, manually close with comment:
   ```bash
   gh issue close 95 --comment "Resolved in PR #96"
   ```

### CLI Quick Reference

```bash
# List all issues by state
gh issue list --state all

# View Epic details
gh issue view 89

# Check milestone progress
gh api repos/test3207/m3w/milestones/2 --jq '{title, open_issues, closed_issues, due_on}'

# Close issue with comment
gh issue close <number> --comment "Resolved in PR #XX"
```

## Pull Request Management

### Monitoring PR Checks

Use GitHub CLI (`gh`) and MCP tools to monitor CI status:

```bash
# Check PR status (use PR number)
gh pr checks 43

# Expected output format:
# ✓  PR Check/Build & Test
# ✓  PR Check/Code Quality
# ✓  PR Check/Docker Build Validation
# ✓  PR Check/PR Check Summary
```

**Using MCP Tools:**
```typescript
// Read PR status
mcp_github_pull_request_read({
  method: 'get_status',
  owner: 'test3207',
  repo: 'm3w',
  pullNumber: 43
})

// Merge when all checks pass
mcp_github_merge_pull_request({
  owner: 'test3207',
  repo: 'm3w',
  pullNumber: 43,
  merge_method: 'squash'
})
```

### PR Check Workflow

1. **Create PR**: Use MCP `mcp_github_create_pull_request`
2. **Wait for CI**: Checks typically take 2-3 minutes
3. **Monitor Status**: Use `gh pr checks <number>` or MCP `pull_request_read`
4. **Address Failures**: 
   - Lint errors: Fix and push to same branch
   - Type errors: Run `npm run type-check` locally first
   - Test failures: Run `npm test` locally to reproduce
   - Build failures: Run `npm run build` locally
5. **Merge**: Use MCP `mcp_github_merge_pull_request` when green
6. **Cleanup**: Delete local and remote branches after merge

### Required PR Checks

All PRs must pass these automated checks:
- **Code Quality**: ESLint for frontend and backend
- **Build & Test**: Vitest unit tests for frontend and backend
- **Docker Build Validation**: Production image builds successfully
- **TypeScript**: No type errors in strict mode

### Best Practices

- **Run checks locally first**: Don't rely on CI to catch basic errors
- **Use MCP + gh CLI**: Automate PR creation and monitoring
- **Squash merge**: Keep main branch history clean
- **Delete branches**: Clean up after merge to avoid clutter
- **Close linked issues**: Use `Closes #XX` in PR description or commit message

### Handling Copilot Code Review

GitHub Copilot automatically reviews PRs and leaves comments. These comments create "review threads" that must be resolved before merging.

#### Workflow for Copilot Reviews

1. **Get unresolved review threads**:
```bash
gh api graphql -f query='query { 
  repository(owner: "test3207", name: "m3w") { 
    pullRequest(number: 96) { 
      reviewThreads(first: 20) { 
        nodes { id isResolved comments(first: 1) { nodes { body } } } 
      } 
    } 
  } 
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

2. **For each unresolved comment**:
   - **Analyze**: Determine if it's a valid issue or false positive
   - **Fix if needed**: Make code changes and push
   - **Reply**: Explain what was fixed (or why it's not applicable)
   ```bash
   echo '{"body": "Fixed in commit abc123.", "in_reply_to": <comment_id>}' | \
     gh api repos/test3207/m3w/pulls/96/comments --input -
   ```

3. **Resolve the conversation** (reply alone does NOT resolve):
```bash
gh api graphql -f query='mutation { 
  resolveReviewThread(input: {threadId: "<thread_id>"}) { 
    thread { isResolved } 
  } 
}'
```

4. **Verify all resolved**:
```bash
gh api graphql -f query='...' --jq '... | select(.isResolved == false) | length'
# Should return 0
```

#### Quick Reference: Comment IDs vs Thread IDs

- **Comment ID** (`in_reply_to`): Numeric ID like `2589104852`, used for replying
- **Thread ID** (`threadId`): String ID like `PRRT_kwDONLmAws5kuXB6`, used for resolving
- Get both from the GraphQL query above

#### Common Copilot Comment Types

| Type | Action |
|------|--------|
| Valid bug | Fix code, reply with commit hash |
| Design suggestion | Acknowledge or explain current design |
| Nitpick | Acknowledge, fix if trivial |
| False positive | Reply explaining why it's not applicable |

## Docker Image Build and Versioning

### Build Scripts

All build scripts are cross-platform Node.js scripts:

```bash
# Build RC images (for demo/testing)
node scripts/build-docker.cjs --type rc --rc 1
# Or: npm run docker:build:rc

# Build production images (from current package.json version)
node scripts/build-docker.cjs --type prod
# Or: npm run docker:build

# Bump version for next release
node scripts/bump-version.cjs patch  # or minor, major
# Or: npm run version:patch
```

See `node scripts/build-docker.cjs --help` for all options.

### Versioning Strategy

**RC Builds**:
- Format: `v0.1.0-rc.1`, `v0.1.0-rc.2`, `v0.1.0-rc.3`...
- Base version unchanged during RC cycle
- Tags: version-specific + `rc` (rolling)
- Never updates `latest` tag

**Production Builds**:
- Format: `v0.1.0`, `v0.1.1`, `v0.2.0`...
- Version bumped before build (patch/minor/major)
- Tags: full version + `v0.1` + `v0` + `latest`
- `latest` always points to stable production

### Image Variants

- `m3w`: All-in-One (Frontend + Backend)
- `m3w-backend`: Backend API only
- `m3w-frontend`: Frontend static files (TBD)

### CI/CD Automation

See [Issue #61](https://github.com/test3207/m3w/issues/61) for GitHub Actions workflows:
- RC builds: Auto-trigger on push to main
- Production builds: Manual trigger with version selection
- Image optimization: [Issue #60](https://github.com/test3207/m3w/issues/60)

## Local Production Testing

### Using Build Scripts (Recommended)

The build script auto-detects the container runtime (Docker or Podman):

```bash
# Build all image variants (AIO + Backend + Frontend)
node scripts/build-docker.cjs --type prod
# Or: npm run docker:build

# Build with registry prefix
node scripts/build-docker.cjs --type prod --registry ghcr.io/test3207

# Build RC variant
node scripts/build-docker.cjs --type rc --rc 1
# Or: npm run docker:build:rc

# Build and test
node scripts/build-docker.cjs --type prod --test
# Or: npm run docker:build:test
```

See `node scripts/build-docker.cjs --help` for full options.

### Manual Build and Test

Use `docker` or `podman` interchangeably:

- Build production images with `docker build -t m3w:local -f docker/Dockerfile docker-build-output/`
- Use `.env.docker` (created from `.env.docker.example`) for container environments.
- When using docker-compose services, the container must join the `m3w_default` network to access PostgreSQL and MinIO via their container names (`m3w-postgres`, `m3w-minio`).
- Run containers with `docker run -d --name m3w-prod --network m3w_default -p 4000:4000 --env-file backend/.env.docker m3w:local`.
- For standalone containers without compose, use `host.containers.internal` in `.env.docker` to access host services.
- Verify builds pass type checking, linting, and produce functional containers before deployment.
- Test authentication flows and database connectivity in the containerized environment.

**Cleanup**:
```bash
docker stop m3w-prod ; docker rm m3w-prod ; docker rmi m3w:local
# Or with podman:
podman stop m3w-prod ; podman rm m3w-prod ; podman rmi m3w:local
```

**For RC builds** (with demo mode):
```bash
node scripts/build-docker.cjs --type rc --rc 1
docker run -d --name m3w-rc --network m3w_default -p 4000:4000 \
  --env-file backend/.env.docker -e DEMO_MODE=true ghcr.io/test3207/m3w:v0.1.0-rc.1
```

