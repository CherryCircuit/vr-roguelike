# Adobe Express Add-on — Build Brief

**Project:** Overnight Design Engine + Express Import Add-on  
**Date:** March 23, 2026  
**Requested by:** Graeme  
**Assigned to:** Codey (Claude Code / senior developer)  
**Priority:** High — core marketing automation pipeline  

---

## 1. Project Vision

Build a two-part system that lets AI agents design social media posts overnight (headless, no browser), then import them into Adobe Express as fully editable designs for morning review.

**The key principle:** Agents make ALL creative decisions. Adobe Express is just the renderer and review surface.

### What This Replaces

- Manual design creation in Canva/Express for routine social posts
- Copy-pasting generated text onto images
- Indesign scripts that output rigid pre-designed documents
- Template-based approaches where every post looks the same

### What This Enables

- Principles-based design (style guides, not templates)
- Every post is unique in composition
- Overnight batch generation of 5-20 posts
- One-click import into Express with fully editable text layers
- Per-client brand customization

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OVERNIGHT PIPELINE                     │
│                                                          │
│  Comfy UI ──→ Generated images                           │
│                     │                                    │
│  Agent ─────────────┼──→ Brand assets (photos, logos)    │
│  (Ampy/Durey)      │     from /brand-assets/            │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────┐                        │
│  │   HEADLESS DESIGN ENGINE     │                        │
│  │   (Node.js / TypeScript)     │                        │
│  │                              │                        │
│  │  • Reads style-guide.md      │                        │
│  │  • Reads brand config        │                        │
│  │  • Selects photos from lib   │                        │
│  │  • Composes layouts          │                        │
│  │  • Applies typography        │                        │
│  │  • Generates manifest.json   │                        │
│  │  • Bundles ZIP               │                        │
│  └──────────────┬───────────────┘                        │
│                 │                                         │
│                 ▼                                         │
│  /output/2026-03-24-client-acme.zip                      │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    MORNING REVIEW                          │
│                                                          │
│  Graeme opens Adobe Express                               │
│  → Opens add-on                                          │
│  → Clicks [Import Overnight Batch]                        │
│  → Selects ZIP file                                      │
│  → Add-on creates editable designs, one per page          │
│  → Reviews, edits text, approves                          │
│  → Exports PNG/JPG for posting                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Part 1: Headless Design Engine

### 3.1 Tech Stack

- **Language:** TypeScript (Node.js 18+)
- **Canvas rendering:** `@napi-rs/canvas` (Skia-based, fast, proper font support)
- **Image handling:** `sharp` (resize, crop, composite)
- **ZIP creation:** `archiver`
- **Font loading:** `@napi-rs/canvas` font API (registerFont with TTF/OTF files)
- **CLI interface:** Simple command-line runner
- **Config:** JSON + Markdown files

### 3.2 Input: Brand Asset Structure

```
/brand-assets/
├── {client-slug}/
│   ├── brand.json                 ← Brand configuration
│   ├── style-guide.md             ← Composition rules (plain English)
│   ├── fonts/
│   │   ├── Inter-Bold.ttf
│   │   ├── Inter-Regular.ttf
│   │   └── {custom-font}.ttf
│   ├── logos/
│   │   ├── logo-primary.png       ← Full logo (transparent PNG)
│   │   └── logo-icon.png          ← Icon-only version
│   ├── colors.json                ← Brand color palette
│   ├── photos/
│   │   ├── lifestyle/
│   │   │   ├── index.json         ← Photo metadata index
│   │   │   ├── beach-sunset-001.jpg
│   │   │   └── ...
│   │   ├── product/
│   │   │   ├── index.json
│   │   │   └── ...
│   │   ├── texture/
│   │   │   ├── index.json
│   │   │   └── ...
│   │   └── hero/
│   │       ├── index.json
│   │       └── ...
│   └── graphics/
│       ├── accent-bar.svg
│       ├── pattern-overlay.png
│       └── ...
```

### 3.3 Brand Configuration (`brand.json`)

```json
{
  "clientName": "Acme Corp",
  "slug": "client-acme",
  "fonts": {
    "heading": {
      "family": "Inter",
      "weight": "Bold",
      "file": "fonts/Inter-Bold.ttf"
    },
    "body": {
      "family": "Inter",
      "weight": "Regular",
      "file": "fonts/Inter-Regular.ttf"
    },
    "accent": {
      "family": "Inter",
      "weight": "Light",
      "file": "fonts/Inter-Light.ttf"
    }
  },
  "colors": {
    "primary": "#1a1a2e",
    "secondary": "#e94560",
    "accent": "#f4a460",
    "textLight": "#ffffff",
    "textDark": "#1a1a2e",
    "background": "#16213e",
    "overlay": "rgba(26, 26, 46, 0.7)"
  },
  "logo": {
    "primary": "logos/logo-primary.png",
    "icon": "logos/logo-icon.png",
    "placement": "top-left",
    "padding": 60
  },
  "defaults": {
    "textAlign": "left",
    "textPadding": 60,
    "headingSize": 64,
    "bodySize": 28,
    "ctaSize": 24
  }
}
```

### 3.4 Photo Index Format (`photos/{category}/index.json`)

```json
{
  "category": "lifestyle",
  "description": "Lifestyle and people photos for warm, approachable content",
  "tags": ["outdoor", "casual", "warm", "people", "lifestyle"],
  "files": [
    {
      "filename": "beach-sunset-001.jpg",
      "tags": ["beach", "sunset", "summer", "warm", "golden-hour"],
      "mood": "relaxed",
      "dominantColors": ["#f4a460", "#ff6347", "#1e90ff"],
      "orientation": "landscape",
      "subjects": ["people", "ocean", "sky"],
      "description": "Couple walking on beach at sunset"
    }
  ]
}
```

### 3.5 Style Guide Format (`style-guide.md`)

This is written in plain English so agents can read it and LLMs can reason about it. Example:

```markdown
# Acme Corp — Visual Style Guide

## Composition Principles
- NEVER use center-aligned text as default. Prefer left-aligned for modern feel.
- Headlines should sit in the bottom third of the canvas for image-heavy posts.
- Leave minimum 60px padding on all edges.
- When using full-bleed photos, add a semi-transparent overlay (primary color, 60-70% opacity) behind text for readability.
- Logo always goes top-left with 60px padding.

## Typography
- Headings: Inter Bold, 56-72pt, white
- Body text: Inter Regular, 24-32pt, white or light gray (#c4c4c4)
- CTA text: Inter Light, 20-24pt, accent color (#e94560)
- Maximum 3 text elements per post. Less is more.

## Color Usage
- Primary (#1a1a2e) for overlays, backgrounds, and text on light images
- Secondary (#e94560) for accents, CTAs, and emphasis only
- Accent (#f4a460) sparingly — highlights, decorative elements
- Never use more than 3 brand colors per post
- Text on dark backgrounds: always white or light gray
- Text on light backgrounds: always primary dark or secondary

## Photo Selection
- Prefer lifestyle photos over product shots for awareness posts
- Product shots for promotional/sale posts
- Texture images for quote posts and inspirational content
- Hero images for announcements and launches
- Crop to fill — never show letterboxing

## Layout Patterns (suggestions, not rules)
- Pattern A: Full-bleed image + bottom overlay + headline + subtext
- Pattern B: Split layout — image left 60%, solid color right 40% with text
- Pattern C: Solid color background + centered hero image + headline below
- Pattern D: Texture background + large centered headline + small subtext
- Pattern E: Photo with gradient fade to solid color + text in solid area
- Vary between patterns. Never use the same pattern twice in a row.

## What to Avoid
- Drop shadows on text
- Outlined/hollow text
- More than 2 fonts per post
- Centered body text
- Stretching or pixelating images
- Text over busy image areas without overlay
```

### 3.6 Design Engine API

```typescript
import { DesignEngine } from './engine';

const engine = new DesignEngine({
  brandAssetsPath: '/brand-assets/client-acme',
  outputDir: '/output',
  previewQuality: 0.85, // JPEG quality for preview renders
});

// Generate a batch of posts
const result = await engine.generateBatch({
  client: 'client-acme',
  posts: [
    {
      platform: 'instagram-square',      // 1080x1080
      copy: {
        headline: 'Spring Collection 2026',
        subtext: 'Discover what\'s new this season',
        cta: 'Shop Now →'
      },
      imagePreference: {
        category: 'lifestyle',
        mood: 'warm',
        tags: ['spring', 'outdoor']
      },
      layoutHint: 'Pattern A'            // Optional — engine can choose
    },
    {
      platform: 'instagram-story',       // 1080x1920
      copy: {
        headline: 'Limited Time Offer',
        subtext: '30% off everything this weekend',
        cta: 'Use code SPRING30'
      },
      imagePreference: {
        category: 'product',
        mood: 'bold'
      }
    },
    // ... more posts
  ]
});

// result contains:
// {
//   zipPath: '/output/2026-03-24-client-acme.zip',
//   previewDir: '/output/2026-03-24-client-acme/previews/',
//   posts: [
//     { index: 0, preview: '/output/.../preview-0.jpg' },
//     ...
//   ]
// }
```

### 3.7 Platform Presets

```typescript
const PLATFORMS = {
  'instagram-square':   { width: 1080, height: 1080, label: 'Instagram Post' },
  'instagram-story':    { width: 1080, height: 1920, label: 'Instagram Story' },
  'instagram-portrait': { width: 1080, height: 1350, label: 'Instagram Portrait' },
  'facebook-post':      { width: 1200, height: 630,  label: 'Facebook Post' },
  'facebook-square':    { width: 1080, height: 1080, label: 'Facebook Square' },
  'linkedin-post':      { width: 1200, height: 627,  label: 'LinkedIn Post' },
  'twitter-post':       { width: 1600, height: 900,  label: 'X/Twitter Post' },
  'pinterest-pin':      { width: 1000, height: 1500, label: 'Pinterest Pin' },
  'youtube-thumbnail':  { width: 1280, height: 720,  label: 'YouTube Thumbnail' },
  'tiktok-video-cover': { width: 1080, height: 1920, label: 'TikTok Cover' },
} as const;
```

### 3.8 Manifest Output Format (`manifest.json` inside ZIP)

This is the contract between the headless engine and the Express add-on. **This format must be stable and well-documented** — both systems depend on it.

```json
{
  "version": "1.0.0",
  "generated": "2026-03-24T06:00:00Z",
  "generatedBy": "headless-design-engine",
  "client": {
    "name": "Acme Corp",
    "slug": "client-acme"
  },
  "posts": [
    {
      "id": "post-001",
      "platform": "instagram-square",
      "platformLabel": "Instagram Post",
      "canvas": {
        "width": 1080,
        "height": 1080
      },
      "elements": [
        {
          "type": "image",
          "src": "assets/post-001-bg.jpg",
          "name": "Background",
          "bounds": { "x": 0, "y": 0, "width": 1080, "height": 1080 },
          "opacity": 1.0,
          "fit": "cover"
        },
        {
          "type": "rectangle",
          "name": "Text overlay",
          "bounds": { "x": 0, "y": 700, "width": 1080, "height": 380 },
          "fill": "#1a1a2e",
          "opacity": 0.7
        },
        {
          "type": "text",
          "name": "Headline",
          "content": "Spring Collection 2026",
          "font": "Inter Bold",
          "fontSize": 64,
          "color": "#ffffff",
          "bounds": { "x": 60, "y": 740, "width": 960, "height": 80 },
          "textAlign": "left"
        },
        {
          "type": "text",
          "name": "Subtext",
          "content": "Discover what's new this season",
          "font": "Inter Regular",
          "fontSize": 28,
          "color": "#c4c4c4",
          "bounds": { "x": 60, "y": 835, "width": 960, "height": 40 },
          "textAlign": "left"
        },
        {
          "type": "text",
          "name": "CTA",
          "content": "Shop Now →",
          "font": "Inter Light",
          "fontSize": 24,
          "color": "#e94560",
          "bounds": { "x": 60, "y": 890, "width": 960, "height": 35 },
          "textAlign": "left"
        },
        {
          "type": "image",
          "src": "assets/logo-primary.png",
          "name": "Logo",
          "bounds": { "x": 60, "y": 60, "width": 120, "height": 40 },
          "opacity": 1.0,
          "fit": "contain"
        }
      ]
    }
  ]
}
```

### 3.9 Element Types Supported

| Type | Properties | Notes |
|------|-----------|-------|
| `image` | `src`, `bounds`, `opacity`, `fit` (`cover`/`contain`), `name` | src is relative path within ZIP |
| `text` | `content`, `font`, `fontSize`, `color`, `bounds`, `textAlign`, `name` | font must match Adobe Fonts name |
| `rectangle` | `bounds`, `fill`, `opacity`, `cornerRadius`, `name` | Solid color rectangles |
| `ellipse` | `bounds`, `fill`, `opacity`, `name` | Circular/elliptical shapes |
| `line` | `start`, `end`, `stroke`, `strokeWidth`, `name` | Lines and dividers |
| `group` | `children` (array of elements), `bounds`, `name` | Groups for transforms |

### 3.10 ZIP Structure

```
overnight-batch-2026-03-24.zip
├── manifest.json
└── assets/
    ├── post-001-bg.jpg
    ├── post-002-bg.jpg
    ├── logo-primary.png
    └── accent-bar.svg
```

---

## 4. Part 2: Adobe Express Add-on

### 4.1 Tech Stack

- **Language:** TypeScript
- **UI Framework:** Vanilla TypeScript + Adobe Spectrum Web Components (or React — developer's choice based on complexity)
- **SDK:** `express-document-sdk` (Document Sandbox APIs)
- **UI SDK:** `addOnUISdk` (loaded from `https://express.adobe.com/static/add-on-sdk/sdk.js`)
- **ZIP handling:** JSZip (client-side)
- **Build tool:** Vite or Webpack (Adobe recommends these)
- **Package management:** npm

### 4.2 Add-on Structure

```
express-design-import-addon/
├── manifest.json              ← Add-on manifest (Adobe config)
├── package.json
├── vite.config.ts
├── ui/
│   ├── index.html             ← Add-on panel HTML
│   └── index.ts               ← UI logic (buttons, file picker, messages)
├── sandbox/
│   └── code.ts                ← Document API logic (create elements from manifest)
├── shared/
│   ├── manifest-parser.ts     ← Parse and validate manifest.json
│   ├── element-builder.ts     ← Create Express elements from manifest elements
│   └── types.ts               ← TypeScript interfaces matching manifest format
└── assets/
    └── icon.svg               ← Add-on icon
```

### 4.3 Add-on Manifest (`manifest.json` — Adobe's format)

```json
{
  "id": "com.graeme.overnight-design-import",
  "name": "Overnight Design Import",
  "version": "1.0.0",
  "main": "ui/index.html",
  "icon": "assets/icon.svg",
  "description": "Import AI-generated social media designs from overnight batch ZIP files. Fully editable text layers, per-client branding.",
  "entrypoints": [
    {
      "type": "panel",
      "id": "main-panel",
      "label": {
        "default": "Design Import"
      }
    }
  ],
  "requirements": {
    "capabilities": [
      "document",
      "network"
    ]
  }
}
```

### 4.4 UI Design

```
┌─ Overnight Design Import ───────────────────┐
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  📦 Import Overnight Batch              │ │
│  │                                         │ │
│  │  Select a ZIP file generated by the     │ │
│  │  headless design engine.                │ │
│  │                                         │ │
│  │  [Choose File...]                       │ │
│  │                                         │ │
│  │  ✅ overnight-batch-2026-03-24.zip      │ │
│  │                                         │ │
│  │  Client: Acme Corp                      │ │
│  │  Posts: 7                               │ │
│  │  Platforms: Instagram (4), LinkedIn (2), │ │
│  │            Facebook (1)                 │ │
│  │                                         │ │
│  │  [📥 Import All Posts to Document]       │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ──── Manual Single Post ────                │
│                                              │
│  Platform:  [▼ Instagram Square        ]    │
│  Headline:  [_________________________]    │
│  Subtext:   [_________________________]    │
│  CTA:       [_________________________]    │
│  BG Image:  [📂 Choose File...]           │
│                                              │
│  [✨ Generate Post]                          │
│                                              │
│  ──── Brand Config ────                      │
│                                              │
│  [⚙️ Configure Brands]                       │
│                                              │
│  Stored brands:                              │
│  • Acme Corp (6 posts imported)              │
│  • Beanstalk Inc (3 posts imported)          │
│                                              │
└──────────────────────────────────────────────┘
```

### 4.5 Import Flow (Step by Step)

1. User clicks **[Choose File...]** → file picker opens
2. User selects a `.zip` file
3. Add-on uses **JSZip** to read the ZIP in-memory
4. Extracts `manifest.json` from the ZIP root
5. Validates manifest against schema (version, required fields)
6. Displays summary: client name, number of posts, platforms
7. User clicks **[Import All Posts]**
8. For each post in `manifest.posts`:
   a. Create a new page with canvas dimensions
   b. Iterate `post.elements` in order (z-order = array order):
      - `image` → extract blob from ZIP → `addOnUISdk.app.document.addImage(blob)` → position/resize via Document Sandbox
      - `text` → `editor.createText(content)` → set font/size/color/position via `applyCharacterStyles()` and `translation`
      - `rectangle` → `editor.createRectangle()` → set fill/opacity/position
      - `ellipse` → `editor.createEllipse()` → set fill/opacity/position
      - `line` → `editor.createLine()` → set stroke/position
      - `group` → recursively process children → `GroupNode`
   c. Navigate to the new page
9. Done. All posts are in the document as separate pages with fully editable text.

### 4.6 Key SDK APIs to Use

**UI Side (`ui/index.ts`):**
```typescript
import addOnUISdk from "https://express.adobe.com/static/add-on-sdk/sdk.js";

// Add image from blob (UI side only)
await addOnUISdk.app.document.addImage(blob, mediaAttributes, importAddOnData);
```

**Document Sandbox (`sandbox/code.ts`):**
```typescript
import { editor, colorUtils } from "express-document-sdk";

// Create text
const textNode = editor.createText("Hello World");
textNode.translation = { x: 100, y: 200 };
textNode.width = 800;
textNode.height = 60;
editor.context.insertionParent.children.append(textNode);

// Style text
textNode.fullContent.applyCharacterStyles(
  { 
    color: colorUtils.fromHex("#ffffff"),
    fontSize: 64,
    fontFamily: "Inter Bold"
  },
  { start: 0, length: textNode.fullContent.text.length }
);

// Create rectangle with fill
const rect = editor.createRectangle();
rect.width = 1080;
rect.height = 380;
rect.translation = { x: 0, y: 700 };
rect.fill = editor.makeColorFill(colorUtils.fromHex("#1a1a2e"));
rect.opacity = 0.7;
editor.context.insertionParent.children.append(rect);

// Create ellipse
const ellipse = editor.createEllipse();
ellipse.rx = 50;
ellipse.ry = 50;
ellipse.fill = editor.makeColorFill(colorUtils.fromHex("#e94560"));
editor.context.insertionParent.children.append(ellipse);

// Position elements
element.setPositionInParent(
  { x: targetX, y: targetY },
  { x: element.width / 2, y: element.height / 2 }
);

// Group elements
const group = editor.createGroup();
group.children.append(textNode, rect);

// Manage pages
const page = editor.context.currentPage;
// ... access artboards, create new pages

// Renditions (export)
// Via editor.createRendition() — see docs for options
```

### 4.7 Communication Between UI and Sandbox

The add-on uses a two-part architecture:
- **UI (iframe):** Handles file picking, ZIP reading, user interaction
- **Document Sandbox:** Has access to Express Document APIs (create elements)

They communicate via the **Communication API** (message passing). The UI sends parsed manifest data to the sandbox, which creates the actual Express elements.

```typescript
// UI side — send manifest to sandbox
addOnUISdk.app.document.addAPI('importManifest', (manifest) => {
  // sandbox receives this and creates elements
});

// Or use the built-in message passing:
// ui/index.ts
require('express-document-sdk').documentSandboxes[0].dispatch({
  type: 'IMPORT_MANIFEST',
  manifest: parsedManifest,
  assets: blobMap // Map of filename → Blob
});
```

### 4.8 Brand Config Storage

Use `clientStorage` to persist brand settings per client:

```typescript
// Save brand config
await addOnUISdk.instance.clientStorage.setItem('brand-client-acme', {
  name: 'Acme Corp',
  fonts: { heading: 'Inter Bold', body: 'Inter Regular' },
  colors: { primary: '#1a1a2e', secondary: '#e94560' },
  logoPath: 'assets/logo-primary.png'
});

// Load brand config
const config = await addOnUISdk.instance.clientStorage.getItem('brand-client-acme');
```

### 4.9 Manual Single-Post Mode

For when you want to create one post without the overnight pipeline. The UI provides fields for copy, platform, and image. The add-on:
1. Reads the selected client's brand config from `clientStorage`
2. Applies the style guide rules (stored as part of brand config)
3. Creates a basic layout using the same element creation logic
4. The user can then manually adjust in Express

### 4.10 Distribution

**Phase 1: Private link only** — no Adobe review needed, share with Graeme only.  
**Phase 2 (optional):** Public listing if Graeme wants to monetize.

---

## 5. Shared Types Package

Both the headless engine and the Express add-on need to agree on the manifest format. Create a shared types file:

```typescript
// shared/types.ts

export interface DesignManifest {
  version: string;
  generated: string;           // ISO 8601
  generatedBy: string;
  client: {
    name: string;
    slug: string;
  };
  posts: ManifestPost[];
}

export interface ManifestPost {
  id: string;
  platform: string;            // Key from PLATFORMS
  platformLabel: string;
  canvas: {
    width: number;
    height: number;
  };
  elements: ManifestElement[];
}

export type ManifestElement = 
  | ManifestImageElement
  | ManifestTextElement
  | ManifestRectangleElement
  | ManifestEllipseElement
  | ManifestLineElement
  | ManifestGroupElement;

interface BaseElement {
  type: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  opacity?: number;
}

interface ManifestImageElement extends BaseElement {
  type: 'image';
  src: string;                 // Relative path within ZIP
  fit: 'cover' | 'contain';
}

interface ManifestTextElement extends BaseElement {
  type: 'text';
  content: string;
  font: string;                // Adobe Fonts family name (e.g., "Inter Bold")
  fontSize: number;
  color: string;               // Hex color
  textAlign: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
}

interface ManifestRectangleElement extends BaseElement {
  type: 'rectangle';
  fill: string;                // Hex color
  cornerRadius?: number;
}

interface ManifestEllipseElement extends BaseElement {
  type: 'ellipse';
  fill: string;
}

interface ManifestLineElement {
  type: 'line';
  name: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  stroke: string;
  strokeWidth: number;
}

interface ManifestGroupElement extends BaseElement {
  type: 'group';
  children: ManifestElement[];
}
```

---

## 6. Build Phases

### Phase 1: Headless Design Engine (Priority)

**Goal:** CLI tool that generates ZIP files from brand assets + copy.

1. Set up TypeScript project with `@napi-rs/canvas`, `sharp`, `archiver`
2. Define shared types package
3. Implement brand config loader (reads `brand.json`, `style-guide.md`)
4. Implement photo selector (reads index.json, filters by tags/mood)
5. Implement layout engine (applies style guide rules to compose elements)
6. Implement canvas renderer (renders preview PNGs for verification)
7. Implement ZIP packager (manifest.json + assets)
8. CLI interface: `design-engine generate --client client-acme --batch batch.json`
9. Test with real brand assets and verify output

**Deliverable:** `design-engine` CLI that outputs valid ZIP files.

### Phase 2: Express Add-on — Import Only

**Goal:** Add-on that imports ZIP files and creates editable designs.

1. Scaffold Express add-on project (follow Adobe's Hello World guide)
2. Implement manifest parser and validator
3. Implement element builder (manifest element → Express Document API element)
4. Implement ZIP reader (JSZip) and file picker UI
5. Implement import flow (iterate posts, create pages, place elements)
6. Test with ZIP files from Phase 1
7. Debug text rendering, positioning, image placement

**Deliverable:** Working add-on that imports ZIP → editable Express document.

### Phase 3: Polish & Integration

1. Add manual single-post mode to add-on
2. Add brand config storage (clientStorage)
3. Error handling and validation (invalid manifests, missing assets, font not found)
4. Visual polish of add-on UI
5. Test end-to-end: overnight generation → morning import → edit → export
6. Documentation

**Deliverable:** Production-ready two-part system.

### Phase 4: Agent Integration (Future)

1. Create an OpenClaw skill that wraps the design engine CLI
2. Create overnight cron job that triggers agent → design engine → ZIP output
3. Photo library management agent (tagging, indexing, curation)
4. Integration with Comfy output directory

---

## 7. Key Technical Decisions

| Decision | Recommendation | Why |
|----------|---------------|-----|
| Canvas library | `@napi-rs/canvas` | Skia-based, fast, proper font support, native Node.js |
| ZIP library (headless) | `archiver` | Well-maintained, streaming |
| ZIP library (add-on) | JSZip | Works client-side in browser |
| UI framework | Vanilla TS + Spectrum | Simpler, fewer deps, Adobe's own design system |
| Build tool | Vite | Adobe recommends, fast |
| Font handling | Bundle TTFs for headless, sync via Adobe Fonts for Express | Two-font strategy (see notes) |

---

## 8. Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Font rendering mismatch between headless and Express | Test early. Use same TTF files. Verify visually. |
| Express add-on SDK changes | Pin SDK version. Follow Adobe changelog. |
| Large ZIP files (many high-res images) | Compress images in headless engine before packaging. Target <50MB per batch. |
| Complex layouts look wrong in Express | Start simple (Pattern A/B only), add complexity after validating base cases. |
| Text wrapping differences | Headless engine should calculate text bounds and include them in manifest. |
| Adobe review process for public listing | Start with private link (no review needed). |

---

## 9. Reference Links

- **Adobe Express Add-on Docs:** https://developer.adobe.com/express/add-ons/docs/guides/
- **Document API Overview:** https://developer.adobe.com/express/add-ons/docs/guides/platform_concepts/document-api/
- **Text APIs:** https://developer.adobe.com/express/add-ons/docs/guides/learn/how_to/use_text/
- **Image APIs:** https://developer.adobe.com/express/add-ons/docs/guides/learn/how_to/use_images/
- **Color APIs:** https://developer.adobe.com/express/add-ons/docs/guides/learn/how_to/use_color/
- **Position/Geometry:** https://developer.adobe.com/express/add-ons/docs/guides/learn/how_to/position_elements/
- **Shapes:** https://developer.adobe.com/express/add-ons/docs/guides/learn/how_to/use_geometry/
- **Code Playground:** https://www.adobe.com/go/addon-playground?session=saved
- **Dev MCP Server:** https://developer.adobe.com/express/add-ons/docs/guides/getting_started/local_development/mcp_server/
- **Hello World Guide:** https://developer.adobe.com/express/add-ons/docs/guides/getting_started/hello-world/
- **@napi-rs/canvas:** https://github.com/Brooooooklyn/canvas
- **Sharp:** https://sharp.pixelplumbing.com/
- **JSZip:** https://stuk.github.io/jszip/
- **Archiver:** https://archiverjs.com/

---

## 10. Success Criteria

- [ ] Headless engine generates ZIP from brand assets + copy in <30 seconds per post
- [ ] ZIP imports into Express add-on with one click
- [ ] All text layers are fully editable in Express
- [ ] Layout matches headless preview within reasonable tolerance
- [ ] Supports at least 5 platforms (Instagram square/story, Facebook, LinkedIn, X)
- [ ] Brand config persists between sessions
- [ ] Manual single-post mode works
- [ ] Graeme can review and approve a batch of 10 posts in <15 minutes
