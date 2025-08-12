# Dependabot Automation Guide

This repository includes several automated workflows for reviewing and approving Dependabot PRs. Here's what each workflow does and how to configure them.

## Available Workflows

### 1. Auto-Approve Dependabot PRs (`auto-approve-dependabot.yml`)

**Purpose**: Automatically reviews and approves dependabot PRs when all checks pass.

**Features**:
- ✅ Auto-approves patch and minor version updates
- ✅ Auto-merges patch updates only (safer)
- ✅ Waits for all CI/CD, security, and code quality checks
- ✅ Adds manual review comments for major updates
- ✅ Basic security vulnerability checking

**Triggers**: When dependabot opens, updates, or reopens a PR

### 2. Enhanced Dependabot Auto-Review (`enhanced-dependabot-review.yml`)

**Purpose**: Advanced automated review with detailed security analysis and risk assessment.

**Features**:
- 🔍 Detailed security vulnerability scanning
- 🎯 Risk assessment based on dependency type
- 📊 Comprehensive reporting in PR comments
- 🚦 Smart approval logic based on risk level
- 🔐 Blocks approval if critical/high severity vulnerabilities found

**Triggers**: When dependabot opens, updates, or reopens a PR

### 3. Simple Dependabot Auto-Merge (`simple-dependabot-merge.yml`)

**Purpose**: Lightweight auto-merge for patch and minor updates.

**Features**:
- ⚡ Fast and simple
- 🔄 Auto-approves and merges patch/minor updates
- 🎛️ Uses GitHub's auto-merge feature

**Triggers**: When dependabot creates or updates a PR

## Recommended Configuration

**For most projects**: Use the **Enhanced Dependabot Auto-Review** workflow as it provides the best balance of automation and safety.

**For simpler projects**: Use the **Auto-Approve Dependabot PRs** workflow.

**For maximum automation**: Use the **Simple Dependabot Auto-Merge** workflow (least safe).

## Security Considerations

### What Gets Auto-Approved
- ✅ Patch updates (`1.0.0` → `1.0.1`)
- ✅ Minor updates (`1.0.0` → `1.1.0`) for low-risk dependencies
- ✅ Updates with no critical/high severity vulnerabilities
- ✅ Updates that pass all CI/CD checks

### What Requires Manual Review
- ❌ Major version updates (`1.0.0` → `2.0.0`)
- ❌ Updates with critical or high severity vulnerabilities
- ❌ High-risk dependencies (core frameworks, security-related packages)
- ❌ Updates that fail CI/CD checks

### High-Risk Dependencies (Manual Review Required)
- Core web frameworks: `fastify`, `express`, `koa`, `hapi`
- Security-critical packages: `jsonwebtoken`, `passport`, `bcrypt`
- Utility libraries with wide impact: `lodash`, `axios`, `moment`

## Configuration Options

### Customizing Auto-Approval Rules

Edit the workflow files to customize:

1. **Update types to auto-approve**:
   ```yaml
   if: |
     steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
     steps.metadata.outputs.update-type == 'version-update:semver-minor'
   ```

2. **High-risk dependencies list**:
   ```yaml
   high_risk_deps="fastify|express|koa|hapi|lodash|moment|axios|request"
   ```

3. **Security vulnerability thresholds**:
   ```yaml
   if [ "$critical_count" -eq 0 ] && [ "$high_count" -eq 0 ]; then
   ```

### Repository Settings Required

1. **Enable auto-merge** in repository settings
2. **Require status checks** before merging
3. **Require up-to-date branches** before merging
4. **Enable dependabot security updates**

### Branch Protection Rules

Recommended branch protection for `main`:
- Require pull request reviews before merging
- Require status checks to pass before merging
- Required status checks:
  - `CI/CD`
  - `Security Analysis`
  - `Code Quality`
- Require branches to be up to date before merging
- Include administrators in restrictions

## Monitoring and Notifications

### GitHub Notifications
- You'll receive notifications when PRs are auto-approved
- Manual review requests will mention you
- Failed security checks will be highlighted

### Workflow Logs
Check the Actions tab to see:
- Which PRs were auto-approved
- Security scan results
- Risk assessment decisions
- Any errors or failures

## Troubleshooting

### Common Issues

1. **Workflow not triggering**:
   - Check that the workflow files are in `.github/workflows/`
   - Verify the GitHub Actions permissions
   - Ensure dependabot is enabled

2. **Auto-approval not working**:
   - Check required status checks are passing
   - Verify the workflow has necessary permissions
   - Review the workflow logs for errors

3. **Security checks failing**:
   - Review the security scan output
   - Check if new vulnerabilities were introduced
   - Update dependencies manually if needed

### Manual Override

To manually approve/merge a dependabot PR that wasn't auto-approved:

1. Review the PR comments for the reason
2. Check the security scan results
3. Run tests locally if needed
4. Approve and merge manually

## Best Practices

1. **Start conservatively**: Begin with patch-only auto-approval
2. **Monitor closely**: Watch the first few auto-approved PRs
3. **Regular reviews**: Periodically review auto-approval decisions
4. **Keep workflows updated**: Update the automation as your needs change
5. **Security first**: Always prioritize security over convenience

## Disabling Automation

To disable any workflow:
1. Rename the file to add `.disabled` extension
2. Or delete the workflow file
3. Or add `if: false` to the job condition
