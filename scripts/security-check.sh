#!/bin/bash

# Local Security Analysis Script
# This script helps you understand and debug yarn audit findings locally

echo "🔒 Local Security Analysis"
echo "========================="
echo ""

# Run yarn audit and save to file
echo "📋 Running yarn audit..."
yarn audit --json > audit-report.json 2>/dev/null || echo "Audit completed (exit code is normal)"

if [ -f "audit-report.json" ]; then
    vulnerabilities=$(wc -l < audit-report.json 2>/dev/null || echo "0")
    echo "Found $vulnerabilities vulnerability entries"
    echo ""
    
    if [ "$vulnerabilities" -gt "0" ]; then
        echo "🚨 DETAILED VULNERABILITY ANALYSIS"
        echo "=================================="
        echo ""
        
        counter=1
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                echo "🔍 Vulnerability #$counter"
                echo "------------------------"
                
                # Extract information using jq
                package=$(echo "$line" | jq -r '.value // "Unknown"' 2>/dev/null)
                issue=$(echo "$line" | jq -r '.children.Issue // "Unknown issue"' 2>/dev/null)
                severity=$(echo "$line" | jq -r '.children.Severity // "Unknown"' 2>/dev/null)
                version=$(echo "$line" | jq -r '.children["Vulnerable Versions"] // "Unknown"' 2>/dev/null)
                dependents=$(echo "$line" | jq -r '.children.Dependents[]? // "Unknown"' 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
                
                echo "📦 Package: $package"
                echo "🚨 Severity: $severity"
                echo "🔢 Vulnerable Version: $version"
                echo "📋 Used by: $dependents"
                echo "📄 Issue Description:"
                echo "   $issue"
                echo ""
                
                # Provide specific remediation advice
                case "$package" in
                    "glob")
                        echo "💡 REMEDIATION for $package:"
                        echo "   - This is used by Jest (testing framework)"
                        echo "   - Try: yarn add -D jest@latest"
                        echo "   - Or wait for Jest to update their glob dependency"
                        ;;
                    "inflight")
                        echo "💡 REMEDIATION for $package:"
                        echo "   - This is a transitive dependency of glob"
                        echo "   - Will be fixed when glob is updated to v9+"
                        echo "   - Consider using newer alternatives if you use glob directly"
                        ;;
                    "read-pkg-up")
                        echo "💡 REMEDIATION for $package:"
                        echo "   - Used by semantic-release"
                        echo "   - Try: yarn add -D semantic-release@latest"
                        echo "   - The package was renamed to 'read-package-up'"
                        ;;
                    *)
                        echo "💡 REMEDIATION for $package:"
                        echo "   - Check who uses this: yarn why $package"
                        echo "   - Try updating the parent package"
                        echo "   - Consider finding alternatives if severity is high"
                        ;;
                esac
                echo ""
                echo "🔍 To trace this dependency:"
                echo "   yarn why $package"
                echo ""
                echo "================================================"
                echo ""
                
                counter=$((counter + 1))
            fi
        done < audit-report.json
        
        echo "🛠️  GENERAL RECOMMENDATIONS:"
        echo "============================"
        echo "1. Update all packages: yarn upgrade"
        echo "2. Update specific packages: yarn add package@latest"
        echo "3. For dev dependencies: yarn add -D package@latest"
        echo "4. Check dependency tree: yarn why <package-name>"
        echo "5. View outdated packages: yarn outdated"
        echo ""
        echo "🔄 Quick fixes you can try:"
        echo "yarn add -D jest@latest semantic-release@latest"
        echo ""
        
    else
        echo "✅ No vulnerabilities found!"
    fi
else
    echo "❌ No audit report generated"
fi

# Clean up
rm -f audit-report.json

echo "Script completed. Run this anytime to check for security issues locally."
