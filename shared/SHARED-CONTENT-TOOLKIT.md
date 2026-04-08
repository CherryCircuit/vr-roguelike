# Content Idea Generation & SEO Keyword Research

## Content Idea Generation

When asked for content ideas, blog topics, or "what should I post":

### The Five Questions (each answer = at least one piece of content)
1. What mistake does the audience make repeatedly?
2. What did you learn the hard way that you wish someone told you?
3. What question do customers ask most often?
4. What's a hill you'll die on in your industry?
5. What's something "everyone knows" that you think is wrong?

### Content Frameworks
1. **Problem Call-Out:** "The #1 mistake [audience] makes with [topic]"
2. **Here's What Works:** "How to [achieve outcome] without [common obstacle]"
3. **Contrarian Take:** "Stop [common advice]. Here's what actually works."
4. **Behind the Curtain:** "I [tried thing]. Here's what actually happened."
5. **Pattern Recognition:** "What [experience A] taught me about [topic B]"
6. **Resource Stack:** "[Number] tools I actually use for [outcome]"

### Content to NEVER Create
- "Grateful for the journey" posts with no substance
- Generic motivational quotes with no original take
- "Thought leadership" with no specific examples
- Engagement bait ("Agree?") with no value
- Content outside brand positioning

### Output Format
Deliver in two batches:
- **Quick Wins (This Week):** 5 ideas, low effort, high resonance
- **Authority Builders (This Month):** 3 ideas needing research or depth

Each idea needs: Hook, Core Insight, Platform Fit.

### Validation Before Posting
1. Does this connect to brand positioning? If not, skip it.
2. Is there a specific takeaway? Vague = forgettable.
3. Would you engage with this if someone else posted it? Be honest.

### Repurposing Multiplier
Every strong piece becomes 3-5 pieces:
1. Twitter/X thread (5-7 key points)
2. Quote graphic (spiciest line)
3. Short video (60-second core insight)
4. Newsletter angle (expand with personal story)

## SEO Keyword Research (Google Autocomplete)

When asked to find keywords, research search trends, or discover what people ask about a topic:

### Method
Use the Google Suggest API to find real autocomplete suggestions:
```
https://suggestqueries.google.com/complete/search?client=firefox&q={modifier}+{topic}
```

Default question modifiers: what, how, why, should, can, does, is, when, where, which, will, are, do

### Rules
- Use `web_fetch` to query the endpoint for each modifier + topic combination
- Parse the JSON response for suggestion strings
- Deduplicate across modifiers
- Use 0.5-1s delay between requests to avoid rate limits
- No API key required for basic use

### Output
Return a deduplicated list of real search questions, grouped by modifier category. Flag the most promising ones for content creation.
