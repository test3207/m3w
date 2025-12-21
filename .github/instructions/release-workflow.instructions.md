# Release Workflow Instruction

## Overview

This document describes how to create releases for M3W using GitHub Actions workflows.

## Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| Create RC Branch | `create-rc-branch.yml` | Schedule (weekly) or manual | Create release candidate |
| Build RC Images | `build-rc.yml` | Push to `release/v*-rc*` | Build RC Docker images |
| Build Release | `build-release.yml` | Manual only | Promote RC to production |

## RC (Release Candidate) Release

RC releases are for testing before production. Created from `main` branch.

### Automatic Schedule

Runs every Tuesday at 10:00 AM Beijing time (if commits exist since last RC).

### Manual Trigger

```bash
# Trigger RC branch creation
gh workflow run "Create RC Branch"

# Monitor workflow progress
gh run watch --exit-status

# Check created release
gh release list --limit 5
```

### What Happens

1. Creates branch `release/vX.Y.Z-rc.N` from `main`
2. Builds Docker images with `rc` tag
3. Pushes to GitHub Container Registry (ghcr.io)
4. Creates GitHub pre-release with assets

## Production Release

Production releases promote a tested RC to stable.

### Trigger Command

```bash
# Release from RC branch
gh workflow run "Build Release" \
  -f release_branch=release/v2.0.0-rc.1 \
  -f bump_type=patch \
  -f create_tag=true

# Monitor workflow progress
gh run watch --exit-status

# Sync local after release (cherry-picks version bump)
git pull
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `release_branch` | Yes | - | RC branch to release (e.g., `release/v2.0.0-rc.1`) |
| `bump_type` | Yes | `major` | Version bump: `patch`, `minor`, or `major` |
| `create_tag` | No | `true` | Create git tag |
| `dry_run` | No | `false` | Build without push/release |

### What Happens

1. Validates RC branch exists and format is correct
2. Creates `release/vX.Y.Z` branch from RC
3. Bumps version in all `package.json` files
4. Builds and pushes Docker images to ghcr.io
5. Creates GitHub release with archives
6. Cherry-picks version bump commit to `main`

## Version Bump Guidelines

| Bump Type | When to Use | Example |
|-----------|-------------|---------|
| `patch` | Bug fixes, internal refactoring, non-breaking API changes | v2.0.0 → v2.0.1 |
| `minor` | New features, backward-compatible additions | v2.0.0 → v2.1.0 |
| `major` | Breaking changes, API contract changes, data migrations | v2.0.0 → v3.0.0 |

### Examples

- Removing internal `coverUrl` field (API returns same data structure) → `patch`
- Adding new `/api/stats` endpoint → `minor`
- Changing `/api/songs` response format → `major`

## Release Checklist

Before releasing to production:

- [ ] RC tested in demo environment
- [ ] No critical bugs reported
- [ ] Database migrations tested (if any)
- [ ] Docker images build successfully
- [ ] All CI checks pass on RC branch

## Quick Reference

### Full Release Flow

```bash
# 1. Create RC (if not exists)
gh workflow run "Create RC Branch"
gh run watch --exit-status

# 2. Test RC in demo environment
# ... manual testing ...

# 3. Release to production
gh workflow run "Build Release" \
  -f release_branch=release/v2.0.1-rc.1 \
  -f bump_type=patch

gh run watch --exit-status

# 4. Sync local
git pull

# 5. Verify
gh release list --limit 3
```

### Check Current Version

```bash
node -e "console.log(require('./package.json').version)"
```

### List Recent Releases

```bash
gh release list --limit 10
```

### View Workflow Runs

```bash
# List workflows
gh workflow list

# View recent runs
gh run list --workflow="build-release.yml" --limit 5
```
