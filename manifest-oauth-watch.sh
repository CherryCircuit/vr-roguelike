#!/bin/bash
# Daily check for Manifest OAuth support

MANIFEST_DIR="$HOME/.openclaw/extensions/manifest"
STATE_FILE="$HOME/.openclaw/data/manifest-oauth-check.txt"
TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN ~/.agent/.env | cut -d'=' -f2)
CHAT_ID="5540671995"

# Get current installed version
INSTALLED=$(cat "$MANIFEST_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | cut -d'"' -f4)
INSTALLED=${INSTALLED:-"unknown"}

# Get latest npm version
LATEST=$(npm view manifest version 2>/dev/null)
LATEST=${LATEST:-"unknown"}

# Check for OAuth in provider-endpoints.js
OAUTH_SUPPORT=$(grep -i "oauth\|subscription" "$MANIFEST_DIR/dist/backend/routing/proxy/provider-endpoints.js" 2>/dev/null | grep -v "anthropic-beta" | wc -l)

# Check last known version
LAST_KNOWN=$(cat "$STATE_FILE" 2>/dev/null || echo "")

# Build message
MESSAGE=""

# Check for version update
if [ "$LATEST" != "unknown" ] && [ "$LATEST" != "$INSTALLED" ]; then
    MESSAGE="🦚 Manifest update available: $INSTALLED → $LATEST"
    
    # Check changelog for OAuth mentions
    CHANGELOG=$(curl -s "https://raw.githubusercontent.com/mnfst/manifest/main/CHANGELOG.md" 2>/dev/null | head -100)
    if echo "$CHANGELOG" | grep -qi "oauth"; then
        MESSAGE="$MESSAGE

✨ CHANGELOG mentions OAuth!"
    fi
fi

# Check for OAuth support in code (even without version change)
if [ "$OAUTH_SUPPORT" -gt 2 ]; then
    MESSAGE="$MESSAGE

🔐 OAuth support detected in provider endpoints!"
fi

# Send notification if there's news
if [ -n "$MESSAGE" ] && [ "$LATEST" != "$LAST_KNOWN" ]; then
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d chat_id="$CHAT_ID" \
        -d text="$MESSAGE" \
        -d parse_mode="HTML" > /dev/null 2>&1
    
    # Update state
    echo "$LATEST" > "$STATE_FILE"
fi
