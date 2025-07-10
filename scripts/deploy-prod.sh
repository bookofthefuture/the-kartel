#!/bin/bash

# Deploy to production with optional message
if [ -n "$1" ]; then
    netlify deploy --prod --message "$1"
else
    netlify deploy --prod --message "Production deployment - $(date '+%Y-%m-%d %H:%M')"
fi