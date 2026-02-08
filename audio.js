// ============================================================
//  AUDIO SYSTEM - 8-bit Web Audio procedural sounds
// ============================================================

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// ── Shoot sound (laser pew) ────────────────────────────────
export function playShoothSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// ── Enemy hit sound ────────────────────────────────────────
export function playHitSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

// ── Enemy death explosion ──────────────────────────────────
export function playExplosionSound() {
  const ctx = getAudioContext();
  const noise = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + 0.3);
}

// ── Player damage ──────────────────────────────────────────
export function playDamageSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

// ── Fast enemy spawn alert ─────────────────────────────────
export function playFastEnemySpawn() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.setValueAtTime(1400, ctx.currentTime + 0.05);
  osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

// ── Swarm enemy spawn alert (higher pitch, faster) ─────────
export function playSwarmEnemySpawn() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1800, ctx.currentTime);
  osc.frequency.setValueAtTime(2200, ctx.currentTime + 0.03);
  osc.frequency.setValueAtTime(1800, ctx.currentTime + 0.06);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// ── Swarm proximity alert (more aggressive) ────────────────
export function playSwarmProximityAlert(pan, intensity) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();

  osc.type = 'square';
  osc.frequency.setValueAtTime(900 + intensity * 600, ctx.currentTime);

  gain.gain.setValueAtTime(Math.min(0.2 * intensity, 0.35), ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.08);

  panner.pan.setValueAtTime(pan, ctx.currentTime);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

// ── Proximity alert (panned) ───────────────────────────────
export function playProximityAlert(pan, intensity) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600 + intensity * 400, ctx.currentTime);

  gain.gain.setValueAtTime(Math.min(0.15 * intensity, 0.3), ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.1);

  panner.pan.setValueAtTime(pan, ctx.currentTime);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// ── Upgrade selected ───────────────────────────────────────
export function playUpgradeSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
  osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

// ── Bullet-time slow-down ──────────────────────────────────
export function playSlowMoSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.8);
}

// ── Lightning beam continuous sound ────────────────────────
let lightningOsc = null;
let lightningGain = null;

export function startLightningSound() {
  if (lightningOsc) return;  // Already playing

  const ctx = getAudioContext();
  lightningOsc = ctx.createOscillator();
  lightningGain = ctx.createGain();

  lightningOsc.type = 'sawtooth';
  lightningOsc.frequency.setValueAtTime(120, ctx.currentTime);

  lightningGain.gain.setValueAtTime(0.15, ctx.currentTime);

  lightningOsc.connect(lightningGain);
  lightningGain.connect(ctx.destination);

  lightningOsc.start(ctx.currentTime);
}

export function stopLightningSound() {
  if (!lightningOsc) return;

  lightningOsc.stop(lightningOsc.context.currentTime + 0.05);
  lightningOsc = null;
  lightningGain = null;
}
