#!/bin/bash

# restart-dev.sh - Convenient script to restart the Netlify dev server

echo "🔄 Restarting Netlify dev server..."

# Kill any existing netlify dev processes
echo "🛑 Stopping existing processes..."
pkill -f "netlify dev" 2>/dev/null || true
pkill -f "netlify-dev" 2>/dev/null || true

# Wait a moment for processes to fully terminate
sleep 2

# Clear any stuck ports (common Netlify dev ports)
echo "🧹 Clearing stuck ports..."
lsof -ti:8888 | xargs kill -9 2>/dev/null || true
lsof -ti:9999 | xargs kill -9 2>/dev/null || true

# Start the dev server
echo "🚀 Starting Netlify dev server..."
npm run dev