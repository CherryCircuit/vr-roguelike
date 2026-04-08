# MCP Tools (Z.ai Coding Plan)

These MCP servers are available to all agents via `mcporter`. All are included in the GLM Coding Pro plan at no extra cost. Prefer these tools over paid alternatives when they fit the task.

**Quota:** 1,000 combined web searches + web readers + zread calls per billing cycle. Vision has a separate 5-hour/month prompt resource pool. Effectively unlimited for normal use.

**Server config:** `~/.mcporter/mcporter.json` (primary), `~/.openclaw/workspace-serena/config/mcporter.json` (zread override)

---

## zai-vision (Local stdio server)

8 specialized tools for image and video understanding. Uses local file paths or remote URLs. For remote URLs, download first if the server times out.

| Tool | Use For |
|------|---------|
| `analyze_image` | General-purpose image analysis (fallback for anything not covered below) |
| `extract_text_from_screenshot` | OCR: extract text from screenshots, code, terminal output |
| `diagnose_error_screenshot` | Analyze error messages, stack traces, exception screenshots |
| `understand_technical_diagram` | Architecture diagrams, flowcharts, UML, ER diagrams |
| `analyze_data_visualization` | Charts, graphs, dashboards, data trends |
| `ui_to_artifact` | Convert UI screenshots to code, prompts, specs, or descriptions |
| `ui_diff_check` | Compare two UI screenshots for visual differences |
| `analyze_video` | Video content analysis (MP4, MOV, M4V, max 8MB) |

**Usage:** `mcporter call zai-vision.analyze_image 'image_source=/path/to/file.jpg' 'prompt=Describe this image'`

**Tips:**
- Use local file paths for reliability. Remote URLs can timeout on slow downloads.
- Video analysis supports MP4, MOV, M4V up to 8MB.
- Package: `@z_ai/mcp-server@0.1.3`

---

## zai-web-reader (HTTP server)

Fetches and converts URLs to markdown/text. Great for reading web pages, articles, docs.

| Tool | Parameters | Notes |
|------|-----------|-------|
| `webReader` | `url` (required), `timeout` (default 20s), `return_format` (markdown/text), `retain_images` (default true) | Returns title, URL, content, metadata |

**Usage:** `mcporter call zai-web-reader.webReader 'url=https://example.com'`

**Tips:**
- Prefer `return_format=markdown` for structured content.
- Set `retain_images=false` for faster responses on text-heavy pages.
- Uses Coding Plan quota (counts toward 1,000/month combined).

---

## zai-web-search (HTTP server) ⚠️

Web search returning titles, URLs, and summaries.

| Tool | Parameters | Notes |
|------|-----------|-------|
| `web_search_prime` | `search_query` (required, max 70 chars), `location` (cn/us), `search_recency_filter` (oneDay/oneWeek/oneMonth/oneYear/noLimit), `content_size` (medium/high), `search_domain_filter` | Search with summaries |

**Status: ❌ BROKEN** as of Apr 7, 2026
- Returns empty `[]` results via mcporter
- Direct API calls fail with server-side errors (Accept header mismatch, session init issues)
- Z.ai MCP server bug, not our config
- **Workaround:** Use OpenClaw's built-in `web_search` tool (Perplexity via OpenRouter, ~$15/month) or `web_fetch` for known URLs
- CLI wrapper exists at `~/.local/bin/z-ai-search` but also affected by the same bug

---

## zread (HTTP server)

GitHub repository explorer. Search docs, browse structure, read files from any public repo.

| Tool | Parameters | Notes |
|------|-----------|-------|
| `search_doc` | `repo_name` (owner/repo), `query`, `language` (zh/en) | Search docs, issues, commits |
| `get_repo_structure` | `repo_name`, `dir_path` (default root) | Directory tree (3 levels deep) |
| `read_file` | `repo_name`, `file_path` | Full file content |

**Usage:** `mcporter call zread.get_repo_structure 'repo_name=vercel/next.js'`

**Tips:**
- Great for researching open source libraries before adopting them.
- Combine `get_repo_structure` + `read_file` for deep source code analysis.
- `search_doc` can find relevant issues and PRs too.
- Uses Coding Plan quota (counts toward 1,000/month combined).

---

## Preference: Use These First

When a task can be done with these MCP tools, prefer them over paid alternatives:
- **Reading web content:** zai-web-reader (free) over Perplexity web search (paid)
- **Exploring GitHub repos:** zread (free) over manual web browsing
- **Image analysis:** zai-vision MCP tools or OpenClaw `image` tool (both free)
- **Web search:** Perplexity is still the working option until zai-web-search is fixed

---

## Testing Log

| Date | Server | Result |
|------|--------|--------|
| Apr 7, 2026 | zai-vision | ✅ Works (local files), timeout on slow remote URLs |
| Apr 7, 2026 | zai-web-reader | ✅ Works, tested on example.com |
| Apr 7, 2026 | zai-web-search | ❌ Returns [], server-side bug |
| Apr 7, 2026 | zread | ✅ Works, tested repo structure on vercel/next.js |
