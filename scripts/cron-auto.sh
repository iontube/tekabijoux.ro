#!/bin/bash
# TekaBijoux auto-generate cron wrapper
# Runs daily: generates 1 article, builds, deploys to Cloudflare

export PATH="/home/luc/.nvm/versions/node/v22.13.1/bin:$PATH"
export CLOUDFLARE_API_TOKEN="QumpSGuuuzdgJlNyryM-KVIdEGtSJNMyALHzwNoG"

PROJECT_DIR="/home/luc/Documents/tekabijoux.ro"
LOG_FILE="$PROJECT_DIR/cron.log"

echo "--- CRON START: $(date) ---" >> "$LOG_FILE"

cd "$PROJECT_DIR" && node scripts/auto-generate.js >> "$LOG_FILE" 2>&1

echo "--- CRON END: $(date) ---" >> "$LOG_FILE"
