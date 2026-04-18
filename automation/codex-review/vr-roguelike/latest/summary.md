# Nightly review: 1 low-severity issue

- Verdict: **issues found**
- Overall risk: **low**
- Focus areas: correctness, maintainability, performance

One comment-to-code mismatch in `hud.js` may mislead future HUD layout edits and suggests a position change was intended but not applied.

## Findings (1)

### 1. Score position comment does not match actual HUD position

- Severity: **low**
- Category: `maintainability`
- Confidence: `0.62`
- Location: `hud.js:1007-1009`
- Impact: The comment says the score was moved to x=-1.5, but the actual position is still set to x=-0.5. This is misleading and may hide that a requested overlap fix was not applied, making layout regressions more likely.
- Evidence: `updateHUD` comment states “Moved right to x=-1.5” while `scoreSprite.position.set(-0.5, 0.3, 0)` remains unchanged in initialization.
- Recommendation: Either update the position to match the intended x=-1.5 change or correct the comment to reflect the actual `scoreSprite.position` value.
