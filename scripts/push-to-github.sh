#!/bin/bash

# Push committed changes to GitHub
set -e  # Exit on any error

echo "📤 Pushing committed changes to GitHub..."

# Check if there are any commits to push
if [ $(git rev-list --count HEAD ^origin/main 2>/dev/null || echo 0) -eq 0 ]; then
    echo "✅ No new commits to push"
    exit 0
fi

# Show what will be pushed
echo "📊 Commits to be pushed:"
git log --oneline origin/main..HEAD

# Confirm before pushing
echo ""
read -p "Continue with push to GitHub? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Push cancelled"
    exit 1
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push

echo "✅ Successfully pushed to GitHub!"