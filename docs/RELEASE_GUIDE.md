# Release Guide

This document provides detailed step-by-step instructions for creating different types of releases for the `@llevintza/fastify-prometheus-metrics` package.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Reference](#quick-reference)
- [Alpha Releases](#alpha-releases)
- [RC Releases](#rc-releases)
- [Beta Releases](#beta-releases)
- [Next Releases](#next-releases)
- [Stable Releases](#stable-releases)
- [Hotfix Releases](#hotfix-releases)
- [Testing Releases](#testing-releases)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before creating any release, ensure you have:

1. **Git access** to the repository
2. **Proper permissions** to push to release branches
3. **Understanding of semantic versioning** and conventional commits
4. **Access to GitHub Packages** for testing releases

## Quick Reference

| Release Type | Branch | Command | Result | Use Case |
|--------------|--------|---------|---------|----------|
| **Alpha** | `feature/*` | `git push origin feature/my-feature` | `1.0.0-alpha.X` | Feature development |
| **RC** | `release/v0.0.1` | `git push origin release/v0.0.1` | `1.0.0-rc.X` | Pre-beta testing |
| **Beta** | `release/rc_1` | `git push origin release/rc_1` | `1.0.0-beta.X` | Release candidates |
| **Next** | `next` | `git push origin next` | `2.0.0-next.X` | Major version dev |
| **Stable** | `main` | `git push origin main` | `1.0.0` | Production releases |
| **Hotfix** | `hotfix/*` | `git push origin hotfix/fix-name` | `1.0.0-hotfix.X` | Emergency fixes |

## Alpha Releases

Alpha releases are for **feature development and early testing**. They are unstable and should not be used in production.

### When to Use Alpha Releases
- ✅ Developing new features
- ✅ Testing experimental functionality
- ✅ Getting early feedback
- ❌ Production use
- ❌ Stable feature testing

### Step-by-Step Process

#### 1. Create Feature Branch
```bash
# Ensure you're on the latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

#### 2. Develop Your Feature
```bash
# Make your changes
# Edit files, add functionality, etc.

# Stage your changes
git add .

# Commit with conventional commit format
git commit -m "feat: add custom histogram buckets configuration"
```

#### 3. Push to Trigger Alpha Release
```bash
# Push the branch (this triggers CI/CD)
git push -u origin feature/your-feature-name
```

#### 4. Verify Release
```bash
# Check GitHub Actions for successful release
# Install and test the alpha version
npm install @llevintza/fastify-prometheus-metrics@alpha
```

#### 5. Continue Development
```bash
# Make more changes
git add .
git commit -m "feat: improve histogram bucket validation"
git push  # This creates alpha.2, alpha.3, etc.
```

### Alpha Release Examples

```bash
# Example: Adding new metrics
git checkout -b feature/custom-metrics
git commit -m "feat: add support for custom gauge metrics"
git push -u origin feature/custom-metrics
# Result: 1.0.0-alpha.9

# Example: Bug fix in feature
git commit -m "fix: resolve validation error in custom metrics"
git push
# Result: 1.0.0-alpha.10
```

## RC Releases

RC (Release Candidate) releases are for **pre-beta testing and validation**. They represent more stable code than alpha but less tested than beta.

### When to Use RC Releases
- ✅ Pre-beta validation
- ✅ Integration testing
- ✅ Feature freeze testing
- ❌ Production use
- ❌ Final user testing

### Step-by-Step Process

#### 1. Switch to RC Branch
```bash
git checkout release/v0.0.1
git pull origin release/v0.0.1
```

#### 2. Merge Features
```bash
# Option A: Merge a specific feature
git merge feature/your-feature-name

# Option B: Merge multiple features from main
git merge main

# Option C: Cherry-pick specific commits
git cherry-pick <commit-hash>
```

#### 3. Push to Trigger RC Release
```bash
git push origin release/v0.0.1
```

#### 4. Test RC Release
```bash
npm install @llevintza/fastify-prometheus-metrics@rc
```

### RC Release Examples

```bash
# Example: Preparing features for beta testing
git checkout release/v0.0.1
git merge feature/custom-metrics
git merge feature/performance-improvement
git push origin release/v0.0.1
# Result: 1.0.0-rc.1

# Example: Fix found during RC testing
git commit -m "fix: resolve integration issue found in RC testing"
git push origin release/v0.0.1
# Result: 1.0.0-rc.2
```

## Beta Releases

Beta releases are **release candidates** ready for broader testing. They should be feature-complete and relatively stable.

### When to Use Beta Releases
- ✅ Final feature testing
- ✅ User acceptance testing
- ✅ Production-like testing
- ✅ Performance testing
- ❌ Production use (unless explicitly approved)

### Step-by-Step Process

#### 1. Switch to Beta Branch
```bash
git checkout release/rc_1
git pull origin release/rc_1
```

#### 2. Merge from RC or Main
```bash
# Option A: Promote from RC testing
git merge release/v0.0.1

# Option B: Merge from main
git merge main
```

#### 3. Push to Trigger Beta Release
```bash
git push origin release/rc_1
```

#### 4. Test Beta Release
```bash
npm install @llevintza/fastify-prometheus-metrics@beta
```

### Beta Release Examples

```bash
# Example: Promoting RC to beta
git checkout release/rc_1
git merge release/v0.0.1
git push origin release/rc_1
# Result: 1.0.0-beta.1

# Example: Final bug fix in beta
git commit -m "fix: resolve final issue found in beta testing"
git push origin release/rc_1
# Result: 1.0.0-beta.2
```

## Next Releases

Next releases are for **major version development** with breaking changes. They represent the future major version.

### When to Use Next Releases
- ✅ Breaking changes development
- ✅ Major version planning
- ✅ Future API testing
- ✅ Migration path validation
- ❌ Production use
- ❌ Minor feature development

### Step-by-Step Process

#### 1. Switch to Next Branch
```bash
git checkout next
git pull origin next
```

#### 2. Develop Breaking Changes
```bash
# Make breaking changes
git add .
git commit -m "feat!: redesign plugin configuration API

BREAKING CHANGE: Configuration options have been restructured.
See migration guide for details."
```

#### 3. Push to Trigger Next Release
```bash
git push origin next
```

#### 4. Test Next Release
```bash
npm install @llevintza/fastify-prometheus-metrics@next
```

### Next Release Examples

```bash
# Example: Major API redesign
git checkout next
git commit -m "feat!: redesign metrics collection API

BREAKING CHANGE: Metrics collection methods have been simplified"
git push origin next
# Result: 2.0.0-next.1

# Example: Additional breaking changes
git commit -m "feat!: remove deprecated configuration options"
git push origin next
# Result: 2.0.0-next.2
```

## Stable Releases

Stable releases are **production-ready** versions. They should be thoroughly tested and stable.

### When to Use Stable Releases
- ✅ Production deployment
- ✅ After successful beta testing
- ✅ When features are complete and stable
- ✅ For official releases

### Step-by-Step Process

#### Option 1: Release from Main Branch
```bash
# Merge beta branch to main
git checkout main
git pull origin main
git merge release/rc_1
git push origin main
# Result: 1.0.0
```

#### Option 2: Release from Stable Branch
```bash
git checkout stable
git pull origin stable
git merge main
git push origin stable
# Result: 1.0.0 (stable channel)
```

#### Option 3: Release from Latest Branch
```bash
git checkout latest
git pull origin latest
git merge main
git push origin latest
# Result: 1.0.0 (latest channel)
```

### Stable Release Examples

```bash
# Example: Promoting beta to production
git checkout main
git merge release/rc_1
git push origin main
# Result: 1.0.0

# Example: Next major version to production
git checkout main
git merge next
git push origin main
# Result: 2.0.0
```

## Hotfix Releases

Hotfix releases are for **critical production fixes** that need immediate deployment.

### When to Use Hotfix Releases
- ✅ Critical security vulnerabilities
- ✅ Production-breaking bugs
- ✅ Data corruption issues
- ✅ Performance problems
- ❌ Feature requests
- ❌ Non-critical bugs

### Step-by-Step Process

#### 1. Create Hotfix Branch
```bash
git checkout main
git pull origin main
git checkout -b hotfix/security-vulnerability
```

#### 2. Implement Fix
```bash
# Make the fix
git add .
git commit -m "fix: resolve critical security vulnerability in metrics endpoint"
```

#### 3. Push to Trigger Hotfix Release
```bash
git push -u origin hotfix/security-vulnerability
```

#### 4. Test Hotfix Release
```bash
npm install @llevintza/fastify-prometheus-metrics@hotfix
```

#### 5. Promote to Production
```bash
# After testing, merge to main for immediate production release
git checkout main
git merge hotfix/security-vulnerability
git push origin main
# Result: 1.0.1 (or next patch version)
```

### Hotfix Release Examples

```bash
# Example: Security fix
git checkout -b hotfix/security-fix
git commit -m "fix: sanitize user input in metrics labels"
git push -u origin hotfix/security-fix
# Result: 1.0.0-hotfix.1

# Example: Critical bug fix
git checkout -b hotfix/memory-leak
git commit -m "fix: resolve memory leak in prometheus client"
git push -u origin hotfix/memory-leak
# Result: 1.0.0-hotfix.2
```

## Testing Releases

### Testing Alpha Releases
```bash
# Install alpha version
npm install @llevintza/fastify-prometheus-metrics@alpha

# Test in isolated environment
# Check for basic functionality
# Report issues on GitHub
```

### Testing RC/Beta Releases
```bash
# Install specific release type
npm install @llevintza/fastify-prometheus-metrics@rc
npm install @llevintza/fastify-prometheus-metrics@beta

# Test in production-like environment
# Run full test suite
# Performance testing
# Integration testing
```

### Testing Next Releases
```bash
# Install next version
npm install @llevintza/fastify-prometheus-metrics@next

# Test breaking changes
# Validate migration paths
# Test new APIs
```

## Troubleshooting

### Common Issues

#### Release Not Triggered
**Problem**: Push doesn't trigger release
**Solutions**:
- Check commit message follows conventional format
- Verify branch name matches configuration
- Check GitHub Actions logs for errors
- Ensure CI/CD pipeline passes all checks

#### Wrong Version Generated
**Problem**: Version doesn't match expectations
**Solutions**:
- Review commit message types (`feat:`, `fix:`, `BREAKING CHANGE:`)
- Check if `BREAKING CHANGE:` is in commit footer
- Verify branch configuration in `.releaserc.js`

#### Package Not Found
**Problem**: Cannot install released package
**Solutions**:
- Check GitHub Packages registry configuration
- Verify authentication tokens
- Ensure package was successfully published
- Check package scope and name

#### CI/CD Pipeline Fails
**Problem**: Release pipeline fails
**Solutions**:
- Check build errors in GitHub Actions
- Verify tests pass locally
- Check linting and formatting
- Ensure all dependencies are properly installed

### Getting Help

1. **Check GitHub Actions**: Review the CI/CD pipeline logs
2. **Review Documentation**: Check this guide and BRANCHING_STRATEGY.md
3. **Open Issue**: Create a GitHub issue with detailed information
4. **Contact Maintainers**: Reach out to project maintainers

## Best Practices

1. **Always test pre-releases** before promoting to stable
2. **Use conventional commits** for proper versioning
3. **Keep releases small and focused** when possible
4. **Document breaking changes** thoroughly
5. **Test in production-like environments** before stable release
6. **Monitor releases** after deployment
7. **Have rollback plans** for production releases

---

For more information, see:
- [Branching Strategy](BRANCHING_STRATEGY.md)
- [Development Guide](DEVELOPMENT.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
