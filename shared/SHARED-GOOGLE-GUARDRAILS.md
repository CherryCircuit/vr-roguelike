# SHARED-GOOGLE-GUARDRAILS.md - Google Workspace Access Rules

All agents MUST follow these rules when using gog CLI for Google Workspace operations.
No exceptions. When in doubt, ask Graeme.

## General Rules

- No bulk operations (>3 items) without Graeme's explicit approval
- Always use `--account` flag to specify which Google account to act on
- Always use `--json` for scripting and `--no-input` for non-interactive mode
- Never expose Google credentials, tokens, or refresh tokens in chat/messages/logs
- Credential files live in `~/.config/gog/*.json` (local only, never shared)

## Gmail

| Action | Rule |
|--------|------|
| Search/read emails | ✅ Freely allowed |
| Send email | ❌ REQUIRES explicit approval ("send it", "yes go ahead") |
| Reply to email | ❌ REQUIRES explicit approval (same as send) |
| Create draft | ✅ Freely allowed (drafts are not delivered) |
| Send draft | ❌ REQUIRES explicit approval |
| Delete email | ❌ REQUIRES explicit confirmation |
| Archive email | ❌ REQUIRES explicit confirmation |
| Modify labels/filters | ❌ REQUIRES explicit confirmation |
| Modify settings | ❌ NEVER without explicit approval |

## Calendar

| Action | Rule |
|--------|------|
| List/read events | ✅ Freely allowed |
| Check free/busy | ✅ Freely allowed |
| Create event | ❌ REQUIRES approval (confirm date, time, details before creating) |
| Update event | ❌ REQUIRES approval |
| Delete event | ❌ NEVER |
| Respond to invites | ❌ REQUIRES approval (confirm acceptance/decline before responding) |

## Drive

| Action | Rule |
|--------|------|
| Search/list files | ✅ Freely allowed |
| Read/download files | ✅ Freely allowed |
| Upload files | ❌ REQUIRES approval |
| Delete files | ❌ NEVER |
| Modify permissions | ❌ NEVER without explicit approval |

## Sheets

| Action | Rule |
|--------|------|
| Read cells/metadata | ✅ Freely allowed |
| Write/update cells | ❌ REQUIRES approval |
| Append rows | ❌ REQUIRES approval |
| Clear data | ❌ REQUIRES approval |
| Create new spreadsheet | ❌ REQUIRES approval |

## Docs / Slides

| Action | Rule |
|--------|------|
| Read/export content | ✅ Freely allowed |
| Edit content | ❌ REQUIRES approval |
| Create new doc | ❌ REQUIRES approval |

## Contacts

| Action | Rule |
|--------|------|
| Search/list contacts | ✅ Freely allowed |
| Create contact | ❌ REQUIRES approval |
| Modify contact | ❌ REQUIRES approval |
| Delete contact | ❌ NEVER |

## Tasks

| Action | Rule |
|--------|------|
| List/read tasks | ✅ Freely allowed |
| Create task | ❌ REQUIRES approval |
| Update/complete task | ❌ REQUIRES approval |
| Delete task | ❌ REQUIRES approval |

## Account Mapping

| Account | Email | Credential File |
|---------|-------|-----------------|
| Personal | gfindlay1@gmail.com | gfindlay1.json |
| Business | graeme.symmetry.media@gmail.com | graeme_symmetry_media.json |
| Gaming | cherries0ntopgaming@gmail.com | cherries0ntopgaming.json |
| Alias | rob.weizner@gmail.com | rob_weizner.json |
| (not yet set up) | scienceprojectband@gmail.com | - |
| (not yet set up) | fungamingforkids@gmail.com | - |

## Approval Pattern

When an action requires approval, follow this pattern:
1. Show Graeme exactly what will happen (full details)
2. Wait for explicit "yes", "go ahead", "do it", "send it", etc.
3. Execute only after approval
4. Confirm completion

## Cron Job Rules

Cron jobs that use gog should:
- Only use READ operations (search, list, check)
- Never send emails or create events automatically
- Report findings but never take destructive action
