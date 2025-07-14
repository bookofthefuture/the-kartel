#!/bin/bash

# Preview deployment script with automatic git sync
set -e  # Exit on any error

echo "🔍 Starting preview deployment with git sync..."

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
    echo "📦 Staging and committing changes..."
    git add .
    git commit -m "$DEPLOY_MSG

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
    
    echo "📤 Pushing to GitHub..."
    git push
else
    echo "✅ No changes to commit"
fi

echo "🔍 Deploying to Netlify preview..."
netlify deploy --message "$DEPLOY_MSG"

echo "✅ Preview deployment complete!"