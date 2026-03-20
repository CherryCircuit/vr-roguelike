# Project Overrides

This directory holds project-specific configuration that overrides the workspace defaults.

## Prompt Overrides

To override default worker instructions, create `prompts/<role>.md`:

Available roles: developer, tester, architect, reviewer

Example: `prompts/developer.md` overrides the default developer instructions for this project only.
Files here take priority over the workspace defaults in `devclaw/prompts/`.

## Workflow Overrides

To override the default workflow configuration, create `workflow.yaml` in this directory.

Only include the keys you want to override — everything else inherits from the workspace-level `devclaw/workflow.yaml`. The three-layer system is:

1. **Built-in defaults** (code)
2. **Workspace** — `devclaw/workflow.yaml`
3. **Project** — `devclaw/projects/vr-roguelike/workflow.yaml` (this directory)

Example — use a different review policy for this project:

```yaml
workflow:
  reviewPolicy: agent
```

Example — override model for senior developer:

```yaml
roles:
  developer:
    models:
      senior: claude-sonnet-4-5-20250514
```

Call `workflow_guide` for the full config reference.
