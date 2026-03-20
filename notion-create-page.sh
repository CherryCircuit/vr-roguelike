#!/bin/bash
# Notion Page Creator for OpenClaw Agents
# Usage: ./notion-create-page.sh "Page Title" "Parent Page ID"
#
# If parent page ID is not provided, will use environment variable NOTION_DEFAULT_PAGE_ID

set -e

# Load credentials
if [ -f ~/.agent/.env ]; then
    source ~/.agent/.env
else
    echo "Error: ~/.agent/.env not found"
    exit 1
fi

# Check for required environment variables
if [ -z "$NOTION_ACCESS_TOKEN" ]; then
    echo "Error: NOTION_ACCESS_TOKEN not found in ~/.agent/.env"
    exit 1
fi

# Parse arguments
PAGE_TITLE="${1:-Untitled Page}"
PARENT_PAGE_ID="${2:-$NOTION_DEFAULT_PAGE_ID}"

if [ -z "$PARENT_PAGE_ID" ]; then
    echo "Error: Parent page ID required (either as second argument or NOTION_DEFAULT_PAGE_ID)"
    exit 1
fi

# Create the page
RESPONSE=$(curl -s -X POST 'https://api.notion.com/v1/pages' \
  -H "Authorization: Bearer $NOTION_ACCESS_TOKEN" \
  -H 'Notion-Version: 2022-06-28' \
  -H 'Content-Type: application/json' \
  --data "{
    \"parent\": {\"page_id\": \"$PARENT_PAGE_ID\"},
    \"properties\": {
      \"title\": {
        \"title\": [{\"text\": {\"content\": \"$PAGE_TITLE\"}}]
      }
    }
  }")

# Extract the page URL from the response
PAGE_URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | sed 's/\\//g')

if [ -n "$PAGE_URL" ]; then
    echo "$PAGE_URL"
else
    echo "Error creating page. Response: $RESPONSE"
    exit 1
fi
