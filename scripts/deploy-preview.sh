#!/bin/bash

# Preview deployment script - commit locally and deploy to Netlify preview
set -e  # Exit on any error

echo "🔍 Starting preview deployment (local commit only)..."

# Set deployment message
if [ -n "$1" ]; then
    DEPLOY_MSG="$1"
else
    DEPLOY_MSG="Preview deployment - $(date '+%Y-%m-%d %H:%M')"
fi

echo "📝 Deploy message: $DEPLOY_MSG"

# Build frontend assets
echo "🔨 Building frontend assets..."
npm run build

# Check if there are any changes to commit
if [ -n "$(git status --porcelain)" ]; then
    echo "📦 Staging and committing changes locally..."
    git add .
    git commit -m "$DEPLOY_MSG

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
    echo "✅ Changes committed locally (not pushed to GitHub)"
else
    echo "✅ No changes to commit"
fi

echo "🔍 Deploying to Netlify preview..."
netlify deploy --message "$DEPLOY_MSG"

echo "✅ Preview deployment complete! (GitHub push required separately)"