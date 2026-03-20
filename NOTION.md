# Notion API Integration

This document describes how agents can connect to Notion to create nicely formatted documents with images.

## Configuration

**API Endpoint:** https://api.notion.com/v1
**API Version:** 2022-06-28

### Environment Variables (OAuth - Currently Configured)

Store in `~/.agent/.env`:
```
NOTION_ACCESS_TOKEN=your_access_token_here
NOTION_REFRESH_TOKEN=your_refresh_token_here
NOTION_WORKSPACE_ID=your_workspace_id
NOTION_BOT_ID=your_bot_id
NOTION_CLIENT_ID=your_oauth_client_id
NOTION_CLIENT_SECRET=your_oauth_client_secret
NOTION_REDIRECT_URI=https://localhost:8000/callback
```

## OAuth Setup (Already Configured)

The workspace uses OAuth for access. Here's what was set up:

1. **Created OAuth Integration:**
   - Integration name: "OpenClaw Agents"
   - Workspace: Graeme Findlay's Space
   - OAuth credentials configured with redirect to https://localhost:8000/callback

2. **Authorized Access:**
   - Connected integration to specific pages in Notion
   - Agents can create pages anywhere they have access

3. **Token Storage:**
   - Access token stored in `~/.agent/.env`
   - Refresh token available for getting new access tokens when needed

## Default Parent Page

**Main Content Page:** ⚡ Ampy's Ampjack Page
- **Page ID:** `31709ebb-0a8b-8021-a4f9-c914afa5eef9`
- **URL:** https://www.notion.so/Ampy-s-Ampjack-Page-31709ebb0a8b8021a4f9c914afa5eef9

Add this to `~/.agent/.env` as:
```
NOTION_DEFAULT_PAGE_ID=31709ebb-0a8b-8021-a4f9-c914afa5eef9
```

## API Usage

### Load Credentials

```bash
source ~/.agent/.env
```

### Create a Page

```bash
curl -X POST 'https://api.notion.com/v1/pages' \
  -H "Authorization: Bearer $NOTION_ACCESS_TOKEN" \
  -H 'Notion-Version: 2022-06-28' \
  -H 'Content-Type: application/json' \
  --data '{
    "parent": {"page_id": "PARENT_PAGE_ID"},
    "properties": {
      "title": {
        "title": [{"text": {"content": "Page Title"}}]
      }
    },
    "children": [
      {
        "object": "block",
        "type": "heading_1",
        "heading_1": {
          "rich_text": [{"text": {"content": "Section Heading"}}]
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [{"text": {"content": "Your content here"}}]
        }
      }
    ]
  }'
```

### Add Images

```bash
curl -X POST "https://api.notion.com/v1/blocks/PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_ACCESS_TOKEN" \
  -H 'Notion-Version: 2022-06-28' \
  -H 'Content-Type: application/json' \
  --data '{
    "children": [
      {
        "object": "block",
        "type": "image",
        "image": {
          "type": "external",
          "external": {"url": "IMAGE_URL"}
        }
      }
    ]
  }'
```

## Agent Workflow

### Quick Method (Using Helper Script)

The easiest way for agents to create Notion pages:

```bash
# Load credentials
source ~/.agent/.env

# Create a simple page in the default location
/home/graeme/.openclaw/workspace/notion-create-page.sh "Page Title"

# Create a page in a specific parent page
/home/graeme/.openclaw/workspace/notion-create-page.sh "Page Title" "PARENT_PAGE_ID"
```

The script returns the page URL, which you can send to Graeme.

### Advanced Method (Direct API Calls)

When an agent creates content for Graeme:

1. **Create a new page** in Notion with formatted content
2. **Add images** as external image blocks (host images elsewhere, reference by URL)
3. **Return the page URL** to Graeme

### Example: Marketing Brief Page

```json
{
  "parent": {"page_id": "DEFAULT_PAGE_ID"},
  "properties": {
    "title": {
      "title": [{"text": {"content": "Ampjack Campaign Brief - Mar 2026"}}]
    }
  },
  "children": [
    {
      "object": "block",
      "type": "heading_1",
      "heading_1": {"rich_text": [{"text": {"content": "Campaign Overview"}}]}
    },
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [{"text": {"content": "Campaign brief content..."}}]
      }
    },
    {
      "object": "block",
      "type": "callout",
      "callout": {
        "rich_text": [{"text": {"content": "Key insights and notes"}}],
        "color": "blue_background"
      }
    }
  ]
}
```

## Content Formatting Tips

- Use **headings** (`heading_1`, `heading_2`, `heading_3`) for structure
- Use **bulleted lists** (`bulleted_list_item`) for features or benefits
- Use **numbered lists** (`numbered_list_item`) for steps
- Use **callout blocks** for important notes or highlights
- Use **divider blocks** (`divider`) to separate sections
- Use **toggle blocks** (`toggle`) for collapsible content

## Image Hosting

Notion doesn't host images directly via API. Options:
1. Upload images to cloud storage (S3, Cloudinary, Imgur)
2. Use publicly accessible URLs
3. Reference existing images in Notion

## Troubleshooting

**"Integration not found" error:** You need to connect the integration to the parent page using the "Connect to" option in Notion.

**"Unauthorized" error:** Check that your `NOTION_API_KEY` is correct and has no extra spaces.

**"Database not found" error:** The page ID is invalid or you don't have access. Double-check the URL.

---

🌙 This is shared documentation for all agents. Update as needed.
