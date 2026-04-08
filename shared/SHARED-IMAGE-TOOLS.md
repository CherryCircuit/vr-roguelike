# Image & Video Analysis, Generation Tools

## Image Analysis (OpenClaw `image` tool)

All agents can analyze images using the built-in `image` tool. Models live under the `zai` provider (coding endpoint, same auth).

**Vision models:**
| Model | Type | Best For |
|-------|------|----------|
| `zai/glm-4.6v` | Primary | General image analysis, screenshots, diagrams |
| `zai/glm-4.6v-flashx` | Fast | Quick analysis, batch processing |
| `zai/glm-4.6v-flash` | Free tier | Low-priority tasks |
| `zai/glm-4.5v` | Fallback | Backup when primary unavailable |
| `zai/glm-ocr` | OCR | Text extraction from documents, spec sheets, screenshots |

**imageModel default:** `zai/glm-4.6v` with fallbacks to glm-4.5v, glm-4.6v-flashx, glm-4.6v-flash.

## Image & Video Generation

**OpenClaw built-in tools** (`image_generate`, `video_generate`):
- Currently configured for OpenAI only (gpt-image-1, sora-2)
- Costs per generation via OpenAI API

**Z.ai image/video generation:** ❌ NOT available on Coding Plan
- GLM-Image, CogView-4, CogVideoX-3, Vidu models all return "Insufficient balance"
- Coding Plan covers text models only; image/video requires separate pay-as-you-go balance
- The concurrency numbers on Z.ai's model page apply to pay-as-you-go users, not Coding Plan subscribers

**Z.ai CLI** (requires pay-as-you-go balance):
- `z-ai-generate "prompt"` (installs: `~/.local/bin/z-ai-generate`)
- Models: `glm-image` (flagship, HD ~20s), `cogview-4-250304` (fast ~5-10s)
- URLs expire after 30 days
