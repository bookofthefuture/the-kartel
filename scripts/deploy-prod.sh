#!/bin/bash

# Production deployment script - commits and pushes to GitHub (deployment happens automatically via GitHub)
set -e  # Exit on any error

echo "🚀 Starting production deployment via GitHub..."

# Set deployment message
if [ -n "$1" ]; then
    DEPLOY_MSG="$1"
else
    DEPLOY_MSG="Production deployment - $(date '+%Y-%m-%d %H:%M')"
fi

echo "📝 Deploy message: $DEPLOY_MSG"

# Run tests
echo "🧪 Running tests..."
npm run test

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
    
    echo "📤 Pushing to GitHub for automatic deployment..."
    git push
    echo "✅ Changes pushed to GitHub - production deployment will happen automatically"
else
    echo "📤 Pushing to GitHub for production deployment..."
    git push
    echo "✅ Pushed to GitHub - production deployment will happen automatically"
fi

echo "🌐 Production deployment initiated via GitHub integration"
echo "🔗 Monitor deployment status at: https://app.netlify.com/sites/effortless-crumble-9e3c92/deploys"