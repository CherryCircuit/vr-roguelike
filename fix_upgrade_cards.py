#!/usr/bin/env python3
"""
Fix upgrade card issues:
1. Increase font sizes proportionally to card size
2. Fix maxWidth for text wrapping
3. Add proper canvas padding for glow effects
4. Standardize text sizes across all cards
"""

import re

# Read the file
with open('/home/graeme/Github/vr-roguelike.worktrees/feature/111-fix-upgrade-cards/hud.js', 'r') as f:
    content = f.read()

# FIX 1: Update makeTextTexture to use dynamic padding based on glow size
old_makeTextTexture = '''  // Measure text to size canvas
  const textWidth = maxWidth || Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)));
  const lineHeight = fontSize * 1.3;
  const textHeight = lines.length * lineHeight;

  canvas.width = Math.ceil(textWidth) + 40;
  canvas.height = Math.ceil(textHeight);

  // Re-set after resize
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';'''

new_makeTextTexture = '''  // Measure text to size canvas
  const textWidth = maxWidth || Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)));
  const lineHeight = fontSize * 1.3;
  const textHeight = lines.length * lineHeight;

  // Add proper padding for glow effects (glowSize needs at least glowSize+5 pixels on each side)
  const padding = opts.glow ? (opts.glowSize || 15) + 10 : 40;
  canvas.width = Math.ceil(textWidth) + padding * 2;
  canvas.height = Math.ceil(textHeight) + padding * 2;

  // Re-set after resize
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Adjust drawing position for new padding
  const offsetX = padding;
  const offsetY = padding;'''

content = content.replace(old_makeTextTexture, new_makeTextTexture)

# FIX 2: Update text drawing to account for padding
old_draw = '''  // Main text
  ctx.fillStyle = opts.color || '#00ffff';
  lines.forEach((line, i) => {
    const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
    ctx.fillText(line, canvas.width / 2, y);
  });'''

new_draw = '''  // Main text
  ctx.fillStyle = opts.color || '#00ffff';
  lines.forEach((line, i) => {
    const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
    ctx.fillText(line, canvas.width / 2, y + offsetY);
  });'''

content = content.replace(old_draw, new_draw)

# FIX 3: Fix drop shadow position
old_shadow = '''  // Drop shadow
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    lines.forEach((line, i) => {
      const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
      ctx.fillText(line, canvas.width / 2 + 2, y + 2);
    });
  }'''

new_shadow = '''  // Drop shadow
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    lines.forEach((line, i) => {
      const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
      ctx.fillText(line, canvas.width / 2 + 2, y + 2 + offsetY);
    });
  }'''

content = content.replace(old_shadow, new_shadow)

# FIX 4: Update upgrade card font sizes (increase proportionally)
# Name: 21 -> 36 (was 28 on 0.9 card, now 1.2 card, so 28 * 1.2/0.9 = 37)
# Description: 16 -> 26 (was 20 on 0.9 card, now 1.2 card, so 20 * 1.2/0.9 = 27)
# maxWidth: 200 -> 280 (was 180 on 0.9 card, so 180 * 1.2/0.9 = 240, add more for safety)
old_upg_card = '''  // Name text - smaller to prevent overlap
  const nameSprite = makeSprite(upgrade.name.toUpperCase(), {
    fontSize: 21,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.19,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.35, 0.01);
  group.add(nameSprite);

  // Description text - standard size with padding (well inside box)
  const descSprite = makeSprite(upgrade.desc, {
    fontSize: 16,
    color: '#cccccc',
    scale: 0.15,
    depthTest: true,
    maxWidth: 200,
  });
  descSprite.position.set(0, -0.05, 0.01);
  group.add(descSprite);

  // Side-grade note (different color) when present
  if (upgrade.sideGradeNote) {
    const noteSprite = makeSprite(upgrade.sideGradeNote, {
      fontSize: 16,
      color: '#ffdd00',
      scale: 0.12,
      depthTest: true,
      maxWidth: 200,
    });
    noteSprite.position.set(0, -0.22, 0.01);
    group.add(noteSprite);
  }'''

new_upg_card = '''  // Name text - increased proportionally to card size
  const nameSprite = makeSprite(upgrade.name.toUpperCase(), {
    fontSize: 36,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.19,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.40, 0.01);
  group.add(nameSprite);

  // Description text - increased proportionally with proper maxWidth
  const descSprite = makeSprite(upgrade.desc, {
    fontSize: 26,
    color: '#cccccc',
    scale: 0.15,
    depthTest: true,
    maxWidth: 280,
  });
  descSprite.position.set(0, -0.02, 0.01);
  group.add(descSprite);

  // Side-grade note (different color) when present
  if (upgrade.sideGradeNote) {
    const noteSprite = makeSprite(upgrade.sideGradeNote, {
      fontSize: 22,
      color: '#ffdd00',
      scale: 0.14,
      depthTest: true,
      maxWidth: 280,
    });
    noteSprite.position.set(0, -0.28, 0.01);
    group.add(noteSprite);
  }'''

content = content.replace(old_upg_card, new_upg_card)

# FIX 5: Update skip card font sizes
old_skip_card = '''  // "SKIP" text
  const nameSprite = makeSprite('SKIP', {
    fontSize: 28,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.2,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.25, 0.01);
  group.add(nameSprite);

  // Description
  const descSprite = makeSprite('Full health', {
    fontSize: 18,
    color: '#88ffaa',
    scale: 0.12,
    depthTest: true,
    maxWidth: 120,
  });
  descSprite.position.set(0, -0.02, 0.01);
  group.add(descSprite);'''

new_skip_card = '''  // "SKIP" text - increased proportionally
  const nameSprite = makeSprite('SKIP', {
    fontSize: 40,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.2,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.30, 0.01);
  group.add(nameSprite);

  // Description
  const descSprite = makeSprite('Full health', {
    fontSize: 26,
    color: '#88ffaa',
    scale: 0.14,
    depthTest: true,
    maxWidth: 220,
  });
  descSprite.position.set(0, 0.02, 0.01);
  group.add(descSprite);'''

content = content.replace(old_skip_card, new_skip_card)

# Write the fixed file
with open('/home/graeme/Github/vr-roguelike.worktrees/feature/111-fix-upgrade-cards/hud.js', 'w') as f:
    f.write(content)

print("✓ Fixed upgrade card issues:")
print("  1. Added dynamic canvas padding for glow effects")
print("  2. Increased upgrade card font sizes: name 21→36, desc 16→26, sideGrade 16→22")
print("  3. Increased upgrade card maxWidth: 200→280")
print("  4. Increased skip card font sizes: name 28→40, desc 18→26")
print("  5. Increased skip card maxWidth: 120→220")
print("  6. Adjusted text positions for better spacing")
