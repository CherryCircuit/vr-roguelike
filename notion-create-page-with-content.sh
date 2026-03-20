#!/bin/bash
# Notion Page Creator with Content for OpenClaw Agents
# Usage: ./notion-create-page-with-content.sh "Page Title" "Markdown File"
# If markdown file is not provided, creates empty page with title only

set -e

# Load credentials
if [ ! -f ~/.agent/.env ]; then
    echo "Error: ~/.agent/.env not found"
    exit 1
fi

source ~/.agent/.env

# Check for required environment variables
if [ -z "$NOTION_ACCESS_TOKEN" ]; then
    echo "Error: NOTION_ACCESS_TOKEN not found in ~/.agent/.env"
    exit 1
fi

if [ -z "$NOTION_DEFAULT_PAGE_ID" ]; then
    echo "Error: NOTION_DEFAULT_PAGE_ID not found in ~/.agent/.env"
    exit 1
fi

# Parse arguments
PAGE_TITLE="${1:-Untitled Page}"
MARKDOWN_FILE="${2}"

# If markdown file provided, use it as content
if [ -n "$MARKDOWN_FILE" ] && [ -f "$MARKDOWN_FILE" ]; then
    if [ ! -f "$MARKDOWN_FILE" ]; then
        echo "Error: Markdown file not found: $MARKDOWN_FILE"
        exit 1
    fi

    # Read markdown content
    MARKDOWN_CONTENT=$(cat "$MARKDOWN_FILE")

    # Create page with content using blocks
    RESPONSE=$(curl -s -X POST 'https://api.notion.com/v1/pages' \
        -H "Authorization: Bearer $NOTION_ACCESS_TOKEN" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json" \
        --data "{
    \"parent\": {\"page_id\": \"$NOTION_DEFAULT_PAGE_ID\"},
    \"properties\": {
      \"title\": {
        \"title\": [{\"text\": {\"content\": \"$PAGE_TITLE\"}}]
      },
      \"Name\": {
        \"title\": [{\"text\": {\"content\": \"$PAGE_TITLE\"}}]
      }
    },
    \"children\": [
      {
        \"object\": \"block\",
        \"type\": \"toggle\",
        \"toggle\": {
          \"checked\": true,
          \"color\": \"default\",
          \"text\": {
            \"content\": \"Content\"
          }
        },
        \"children\": [
          {
            \"object\": \"block\",
            \"type\": \"paragraph\",
            \"paragraph\": {
              \"rich_text\": [
                {
                  \"type\": \"text\",
                  \"text\": {
                    \"content\": \"$MARKDOWN_CONTENT\"
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }")
else
    # Create page with title only (original behavior)
    RESPONSE=$(curl -s -X POST 'https://api.notion.com/v1/pages' \
        -H "Authorization: Bearer $NOTION_ACCESS_TOKEN" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json" \
        --data "{
    \"parent\": {\"page_id\": \"$NOTION_DEFAULT_PAGE_ID\"},
    \"properties\": {
      \"title\": {
        \"title\": [{\"text\": {\"content\": \"$PAGE_TITLE\"}}]
      }
    }
  }")
fi

# Extract page URL from response
PAGE_URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | sed 's/\\//g')

if [ -n "$PAGE_URL" ]; then
    echo "$PAGE_URL"
else
    echo "Error creating page. Response: $RESPONSE"
    exit 1
fi
