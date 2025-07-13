#!/bin/bash

# Security Check Script
# This script performs comprehensive security checks on the project

set -e

echo "🔒 Running Security Checks for The Kartel"
echo "========================================"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed or not in PATH"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Run this script from the project root."
    exit 1
fi

echo ""
echo "1. 📦 Checking for dependency vulnerabilities..."
echo "------------------------------------------------"

# Run npm audit
if npm audit --audit-level=moderate; then
    echo "✅ No moderate or higher vulnerabilities found"
else
    echo "⚠️ Vulnerabilities detected. Run 'npm audit fix' to attempt automatic fixes."
    VULN_EXIT_CODE=$?
fi

echo ""
echo "2. 📋 Checking for outdated packages..."
echo "---------------------------------------"

# Check for outdated packages
echo "Current package status:"
npm outdated || echo "✅ All packages are up to date"

echo ""
echo "3. 🧪 Running security-focused tests..."
echo "---------------------------------------"

# Run tests
if npm test; then
    echo "✅ All tests passed"
else
    echo "❌ Tests failed - security implementation may be broken"
    exit 1
fi

echo ""
echo "4. 🔍 Checking for common security issues..."
echo "--------------------------------------------"

# Check for hardcoded secrets (basic patterns)
echo "Scanning for potential hardcoded secrets..."

SECRET_PATTERNS=(
    "password.*=.*['\"][^'\"]{8,}['\"]"
    "api[_-]?key.*=.*['\"][^'\"]{16,}['\"]"
    "secret.*=.*['\"][^'\"]{16,}['\"]"
    "token.*=.*['\"][^'\"]{16,}['\"]"
    "private[_-]?key.*=.*['\"][^'\"]{16,}['\"]"
)

SECRETS_FOUND=false
for pattern in "${SECRET_PATTERNS[@]}"; do
    if find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" | xargs grep -l -i -E "$pattern" 2>/dev/null; then
        echo "⚠️ Potential hardcoded secret found matching pattern: $pattern"
        SECRETS_FOUND=true
    fi
done

if [ "$SECRETS_FOUND" = false ]; then
    echo "✅ No obvious hardcoded secrets detected"
fi

echo ""
echo "5. 🔒 Checking CORS configuration..."
echo "------------------------------------"

# Check for wildcard CORS
if grep -r "Access-Control-Allow-Origin.*\*" netlify/functions/ 2>/dev/null; then
    echo "⚠️ Wildcard CORS headers found - should use secure CORS utils"
else
    echo "✅ No wildcard CORS headers found"
fi

echo ""
echo "6. 🛡️ Checking input sanitization..."
echo "------------------------------------"

# Check if functions are using input sanitization
UNSANITIZED_FUNCTIONS=()
for func in netlify/functions/*.js; do
    if [ -f "$func" ] && grep -q "JSON.parse(event.body)" "$func" && ! grep -q "input-sanitization" "$func" && ! grep -q "cors-utils" "$func"; then
        # Skip utility files and functions that might not need user input sanitization
        basename_func=$(basename "$func")
        if [[ ! "$basename_func" =~ ^(cors-utils|input-sanitization|jwt-auth|password-utils|timing-safe-utils)\.js$ ]]; then
            UNSANITIZED_FUNCTIONS+=("$basename_func")
        fi
    fi
done

if [ ${#UNSANITIZED_FUNCTIONS[@]} -eq 0 ]; then
    echo "✅ All functions with user input use sanitization"
else
    echo "⚠️ Functions without input sanitization:"
    for func in "${UNSANITIZED_FUNCTIONS[@]}"; do
        echo "  - $func"
    done
fi

echo ""
echo "📊 Security Check Summary"
echo "========================"

OVERALL_STATUS="✅ PASSED"

if [ ${VULN_EXIT_CODE:-0} -ne 0 ]; then
    echo "❌ Dependency vulnerabilities detected"
    OVERALL_STATUS="⚠️ WARNINGS"
fi

if [ "$SECRETS_FOUND" = true ]; then
    echo "⚠️ Potential hardcoded secrets detected"
    OVERALL_STATUS="⚠️ WARNINGS"
fi

if [ ${#UNSANITIZED_FUNCTIONS[@]} -gt 0 ]; then
    echo "⚠️ Functions without input sanitization found"
    OVERALL_STATUS="⚠️ WARNINGS"
fi

echo ""
echo "Overall Status: $OVERALL_STATUS"

if [ "$OVERALL_STATUS" = "⚠️ WARNINGS" ]; then
    echo ""
    echo "🔧 Recommended Actions:"
    echo "- Run 'npm audit fix' to fix dependency vulnerabilities"
    echo "- Review flagged files for hardcoded secrets"
    echo "- Add input sanitization to flagged functions"
    echo "- Consider implementing additional security measures"
fi

echo ""
echo "🔒 Security check complete!"

# Exit with warning code if issues found
if [ "$OVERALL_STATUS" = "⚠️ WARNINGS" ]; then
    exit 2
fi