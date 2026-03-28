# Session: 2026-03-28 03:20:16 UTC

- **Session Key**: agent:main:telegram:group:-1003713368213:topic:1
- **Session ID**: 439934bd-a43d-4695-8c0b-3634c98cecb1
- **Source**: telegram

## Conversation Summary

assistant: ✅ New session started · model: zai/glm-5-turbo
user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Friday, March 27th, 2026 — 4:13 PM (America/Vancouver) / 2026-03-27 23:13 UTC
assistant: Hey Graeme. Friday evening — anything on the go, or just winding down?
user: Conversation info (untrusted metadata):
```json
{
  "message_id": "329",
  "sender_id": "5540671995",
  "conversation_label": "Research 🏹 Lyn id:-1003713368213 topic:1",
  "sender": "Graeme Findlay",
  "timestamp": "Fri 2026-03-27 16:24 PDT",
  "group_subject": "Research 🏹 Lyn",
  "topic_id": "1",
  "is_forum": true,
  "is_group_chat": true
}
```

Sender (untrusted metadata):
```json
{
  "label": "Graeme Findlay (5540671995)",
  "id": "5540671995",
  "name": "Graeme Findlay",
  "username": "graemefindlay"
}
```

Do some digging for me and find the best method or Agentic tools and workflow for ComfyUI so I can create a concept and get Comfy (my OpenClaw agent) to do basically the following:

1. I come up with a concept and tell Comfy about it.
2. Comfy understands what I’m going for and creates a storyboard of simple images to show the basic gist of my idea and a script for voiceover or character dialog if needed
3. I check the work, and approve or request changes
4. Once approved, Comfy creates characters using prompts in ComfyUI from various angles to establish look, style, clothing, etc. for each character in the plan.
5. I approve or ask for changes.
6. Once approved, Comfy takes the original storyboard and creates beautiful cinematic quality production images, feeds them into a workflow that allows for multiple images, allows for adjusted timing, what time each frame occurs, and then renders each clip overnight. (I already have this workflow for LTX-2.3.) Comfy checks after each generation to make sure it matches our script and doesn’t have any weird hallucinations.
7. In the morning, I check all the clips and then I take them into a video editor like Premiere to compile, add music, whatever.

I’d like to make this process simple and mostly OpenClaw driven. Comfy is already set up with most of the tools like ComfyUI access, already can generate images and videos, so I just need your help in figuring out the best way to bring it all home!
assistant: Good project. Let me dig into the current state of ComfyUI agentic workflows, character consistency tools, and LTX-2.3 pipeline best practices.
assistant: Alright, here's what I found. Let me put together a solid plan.

---

## 🎬 ComfyUI Agentic Pipeline — Research Summary

### The Architecture

The core idea: **pre-built ComfyUI workflow templates (API format) + OpenClaw agent orchestration + ComfyUI REST API**. The agent (Comfy) doesn't need to *build* workflows on the fly — it parameterizes proven templates and queues them via HTTP.

---

### Stage-by-Stage Breakdown

#### 1. Concept → Storyboard
**How it works:**
- You describe the concept to Comfy in natural language
- Comfy breaks it into scenes: generates a **scene script** (shot descriptions, camera angles, voiceover/dialogue)
- Comfy queues a **storyboard generation workflow** via ComfyUI API — rough, fast images per scene (Flux with lower steps or a lighter model)

**Tools to look at:**
- **Flux.1 + Qwen Image Edit** for scene-by-scene generation with continuity
- The `[SCENE-X]` format approach — you can define a simple markup and have the agent parse it into individual scene prompts
- Alternatively, just have the agent write individual prompts per scene and queue them sequentially

**Best workflow template:** A simple `txt2img` pipeline with Flux, low denoise (fast boards), and a consistent style LoRA. Nothing fancy for this stage — speed matters more than quality.

---

#### 2. Character Design (Multi-Angle Sheets)
**How it works:**
- Once storyboard is approved, Comfy extracts all unique characters
- Generates a **character reference sheet** from multiple angles (front, 3/4, side, back) with style/clothing descriptions
- These become the "DNA" for all subsequent generations

**Best method: Flux + PuLID** (current gold standard for 2025)
- No LoRA training required — uses a single face image + pose sheet to lock identity
- 75-95% consistency across angles
- Workflow: Load character portrait → PuLID injection → pose sheet (ControlNet/OpenPose) → 4-angle output

**Setup needed:**
- `Flux1-dev` checkpoint
- `PuLID` model files
- A standardized multi-pose PNG (front/side/3/4/back grid)
- Mickmumpitz's **Flux Consistent Characters** workflow (available on ComfyUI community)

---

#### 3. Production Images (Cinematic Quality)
**How it works:**
- Comfy takes the approved storyboard scenes and regenerates them at full quality
- **Locks character identity** by feeding the approved character reference images through PuLID
- Each production image is a polished, cinematic frame

**Key technique:**
- Use the character reference images from Stage 2 as PuLID inputs
- Scene-specific prompts override the background/setting while PuLID preserves the face/identity
- Higher steps (30-40), higher CFG, upscaling nodes for final polish

---

#### 4. Video Generation (LTX-2.3)
**How it works:**
- Production images feed into your existing LTX-2.3 workflow
- Agent queues all clips sequentially (or in parallel if GPU allows)
- Timing/frame count configurable per scene in the workflow JSON

**You already have this workflow** — the agent just needs to:
1. Swap in the production image for each scene
2. Set the timing parameters (duration, frames)
3. Queue via API
4. Poll for completion

---

#### 5. Quality Checking (The Hard Part)
**No built-in ComfyUI tool for this.** But there's a clean solution:

**Use OpenClaw's native `image` tool for VLM-based review.**

The workflow:
1. Each video clip/image generation completes → output saved to a watched directory
2. Comfy agent reads the output image using `image` tool with a prompt like: *"Compare this image to the scene description: [description]. Does the character match? Any hallucinations, extra limbs, text artifacts, or visual glitches? Rate 1-10."*
3. If score < threshold → flag for regeneration with adjusted seed/parameters
4. If score passes → move to next scene

This is actually the most elegant part — **the agent IS the quality checker**, using its built-in vision model. No custom nodes needed.

---

### Technical Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Orchestration** | OpenClaw (Comfy agent) | Plans, queues, reviews, iterates |
| **API Control** | ComfyUI REST API (`/prompt`, `/history`) | Queue workflows, poll status, retrieve outputs |
| **Workflow Templates** | JSON files (API format) | Pre-built for each stage: storyboard, char sheet, production, video |
| **Character Consistency** | Flux + PuLID | Lock identity across all scenes |
| **Image Gen** | Flux.1 (dev/schnell) | Storyboard + production images |
| **Video Gen** | LTX-2.3 | Image-to-video with your existing workflow |
| **Quality Check** | OpenClaw `image` tool (VLM) | Automated review against script |
| **Overnight Queue** | OpenClaw cron / manual trigger | Batch process all clips while you sleep |

---

### What You Need to Set Up

1. **Export your LTX-2.3 workflow in API format** (Dev Mode → Save API Format) — this gives you the JSON template the agent will parameterize
2. **Build 3 more workflow templates** (or find community ones):
   - Simple storyboard `txt2img` (Flux, fast/rough)
   - Character sheet generator (Flux + PuLID + pose sheet)
   - Production image generator (Flux + PuLID + upscale)
3. **Install PuLID** nodes/models if not already present
4. **Give Comfy (the agent) HTTP access** to your ComfyUI instance (`localhost:8188`)
5. **Create a Python helper script** that wraps the ComfyUI API calls (queue, poll, retrieve) — or have the agent do it directly with `curl`/HTTP calls

---

### The Ideal Flow (From Your Perspective)

```
You: "I want a 60s short about a lone astronaut discovering an alien garden on Europa."

Comfy: ✍️ Writes scene breakdown (8 scenes, voiceover script)
Comfy: 🖼️ Generates 8 rough storyboard frames
You: Review → "Scene 3 needs to be darker, otherwise looks good"
Comfy: 🔄 Regenerates scene 3 → 📋 Creates character sheet for Astronaut + Alien Plant
You: Review character designs → Approved
Comfy: 🎨 Regenerates all 8 scenes at cinematic quality with locked characters
Comfy: 🎥 Queues 8 LTX-2.3 clips overnight (quality-checking each)
Morning: You open 8 polished video clips → Premiere time 🎬
```

---

### One Thing I'd Caution On

**ComfyUI-R1** (natural language → workflow generation) sounds cool but I wouldn't rely on it for a production pipeline. It's a 7B research model — impressive format validity stats, but for reliability you want *pre-built, tested workflow templates* that the agent just parameterizes. Much more predictable.

Want me to start building out the actual workflow templates, the Python API helper script, or the OpenClaw skill that ties it all together?
user: Conversation info (untrusted metadata):
```json
{
  "message_id": "335",
  "sender_id": "5540671995",
  "conversation_label": "Research 🏹 Lyn id:-1003713368213 topic:1",
  "sender": "Graeme Findlay",
  "timestamp": "Fri 2026-03-27 16:45 PDT",
  "group_subject": "Research 🏹 Lyn",
  "topic_id": "1",
  "is_forum": true,
  "is_group_chat": true
}
```

Sender (untrusted metadata):
```json
{
  "label": "Graeme Findlay (5540671995)",
  "id": "5540671995",
  "name": "Graeme Findlay",
  "username": "graemefindlay"
}
```

Before that, I’m having a lot of problems trying to generate multiple images using Z-Image-Turbo that keep consistency in the background details. I’m using LoRAs for my character, so my subject matches between frames, but how descriptive do I need to be to keep the exact same stuff in the background consistent?
assistant: Here's the honest answer: **prompt-only is never going to give you reliable background consistency**, no matter how descriptive you get. The same seed helps, but diffusion models fundamentally interpret even identical prompts slightly differently each run — small objects, lighting angles, textures, and spatial relationships drift.

### Why Descriptive Prompts Aren't Enough

Even with a word-for-word identical prompt and fixed seed, changing your *character's pose or action* changes how the model distributes attention across the scene. The background elements shift to accommodate the new foreground composition. You can get "close enough" for mood boards, but for sequential frames where a viewer will notice continuity breaks (a window changing shape, a bookshelf disappearing, a lamp moving) — it falls apart.

### What Actually Works (Ranked by Effort vs. Result)

**1. Generate the background ONCE, then composite** ⭐ Most Reliable
- Generate your scene/background as a standalone image first
- Use **inpainting** to place your character into the same background across all frames
- The background never changes because it literally doesn't regenerate
- LoRA handles your character, inpainting masks keep the background frozen

**2. ControlNet Depth/Canny from a reference frame** ⭐⭐ Best for ComfyUI
- Generate your first "hero" frame
- Extract depth map (ControlNet Depth) and edge map (ControlNet Canny) from it
- Feed those as conditioning for every subsequent frame
- The structure is locked — only your character prompt varies
- Works beautifully with your existing LoRA setup

**3. Fixed seed + identical prompt + batch generation** ⭐⭐⭐ Good Enough for Rough Cuts
- Literally the same prompt string, same seed, only changing the character action
- Generates all frames in a single batch (shared self-attention helps)
- Not frame-perfect, but surprisingly decent for storyboard-level consistency
- **Use this for your storyboard stage**, not final production

**4. IP-Adapter for scene style + LoRA for character**
- Use an IP-Adapter image of your background reference to condition the scene
- Your LoRA handles character identity
- Good but not perfect — ~75-85% background consistency

### What I'd Recommend for Your Pipeline

For the **storyboard stage**: Method 3 is fine. Rough backgrounds, speed over perfection.

For **production frames** (the ones feeding into LTX-2.3): **Method 1 or 2 is mandatory.** Background inconsistency in a video clip is immediately noticeable and breaks the illusion. Generate your background once, lock it with inpainting or ControlNet, and only vary the character.

### Quick Prompt Tip If You're Stuck With Text-Only

If you absolutely must use prompts only for now, structure them obsessively:

```
[CHARACTER ACTION/POSE], [CHARACTER DETAILS via LoRA trigger],
[SCENE: exact same description every time, front to back],
"dark sci-fi corridor, blue strip lighting on left wall, 
four pipes running along ceiling, steam vent on right, 
metal grate floor, warning sign on far wall, 
no windows, industrial, dim atmosphere"
```

Same order, same wording, every frame. Front-to-back spatial description. But again — this gets you 70% there. For the other 30%, you need visual conditioning.

Want me to help set up the inpainting or ControlNet workflow in ComfyUI?
