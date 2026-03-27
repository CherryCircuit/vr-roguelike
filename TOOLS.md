# TOOLS.md — Default Workspace

## Image Generation (Z.ai)
- **CLI:** `z-ai-generate "prompt"` (installs: `~/.local/bin/z-ai-generate`)
- **Models:** `glm-image` (flagship, HD ~20s, best for text/posters), `cogview-4-250304` (fast ~5-10s)
- **API:** `POST https://api.z.ai/api/paas/v4/images/generations` with ZAI_API_KEY
- **Sizes:** glm-image: 1280x1280 default, 1568x1056, 1056x1568, 1728x960, 960x1728
- **Sizes:** cogview: 1024x1024 default, 768x1344, 864x1152, 1344x768, 1152x864
- URLs expire after 30 days. Download promptly.

## MCP Tools (via mcporter CLI)

Z.ai MCP servers available for specialized tasks. Call via `mcporter call server.tool`:

| Server | Tools | When to use |
|--------|-------|-------------|
| `zai-vision` | analyze_video, ui_to_artifact, diagnose_error_screenshot, understand_technical_diagram, analyze_data_visualization, ui_diff_check, extract_text_from_screenshot, analyze_image | Video analysis, UI-to-code, diagram understanding, data viz extraction. Use native `image` tool for general image analysis instead. |
| `zai-web-reader` | webReader | Deeper web content extraction than `web_fetch`. Renders JS-heavy pages. |
| `zai-web-search` | web_search_prime | Currently returning empty results. Under investigation. |

Examples:
```bash
mcporter call zai-vision.analyze_video video_source="/path/to/video.mp4" prompt="Describe what happens"
mcporter call zai-vision.ui_to_artifact image_source="/path/to/screenshot.png" output_type="code" prompt="Recreate this UI"
mcporter call zai-web-reader.webReader url="https://example.com" return_format="markdown"
```
