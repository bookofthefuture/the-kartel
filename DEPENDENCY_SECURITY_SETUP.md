# Dependency Security Setup

## Overview

This document outlines the comprehensive dependency vulnerability scanning and management system implemented for The Kartel project to ensure all dependencies are secure and up-to-date.

## Security Status

### Current Dependency Security
- ✅ **0 vulnerabilities** found in current dependencies
- ✅ **All critical packages updated** to latest secure versions
- ✅ **Automated scanning** configured for continuous monitoring
- ✅ **Security scripts** integrated into development workflow

## Dependency Updates Completed

### Updated Packages
```json
{
  "@netlify/blobs": "^8.1.0" → "^8.2.0",
  "@vimeo/vimeo": "^2.1.1" → "^2.3.2", 
  "lint-staged": "^15.2.0" → "^15.5.2"
}
```

### Packages Requiring Major Version Updates
These packages have newer major versions available but require careful testing:

1. **@netlify/blobs**: `8.2.0 → 10.0.4`
   - Status: Major version change may include breaking changes
   - Action: Monitor for stability and test before upgrading

2. **@vimeo/vimeo**: `2.3.2 → 3.0.3`
   - Status: Major version change likely includes breaking changes
   - Action: Review changelog before upgrading

3. **Jest**: `29.7.0 → 30.0.4`
   - Status: Major version with potential breaking changes
   - Action: Upgrade during next development cycle

4. **Husky**: `8.0.3 → 9.1.7`
   - Status: Major version with Git hooks changes
   - Action: Test thoroughly before upgrading

5. **lint-staged**: `15.5.2 → 16.1.2`
   - Status: Major version change
   - Action: Review configuration compatibility

## Automated Security Scanning

### 1. GitHub Actions Workflow
**File:** `.github/workflows/security-scan.yml`

**Features:**
- **Scheduled Scans:** Weekly vulnerability scans every Sunday at 2 AM UTC
- **PR Integration:** Automatic security checks on all pull requests
- **npm audit:** Comprehensive dependency vulnerability scanning
- **OSSF Scorecard:** Open Source Security Foundation security scoring
- **Test Validation:** Ensures security updates don't break functionality

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Weekly scheduled runs
- Manual workflow dispatch

### 2. Security Check Script
**File:** `scripts/security-check.sh`

**Comprehensive Security Validation:**
1. **Dependency Vulnerabilities:** `npm audit` with moderate+ level filtering
2. **Outdated Packages:** Detection of packages needing updates
3. **Security Tests:** Full test suite execution
4. **Hardcoded Secrets:** Pattern-based secret detection
5. **CORS Configuration:** Validation of secure CORS implementation
6. **Input Sanitization:** Verification of XSS prevention measures

**Usage:**
```bash
# Run full security check
npm run security:check

# Just check vulnerabilities
npm run security:audit

# Update dependencies and fix vulnerabilities
npm run security:update
```

### 3. Development Integration

**Package.json Scripts:**
```json
{
  "security:check": "./scripts/security-check.sh",
  "security:audit": "npm audit --audit-level=moderate", 
  "security:update": "npm update && npm audit fix"
}
```

## Security Check Components

### 1. Dependency Vulnerability Scanning
```bash
npm audit --audit-level=moderate
```
- Scans for moderate, high, and critical vulnerabilities
- Provides detailed vulnerability reports
- Suggests automatic fixes where available

### 2. Outdated Package Detection
```bash
npm outdated
```
- Lists packages with newer versions available
- Shows current, wanted, and latest versions
- Helps maintain up-to-date dependencies

### 3. Hardcoded Secret Detection
Pattern-based scanning for:
- API keys (`api[_-]?key.*=.*['\"][^'\"]{16,}['\"]`)
- Passwords (`password.*=.*['\"][^'\"]{8,}['\"]`)
- Secrets (`secret.*=.*['\"][^'\"]{16,}['\"]`)
- Tokens (`token.*=.*['\"][^'\"]{16,}['\"]`)
- Private keys (`private[_-]?key.*=.*['\"][^'\"]{16,}['\"]`)

### 4. CORS Security Validation
- Checks for wildcard CORS headers (`Access-Control-Allow-Origin: *`)
- Verifies secure CORS utility usage
- Ensures domain-based origin validation

### 5. Input Sanitization Verification
- Identifies functions handling user input
- Verifies input sanitization implementation
- Flags potential XSS vulnerabilities

## Security Monitoring

### Continuous Integration
```yaml
# GitHub Actions Security Workflow
name: Security Vulnerability Scan
on:
  push: [main, develop]
  pull_request: [main]
  schedule: [cron: '0 2 * * 0'] # Weekly

jobs:
  dependency-scan:
    - npm audit --audit-level=moderate
    - npm outdated
    - npm test
    
  security-scorecard:
    - OSSF Security Scorecard analysis
    - SARIF security report upload
```

### Local Development
```bash
# Pre-commit security checks
npm run security:check

# Weekly maintenance
npm run security:update
npm run security:check
```

## Vulnerability Response Process

### 1. Automatic Detection
- GitHub Actions notify of vulnerabilities
- Security script alerts during development
- Weekly scans catch new vulnerabilities

### 2. Assessment
- Review vulnerability severity and impact
- Check if project uses affected functionality
- Determine urgency of fix

### 3. Resolution
```bash
# Attempt automatic fix
npm audit fix

# Manual updates if needed
npm update [package-name]

# Test after updates
npm test
npm run security:check
```

### 4. Verification
- Run full test suite
- Execute security validation script
- Deploy to preview environment for testing

## Security Best Practices

### Dependency Management
1. **Regular Updates:** Weekly dependency updates
2. **Version Pinning:** Use exact versions for critical dependencies
3. **Audit Frequency:** Run `npm audit` before every deployment
4. **Test Coverage:** Ensure security updates don't break functionality

### Development Workflow
1. **Pre-commit Checks:** Security validation before commits
2. **PR Requirements:** Security scans must pass before merge
3. **Dependency Reviews:** Review security implications of new dependencies
4. **Version Planning:** Plan major version upgrades carefully

### Emergency Response
1. **Critical Vulnerabilities:** Immediate assessment and patching
2. **Zero-day Threats:** Rapid dependency updates and testing
3. **Rollback Plans:** Maintain ability to quickly revert updates
4. **Communication:** Alert team of security-related changes

## Tools and Resources

### npm Security Features
- `npm audit`: Built-in vulnerability scanner
- `npm audit fix`: Automatic vulnerability fixing
- `npm update`: Safe dependency updates
- `npm outdated`: Update availability checking

### External Security Tools
- **OSSF Scorecard**: Open Source Security Foundation scoring
- **GitHub Security Advisories**: Vulnerability database
- **Snyk**: Advanced vulnerability scanning (optional)
- **Dependabot**: Automated dependency updates (GitHub)

### Security Information Sources
- [npm Security Advisories](https://www.npmjs.com/advisories)
- [GitHub Security Lab](https://securitylab.github.com/)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [NIST National Vulnerability Database](https://nvd.nist.gov/)

## Maintenance Schedule

### Weekly (Automated)
- Security vulnerability scans
- Dependency update notifications
- Security scorecard updates

### Monthly (Manual)
- Review outdated packages
- Plan major version updates
- Security audit of new dependencies

### Quarterly (Planned)
- Major dependency version upgrades
- Security tooling updates
- Process improvements review

## Configuration Files

### `.github/workflows/security-scan.yml`
GitHub Actions workflow for automated security scanning

### `scripts/security-check.sh`
Comprehensive security validation script

### `package.json`
Security-related npm scripts and dependency management

## Future Enhancements

1. **Snyk Integration**: Advanced vulnerability scanning with Snyk
2. **Dependency Graph**: Visual dependency security analysis
3. **License Scanning**: Open source license compliance checking
4. **SBOM Generation**: Software Bill of Materials for transparency
5. **Supply Chain Security**: Enhanced dependency provenance validation

## Emergency Contacts

For critical security vulnerabilities:
1. Run immediate security assessment
2. Apply patches if available
3. Consider temporary service restrictions
4. Document and communicate changes
5. Monitor for successful resolution

---

**Last Updated:** January 2025  
**Next Review:** Quarterly dependency security review