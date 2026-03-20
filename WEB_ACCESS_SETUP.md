# OpenClaw Web Access Configuration

**Date:** February 21, 2026
**Purpose:** Configure OpenClaw for safe outbound web access while keeping the Gateway secure

---

## Security Configuration (Verified)

### Gateway Settings
| Setting | Value | Status |
|---------|-------|--------|
| Bind Address | `loopback` (127.0.0.1) | ✅ Secure |
| Port | 18789 | ✅ Standard |
| Auth Mode | `token` | ✅ Enabled |
| Tailscale | `off` | ✅ No external exposure |
| Public Exposure | None | ✅ Loopback only |

### Network Security
| Check | Status |
|-------|--------|
| Inbound listeners | Only localhost (127.0.0.1:18789) |
| Port forwarding | None configured |
| mDNS/Bonjour | Disabled |
| Firewall changes | None required |

### Outbound Access
| Test | Result |
|------|--------|
| DNS Resolution | ✅ Working (WSL: 10.255.255.254) |
| HTTPS (curl to google.com) | ✅ HTTP 200 |
| Browser automation | ✅ Available via browser tool |

---

## Reports Agent Configuration

### Agent Details
- **Agent ID:** `reports`
- **Workspace:** `~/.openclaw/workspace/reports`
- **Model:** `zai/glm-4.7-flash` (fast, cost-effective for reports)
- **Purpose:** Daily web research and summary reports

### Tool Restrictions
The reports agent has access to:
- `web_search` - Search the web via Brave API
- `web_fetch` - Fetch and extract content from URLs
- `read` - Read local files
- `write` - Write report files to workspace
- `browser` - Browser automation for web access

### Scheduled Tasks
- **Daily Report Job:** Runs at 9:00 AM Vancouver time
- **Output:** Summary delivered to Telegram
- **Focus:** Energy transmission industry - Ampjack, tower raising, corrosion repair
- **Format:** Structured report with "Why read this" relevance sections

### Report Content Focus
1. Transmission tower corrosion failures and maintenance news
2. Utility capacity upgrades (conductor bundling, retrofits vs new builds)
3. EXO and OSMOSE competitor updates
4. Regulatory actions on maintenance failures
5. Data center load growth driving transmission investment

### Competitors Monitored
- EXO (Exo Analytic)
- OSMOSE
- Other tower modification/utility contractors

---

## LinkedIn Reporting Approach

### Compliant Methods (Preferred)
1. **Official LinkedIn API** - If API access is available
2. **Manual exports** - User downloads and provides data
3. **Browser-based review** - Agent assists with organizing manually gathered info

### Avoided Patterns
- ❌ Automated scraping violating ToS
- ❌ Bulk data extraction
- ❌ Rate-limit bypassing

---

## What Was Changed

### 1. Gateway Configuration (No Changes Needed)
The existing configuration was already secure:
- Loopback binding confirmed
- Token auth enabled
- No external exposure

### 2. Created Reports Agent
```bash
openclaw agents add reports \
  --workspace /home/graeme/.openclaw/workspace/reports \
  --model zai/glm-4.7-flash \
  --non-interactive
```

### 3. Scheduled Daily Reports
Configured via OpenClaw cron system for automated daily summaries.

---

## Verification Commands

```bash
# Check gateway status
openclaw gateway status

# Test outbound access
curl -s -o /dev/null -w "%{http_code}" https://www.google.com

# List agents
openclaw agents list

# List scheduled jobs
openclaw cron list

# Check listening ports
ss -tlnp | grep 18789
```

---

## Next Steps

1. [ ] Configure specific report topics/queries
2. [ ] Set preferred delivery time for daily reports
3. [ ] Add any additional data sources beyond web search
4. [ ] Test the full report generation workflow

---

## Notes

- The gateway remains **loopback-only** - no LAN/internet exposure
- Authentication is **always required** to access the gateway
- Outbound web access works through standard WSL networking
- Browser automation is available but runs in isolated context
- All changes documented in this file for audit purposes
