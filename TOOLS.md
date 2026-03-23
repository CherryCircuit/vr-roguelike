# TOOLS.md - DevClaw Tools

All DevClaw tools are registered as OpenClaw plugin tools. Use the tool schemas for parameter details.

## Project-specific overrides

To override tool behavior for a specific project, create prompt files in:
`devclaw/projects/<name>/prompts/<role>.md`

## Image Generation (Z.ai)
- **CLI:** `z-ai-generate "prompt"` (installs: `~/.local/bin/z-ai-generate`)
- **Models:** `glm-image` (flagship, HD ~20s, best for text/posters), `cogview-4-250304` (fast ~5-10s)
- **API:** `POST https://api.z.ai/api/paas/v4/images/generations` with ZAI_API_KEY
- **Sizes:** glm-image: 1280x1280 default, 1568x1056, 1056x1568, 1728x960, 960x1728
- **Sizes:** cogview: 1024x1024 default, 768x1344, 864x1152, 1344x768, 1152x864
- URLs expire after 30 days. Download promptly.

