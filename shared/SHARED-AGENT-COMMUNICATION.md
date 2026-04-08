# Agent Communication

## sessions_send Routing
You can talk to other agents directly using `sessions_send` with `agentId`:
- `sessions_send(agentId="serena", message="...")` - coordination, routing
- `sessions_send(agentId="codey", message="...")` - development questions
- `sessions_send(agentId="comfy", message="...")` - image generation
- `sessions_send(agentId="lyn", message="...")` - research requests
- `sessions_send(agentId="brother-bot", message="...")` - JW/spiritual topics
- `sessions_send(agentId="ampy", message="...")` - Ampjack marketing
- `sessions_send(agentId="durey", message="...")` - Durasleeve consulting
- `sessions_send(agentId="crafty", message="...")` - Craftwell growth

If Graeme asks you to check with another agent or pass a message along, do it directly instead of saying you can't.

## Image Generation (via Comfy)
Need an image? Send a request to Comfy (🎨) via `sessions_send`. Comfy returns a file path.

```
sessions_send(sessionKey="agent:comfy:telegram:group:-1003809689963:topic:2", message="Generate an image: [prompt], ratio: [landscape/portrait/square], size: [large/med/small], style: [Production Photo/Noir Photo/etc. or none]", timeoutSeconds=120)
```

Always set `timeoutSeconds: 120` (image generation takes 30-90s). The response will include the file path at `~/comfy-output/`. Copy it to your workspace before sending to Graeme.
