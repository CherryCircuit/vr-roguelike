# SHARED-KNOWLEDGE.md - Facts All Agents Should Know

Cross-agent reference for verified facts that affect how all agents operate. Update when confirmed.

---

## Z.ai Coding Pro Plan

Graeme subscribes to GLM Coding Pro (auto-renewed before Feb 12, 2026 cutoff = unlimited weekly usage forever).

### What's Included (free, from plan)

| Category | Details |
|----------|---------|
| Text models | GLM-5.1, GLM-5-Turbo, GLM-5 (Pro+), GLM-4.7, GLM-4.6, GLM-4.5-Air |
| Vision MCP | 5-hour/month prompt resource pool (8 tools via `zai-vision`) |
| Web search/reader/zread | 1,000 combined calls per billing cycle |
| Weekly usage | Unlimited (early subscriber benefit) |

### What's NOT Included

| Category | Details |
|----------|---------|
| Image generation (GLM-Image, CogView-4) | Requires separate pay-as-you-go balance |
| Video generation (CogVideoX-3, Vidu models) | Requires separate pay-as-you-go balance |
| GLM-4-Plus | Separate resource package, returns "insufficient balance" |

### Quota Behavior

- Model quotas are NOT unified. Each model family has its own resource package.
- GLM-5.1, GLM-5-Turbo, GLM-5 consume at 3x during peak hours (14:00-18:00 UTC+8), 2x off-peak.
- Until end of April 2026: GLM-5.1 and GLM-5-Turbo count as 1x during off-peak (temporary promo).
- OpenClaw tasks run under secondary scheduling (best-effort). Coding scenarios get priority.
- High load triggers fair-use: dynamic queuing and rate limiting.

### Model Aliases (OpenClaw)

| Alias | Model |
|-------|-------|
| GLM-5-Turbo | zai/glm-5-turbo |
| GLM-5 | zai/glm-5 |
| GLM-5.1 | zai/glm-5.1 |
| GLM-4.7 | zai/glm-4.7 |
| Flash | zai/glm-4.7-flash |
| FlashX | zai/glm-4.7-flashx |

---

## Z.ai API Endpoints

| Endpoint | Auth | Notes |
|----------|------|-------|
| `api.z.ai/api/coding/paas/v4/` | ZAI_API_KEY | Coding Plan (text models, web reader) |
| `api.z.ai/api/paas/v4/` | ZAI_API_KEY | General API (requires pay-as-you-go balance) |
| MCP servers | Bearer in mcporter config | Vision, web search, web reader, zread |

---

## Known Z.ai Issues

- **Web search MCP server (zai-web-search):** Returns empty results. Server-side bug with Accept header handling and session init. Not our config. Workaround: use Perplexity via OpenClaw `web_search`.
- **Web search REST API:** Returns "Unknown Model" errors regardless of parameters. REST API not the right path for search.
- **Image/video generation REST API:** "Insufficient balance" on both general and coding endpoints. Coding Plan doesn't include these.
