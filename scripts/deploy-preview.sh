#!/bin/bash

# Deploy to preview with optional message
if [ -n "$1" ]; then
    netlify deploy --message "$1"
else
    netlify deploy --message "Preview deployment - $(date '+%Y-%m-%d %H:%M')"
fi