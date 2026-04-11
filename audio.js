// ============================================================
//  AUDIO SYSTEM - 8-bit Web Audio procedural sounds
// ============================================================

let audioCtx = null;

const skipStreamingAudio = typeof navigator !== 'undefined' && navigator.webdriver;
let loggedStreamingSkip = false;
function shouldStreamRemoteAudio() {
  if (typeof window !== 'undefined' && window.debugForceStreamingAudio) return true;
  if (!skipStreamingAudio) return true;
  if (!loggedStreamingSkip) {
    console.log('[audio] Skipping remote streaming audio under automation (navigator.webdriver=true)');
    loggedStreamingSkip = true;
  }
  return false;
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Create SFX master gain node for volume control
    sfxMasterGain = audioCtx.createGain();
    sfxMasterGain.gain.value = sfxVolume;
    sfxMasterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

// ── Volume Settings (persisted to localStorage) ──────────
const SETTINGS_KEY = 'vr-roguelike-settings';
let sfxMasterGain = null;
let sfxVolume = 1.0;   // 0-1, default 100%

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.musicVolume === 'number') {
        musicVolume = s.musicVolume / 100;
      }
      if (typeof s.sfxVolume === 'number') {
        sfxVolume = s.sfxVolume / 100;
      }
    }
  } catch (e) { /* ignore */ }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      musicVolume: Math.round(musicVolume * 100),
      sfxVolume: Math.round(sfxVolume * 100),
    }));
  } catch (e) { /* ignore */ }
}

// loadSettings() is called after musicVolume is declared below

export function getMusicVolume() {
  return Math.round(musicVolume * 100);
}

export function getSFXVolume() {
  return Math.round(sfxVolume * 100);
}

export function setMusicVolume(pct) {
  pct = Math.max(0, Math.min(100, Math.round(pct / 5) * 5));
  musicVolume = pct / 100;
  if (currentMusic) {
    currentMusic.volume = musicVolume;
  }
  saveSettings();
  return pct;
}

export function setSFXVolume(pct) {
  pct = Math.max(0, Math.min(100, Math.round(pct / 5) * 5));
  sfxVolume = pct / 100;
  if (sfxMasterGain) {
    sfxMasterGain.gain.value = sfxVolume;
  }
  saveSettings();
  return pct;
}

// Returns the master SFX gain node (or destination if not yet created)
function getSfxOutput() {
  return sfxMasterGain || getAudioContext().destination;
}

function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

// ── Shoot sound (laser pew) — heavily randomized ───────────
export function playShoothSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Randomize everything: base frequency, pitch sweep, waveform, duration
  const baseFreqs = [600, 700, 800, 900, 1000, 1100];
  const baseFreq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
  const pitch = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
  const duration = 0.06 + Math.random() * 0.08;  // 60-140ms
  const waveforms = ['square', 'sawtooth', 'triangle'];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveforms[Math.floor(Math.random() * waveforms.length)];

  // Randomize sweep direction: most go down, some go up
  if (Math.random() < 0.8) {
    osc.frequency.setValueAtTime(baseFreq * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(150 * pitch, t + duration);
  } else {
    osc.frequency.setValueAtTime(300 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * pitch, t + duration * 0.5);
    osc.frequency.exponentialRampToValueAtTime(200 * pitch, t + duration);
  }

  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + duration);

  // 30% chance: layer a second oscillator for "fat" laser sound
  if (Math.random() < 0.3) {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = waveforms[Math.floor(Math.random() * waveforms.length)];
    osc2.frequency.setValueAtTime(baseFreq * pitch * (1.5 + Math.random()), t);
    osc2.frequency.exponentialRampToValueAtTime(100, t + duration);
    gain2.gain.setValueAtTime(0.06, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc2.connect(gain2);
    gain2.connect(getSfxOutput());
    osc2.start(t);
    osc2.stop(t + duration);
  }
}

// ── Seeker Burst sound (synth pew via Web Audio API) ──────────────
export function playSeekerBurstSound(isLastShot = false, totalShots = 3, burstIndex = 0) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const duration = 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + duration);
    gain.gain.setValueAtTime(0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + duration);
  } catch (e) {
    // Ignore audio failures silently
  }
}


// ── Charge Sound System (Mega Man style) ────────────────────────────────────────
// Per-hand oscillators for charge feedback
const chargeOscillators = [null, null];
const chargeGains = [null, null];
const chargeLfoOscillators = [null, null];
const chargeLfoGains = [null, null];
let chargeAudioCtx = null;

/**
 * Start the charge sound when trigger is pressed.
 * @param {number} handIndex - 0 for left, 1 for right
 */
export function startChargeSound(handIndex = 0) {
  const ctx = getAudioContext();
  if (!chargeAudioCtx) chargeAudioCtx = ctx;

  // Stop any existing charge sound for this hand
  stopChargeSound(handIndex);

  const t = ctx.currentTime;

  // Main oscillator - starts low, rises as charge increases
  const mainOsc = ctx.createOscillator();
  mainOsc.type = 'sawtooth';
  mainOsc.frequency.setValueAtTime(80, t);  // Start at 80Hz (low hum)

  // Gain for main oscillator
  const mainGain = ctx.createGain();
  mainGain.gain.setValueAtTime(0.05, t);  // Start quiet

  // LFO for pulsing effect (classic Mega Man "wub wub wub")
  const lfoOsc = ctx.createOscillator();
  lfoOsc.type = 'sine';
  lfoOsc.frequency.setValueAtTime(4, t);  // 4 pulses per second initially

  // LFO gain (modulation depth)
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0.03, t);  // Subtle initial pulse

  // Filter to shape the sound
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, t);
  filter.Q.setValueAtTime(5, t);

  // Connect: LFO modulates main oscillator frequency
  lfoOsc.connect(lfoGain);
  lfoGain.connect(mainOsc.frequency);

  // Main oscillator path
  mainOsc.connect(filter);
  filter.connect(mainGain);
  mainGain.connect(getSfxOutput());

  // Start oscillators
  mainOsc.start(t);
  lfoOsc.start(t);

  // Store references
  chargeOscillators[handIndex] = mainOsc;
  chargeGains[handIndex] = mainGain;
  chargeLfoOscillators[handIndex] = lfoOsc;
  chargeLfoGains[handIndex] = lfoGain;

  // Store additional nodes for updating
  mainOsc.userData = { filter, lfoOsc, startTime: t };
}

/**
 * Update the charge sound based on charge progress (0-1).
 * Pitch rises, pulse rate increases, volume grows.
 * @param {number} handIndex - 0 for left, 1 for right
 * @param {number} progress - Charge progress from 0 to 1
 */
export function updateChargeSound(handIndex = 0, progress = 0) {
  const ctx = chargeAudioCtx || getAudioContext();
  const osc = chargeOscillators[handIndex];
  const gain = chargeGains[handIndex];
  const lfoOsc = chargeLfoOscillators[handIndex];
  const lfoGain = chargeLfoGains[handIndex];

  if (!osc || !gain || !lfoOsc || !lfoGain) return;

  const t = ctx.currentTime;

  // Frequency ramps from 80Hz to 400Hz based on charge
  const targetFreq = 80 + progress * 320;
  osc.frequency.linearRampToValueAtTime(targetFreq, t + 0.05);

  // Volume increases with charge (0.05 to 0.25)
  const targetVolume = 0.05 + progress * 0.20;
  gain.gain.linearRampToValueAtTime(targetVolume, t + 0.05);

  // LFO pulse rate increases (4Hz to 15Hz as charge builds)
  const targetLfoRate = 4 + progress * 11;
  lfoOsc.frequency.linearRampToValueAtTime(targetLfoRate, t + 0.05);

  // LFO modulation depth increases
  const targetLfoDepth = 0.03 + progress * 0.12;
  lfoGain.gain.linearRampToValueAtTime(targetLfoDepth, t + 0.05);

  // Filter opens up for brighter sound at high charge
  if (osc.userData.filter) {
    const targetFilterFreq = 300 + progress * 2000;
    osc.userData.filter.frequency.linearRampToValueAtTime(targetFilterFreq, t + 0.05);
  }
}

/**
 * Stop the charge sound (when shot is fired or cancelled).
 * @param {number} handIndex - 0 for left, 1 for right
 */
export function stopChargeSound(handIndex = 0) {
  const ctx = chargeAudioCtx || getAudioContext();
  const t = ctx.currentTime;

  const osc = chargeOscillators[handIndex];
  const lfoOsc = chargeLfoOscillators[handIndex];

  if (osc) {
    try {
      osc.stop(t + 0.05);
    } catch (e) {
      // Already stopped
    }
    chargeOscillators[handIndex] = null;
  }

  if (lfoOsc) {
    try {
      lfoOsc.stop(t + 0.05);
    } catch (e) {
      // Already stopped
    }
    chargeLfoOscillators[handIndex] = null;
  }

  chargeGains[handIndex] = null;
  chargeLfoGains[handIndex] = null;
}

/**
 * Play the fully charged "ready" sound (high-pitched sustained tone).
 * @param {number} handIndex - 0 for left, 1 for right
 */
export function playChargeReadySound(handIndex = 0) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // High-pitched "ready" beep
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.setValueAtTime(1100, t + 0.05);
  osc.frequency.setValueAtTime(1320, t + 0.1);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.setValueAtTime(0.15, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

  osc.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.3);
}

/**
 * Play the charge shot release sound (powerful blast).
 * @param {number} progress - Charge progress (affects sound intensity)
 */
export function playChargeFireSound(progress = 0) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Base intensity scales with charge
  const intensity = 0.5 + progress * 0.5;

  // Main blast oscillator
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200 + progress * 300, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

  gain.gain.setValueAtTime(0.3 * intensity, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.3);

  // Add noise burst for impact
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.playbackRate.value = 0.8 + progress * 0.4;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2 * intensity, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

  noise.connect(noiseGain);
  noiseGain.connect(getSfxOutput());
  noise.start(t);
}

// ── Enemy hit sound — heavily randomized ───────────────────
let lastHitSound = 0;
export function playHitSound() {
  const now = performance.now();
  if (now - lastHitSound < 30) return; // 30ms throttle
  lastHitSound = now;
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const baseFreqs = [300, 400, 500, 600];
  const baseFreq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
  const pitch = 0.2 + Math.random() * 1.6;
  const duration = 0.05 + Math.random() * 0.08;
  const hitWaves = ['sawtooth', 'square', 'triangle'];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = hitWaves[Math.floor(Math.random() * hitWaves.length)];
  osc.frequency.setValueAtTime(baseFreq * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(80 * pitch, t + duration);

  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  // Add a resonant filter for more tonal variety
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500 + Math.random() * 2000, t);
  filter.Q.setValueAtTime(1 + Math.random() * 4, t);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + duration);
}

// ── Enemy death explosion ──────────────────────────────────
// Pre-create noise buffer to avoid GC pauses
let explosionBuffer = null;

function getExplosionBuffer() {
  if (!explosionBuffer) {
    const ctx = getAudioContext();
    explosionBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = explosionBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return explosionBuffer;
}

let lastExplosionSound = 0;
export function playExplosionSound() {
  const now = performance.now();
  if (now - lastExplosionSound < 30) return; // 30ms throttle
  lastExplosionSound = now;
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = getExplosionBuffer();
  // Very wide playback rate variation for unique explosions
  noise.playbackRate.value = 0.3 + Math.random() * 1.4;

  const duration = 0.15 + Math.random() * 0.3;  // 150-450ms

  const filter = ctx.createBiquadFilter();
  // Randomly choose filter type for different explosion characters
  filter.type = Math.random() < 0.7 ? 'lowpass' : 'bandpass';
  const filterPitch = 0.3 + Math.random() * 1.4;
  filter.frequency.setValueAtTime(2500 * filterPitch, t);
  filter.frequency.exponentialRampToValueAtTime(40, t + duration);
  filter.Q.setValueAtTime(0.5 + Math.random() * 3, t);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  noise.start(t);
  noise.stop(t + duration);

  // 40% chance: add a tonal "boom" underneath for bigger feel
  if (Math.random() < 0.4) {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + duration);
    oscGain.gain.setValueAtTime(0.1, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.8);
    osc.connect(oscGain);
    oscGain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + duration);
  }
}

// ── Player damage ──────────────────────────────────────────
export function playDamageSound() {
  // Minecraft-style "OUCH" - sharp static crack with extended decay
  // Extended from 0.12s to 0.22s for better feedback feel
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // 1. WHITE NOISE BURST - the "crack" sound (like Minecraft hit)
  const noiseBufferSize = Math.floor(ctx.sampleRate * 0.22); // 220ms (extended from 120ms)
  const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    noiseData[i] = Math.random() * 2 - 1; // White noise
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // Sharp bandpass filter for "crack" character
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(2000, t); // Mid-high crack
  noiseFilter.Q.setValueAtTime(2, t);

  // Noise envelope: INSTANT attack, extended decay
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, t); // LOUD initial crack
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15); // Extended decay

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(getSfxOutput());

  noise.start(t);
  noise.stop(t + 0.22);

  // 2. LOW THUMP - body impact feel (extended decay)
  const thumpOsc = ctx.createOscillator();
  thumpOsc.type = 'sine';
  thumpOsc.frequency.setValueAtTime(150, t);
  thumpOsc.frequency.exponentialRampToValueAtTime(40, t + 0.2); // Extended drop

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.4, t); // Strong initial thump
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2); // Extended decay

  thumpOsc.connect(thumpGain);
  thumpGain.connect(getSfxOutput());

  thumpOsc.start(t);
  thumpOsc.stop(t + 0.2);

  // 3. HIGH CRACK - add sharpness (like a whip crack)
  const crackOsc = ctx.createOscillator();
  crackOsc.type = 'square';
  crackOsc.frequency.setValueAtTime(800, t);
  crackOsc.frequency.exponentialRampToValueAtTime(100, t + 0.08); // Extended drop

  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.15, t);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // Extended decay

  crackOsc.connect(crackGain);
  crackGain.connect(getSfxOutput());

  crackOsc.start(t);
  crackOsc.stop(t + 0.08);
}

// ── Enemy/Boss Projectile Fire Sound ─────────────────────────
export function playEnemyProjectileSound() {
  // Distinct sound when enemies/bosses fire projectiles
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc2.type = 'triangle';
  filter.type = 'bandpass';

  // Rising pitch - projectile launch feel
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);
  osc2.frequency.setValueAtTime(400, t);
  osc2.frequency.exponentialRampToValueAtTime(600, t + 0.08);

  filter.frequency.setValueAtTime(1200, t);
  filter.Q.setValueAtTime(6, t);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.12);
  osc2.stop(t + 0.12);
}

// ── Boss projectile fired sound (beefier than regular enemy shots) ──
export function playBossProjectileFiredSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  filter.type = 'lowpass';

  // Bass punch with pitch falloff + rising mid tone that drops away
  osc1.frequency.setValueAtTime(160, t);
  osc1.frequency.exponentialRampToValueAtTime(50, t + 0.25);
  osc2.frequency.setValueAtTime(400, t);
  osc2.frequency.exponentialRampToValueAtTime(180, t + 0.2);

  filter.frequency.setValueAtTime(1200, t);
  filter.frequency.exponentialRampToValueAtTime(300, t + 0.25);
  filter.Q.setValueAtTime(2, t);

  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + 0.25);
  osc2.stop(t + 0.25);
}

// ── Boss projectile proximity alert (Geiger-counter style) ──
export function playBossProjectileAlertSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'square';
  filter.type = 'highpass';

  // Short, sharp warning click
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.04);

  filter.frequency.setValueAtTime(600, t);
  filter.Q.setValueAtTime(8, t);

  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.05);
}

// ── Enemy projectile proximity warning ───────────────────────
export function playProjectileWarningSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'square';
  filter.type = 'bandpass';

  // Short, bright double-chirp.
  osc.frequency.setValueAtTime(1250, t);
  osc.frequency.exponentialRampToValueAtTime(1650, t + 0.04);

  filter.frequency.setValueAtTime(1900, t);
  filter.Q.setValueAtTime(8, t);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.12, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

  gain.gain.setValueAtTime(0.0001, t + 0.085);
  gain.gain.linearRampToValueAtTime(0.10, t + 0.089);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.16);
}

// ── Heal Sound (Vampiric/Health Pickup) ─────────────────────
export function playHealSound() {
  // Bright upgrade/heal sound with rising pitch and sparkle
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Rising base tone (sine, C5→E5)
  const base = ctx.createOscillator();
  base.type = 'sine';
  base.frequency.setValueAtTime(523, t);       // C5
  base.frequency.linearRampToValueAtTime(659, t + 0.15);  // E5
  const baseGain = ctx.createGain();
  baseGain.gain.setValueAtTime(0.25, t);
  baseGain.gain.linearRampToValueAtTime(0.3, t + 0.08);
  baseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  base.connect(baseGain);
  baseGain.connect(getSfxOutput());
  base.start(t);
  base.stop(t + 0.35);

  // Bright arpeggio (triangle, E5→G#5→B5)
  const mid = ctx.createOscillator();
  mid.type = 'triangle';
  mid.frequency.setValueAtTime(659, t + 0.04);     // E5
  mid.frequency.setValueAtTime(831, t + 0.1);      // G#5
  mid.frequency.setValueAtTime(988, t + 0.16);     // B5
  const midGain = ctx.createGain();
  midGain.gain.setValueAtTime(0.2, t + 0.04);
  midGain.gain.linearRampToValueAtTime(0.22, t + 0.12);
  midGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  mid.connect(midGain);
  midGain.connect(getSfxOutput());
  mid.start(t + 0.04);
  mid.stop(t + 0.35);

  // High sparkle (sine, C6→E6)
  const high = ctx.createOscillator();
  high.type = 'sine';
  high.frequency.setValueAtTime(1047, t + 0.08);   // C6
  high.frequency.linearRampToValueAtTime(1319, t + 0.2);  // E6
  const highGain = ctx.createGain();
  highGain.gain.setValueAtTime(0.12, t + 0.08);
  highGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  high.connect(highGain);
  highGain.connect(getSfxOutput());
  high.start(t + 0.08);
  high.stop(t + 0.3);
}

// ── Level complete victory fanfare ──────────────────────────────
export function playLevelCompleteSound() {
  // Triumphant ascending major chord arpeggio with sparkle
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Main arpeggio oscillators (sine + triangle for bright timbre)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  // C major arpeggio ascending: C4 -> E4 -> G4 -> C5 -> E5 -> G5 -> C6
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
  const noteDuration = 0.08; // 80ms per note

  // Schedule arpeggio on both oscillators
  for (let i = 0; i < notes.length; i++) {
    const noteTime = t + i * noteDuration;
    osc1.frequency.setValueAtTime(notes[i], noteTime);
    osc2.frequency.setValueAtTime(notes[i], noteTime);
  }

  // Volume envelope - swell then decay
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.1);
  gain.gain.setValueAtTime(0.25, t + 0.4);
  gain.gain.linearRampToValueAtTime(0.15, t + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(getSfxOutput());

  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + 0.65);
  osc2.stop(t + 0.65);

  // Sparkle/shimmer at the end (quick high-frequency burst)
  const sparkleOsc = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkleOsc.type = 'sine';

  // Quick descending sparkles: C7 -> B6 -> A6 -> G6
  const sparkleNotes = [2093.00, 1975.53, 1760.00, 1567.98];
  for (let i = 0; i < sparkleNotes.length; i++) {
    sparkleOsc.frequency.setValueAtTime(sparkleNotes[i], t + 0.55 + i * 0.04);
  }

  sparkleGain.gain.setValueAtTime(0, t + 0.55);
  sparkleGain.gain.linearRampToValueAtTime(0.15, t + 0.6);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

  sparkleOsc.connect(sparkleGain);
  sparkleGain.connect(getSfxOutput());

  sparkleOsc.start(t + 0.55);
  sparkleOsc.stop(t + 0.75);
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
  gain.connect(getSfxOutput());

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
  gain.connect(getSfxOutput());

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// ── Mortar enemy spawn alert (low rumble + ping) ──────────
export function playMortarEnemySpawn() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc2.type = 'sine';

  // Low rumble descending + high ping
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
  osc2.frequency.setValueAtTime(800, t);
  osc2.frequency.setValueAtTime(1000, t + 0.05);
  osc2.frequency.setValueAtTime(600, t + 0.1);

  gain.gain.setValueAtTime(0.2, t);
  gain.gain.setValueAtTime(0.15, t + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.3);
  osc2.stop(t + 0.3);
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
  panner.connect(getSfxOutput());

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
  panner.connect(getSfxOutput());

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// ── Basic enemy spawn ──────────────────────────────────────
export function playBasicEnemySpawn() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

// ── Tank enemy spawn ───────────────────────────────────────
export function playTankEnemySpawn() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, ctx.currentTime);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ── Boss spawn/alert ───────────────────────────────────────
export function playBossSpawn() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Create a deep, menacing drone
  [40, 60, 80].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 1 ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 1.5);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + 1.5);
  });
}

export function playBossAlertSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Three urgent beeps
  for (let i = 0; i < 3; i++) {
    const beepTime = t + i * 0.7;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, beepTime);
    osc.frequency.setValueAtTime(1000, beepTime + 0.1);
    osc.frequency.setValueAtTime(800, beepTime + 0.2);

    gain.gain.setValueAtTime(0.25, beepTime);
    gain.gain.setValueAtTime(0.25, beepTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, beepTime + 0.35);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(beepTime);
    osc.stop(beepTime + 0.35);
  }
}

// ── Final boss custom SFX ──────────────────────────────────
// These sounds are intentionally short and layered so the fight feels distinct
// without touching the music system or creating long CPU-heavy synth graphs.
export function playFinalBossAwakenSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [70, 105, 140].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = i === 1 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.8, t + 0.9);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420 + i * 180, t);
    filter.frequency.exponentialRampToValueAtTime(1600 + i * 220, t + 0.7);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getSfxOutput());

    osc.start(t);
    osc.stop(t + 1.0);
  });
}

export function playFinalBossSealBreakSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [960, 720, 540].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.04);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.28 + i * 0.02);

    gain.gain.setValueAtTime(0.08, t + i * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32 + i * 0.04);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + i * 0.04);
    osc.stop(t + 0.36 + i * 0.04);
  });
}

export function playFinalBossChargeSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc2.type = 'square';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(260, t + 1.1);
  osc2.frequency.setValueAtTime(55, t);
  osc2.frequency.exponentialRampToValueAtTime(96, t + 1.1);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(180, t);
  filter.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
  filter.Q.setValueAtTime(4.5, t);

  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.14, t + 0.2);
  gain.gain.linearRampToValueAtTime(0.1, t + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 1.2);
  osc2.stop(t + 1.2);
}

export function playFinalBossAscendSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [180, 270, 360].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 2.4, t + 0.9);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.16);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + 1.4);
  });
}

export function playFinalBossExposeSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [320, 480, 720].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq * 0.75, t + i * 0.04);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.22 + i * 0.03);

    gain.gain.setValueAtTime(0.0, t + i * 0.04);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.05 + i * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45 + i * 0.04);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + i * 0.04);
    osc.stop(t + 0.5 + i * 0.04);
  });
}

export function playFinalBossSummonWallSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 1.3);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(250, t);
  filter.frequency.exponentialRampToValueAtTime(1200, t + 1.1);
  filter.Q.setValueAtTime(6, t);

  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.13, t + 0.25);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.9);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.45);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 1.5);
}

export function playFinalBossReleaseWallSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [140, 210, 280].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 2 ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.4);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 0.04 + i * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55 + i * 0.03);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + i * 0.03);
    osc.stop(t + 0.6 + i * 0.03);
  });
}

export function playFinalBossCollapseGroan() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 1.8);

  mod.type = 'sine';
  mod.frequency.setValueAtTime(16, t);
  modGain.gain.setValueAtTime(18, t);
  modGain.gain.exponentialRampToValueAtTime(4, t + 1.8);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(160, t + 1.7);

  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 0.2);
  gain.gain.linearRampToValueAtTime(0.1, t + 1.0);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

  mod.connect(modGain);
  modGain.connect(osc.frequency);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  mod.start(t);
  osc.stop(t + 2.0);
  mod.stop(t + 2.0);
}

export function playFinalBossVictorySting() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [440, 554.37, 659.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 2 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.08);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.75 + i * 0.04);

    gain.gain.setValueAtTime(0.0, t + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.08, t + i * 0.08 + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1 + i * 0.05);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + i * 0.08);
    osc.stop(t + 1.15 + i * 0.05);
  });
}

// ── Menu / UI Interaction ──────────────────────────────────
export function playMenuClick() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.04);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start();
  osc.stop(ctx.currentTime + 0.04);
}

export function playMenuHoverSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, t);
  // #4: Increased volume from 0.05 to 0.12 for better audibility
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.04);
}

// ── Error / Rejection sound ────────────────────────────────
export function playErrorSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.setValueAtTime(100, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

// ── Buckshot fire (heavy mechanical thud) ──────────────────
export function playBuckshotSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Low heavy thump
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.15);

  // Metallic "clack"
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(800, t);
  osc2.frequency.exponentialRampToValueAtTime(200, t + 0.05);
  gain2.gain.setValueAtTime(0.08, t);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
  osc2.connect(gain2);
  gain2.connect(getSfxOutput());
  osc2.start(t);
  osc2.stop(t + 0.05);
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
  gain.connect(getSfxOutput());

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

// ── Ting Sound (metallic ping for immune hits) ───────────
export function playTingSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // High-pitched metallic ping - like hitting a metal shield
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  // Main tone - high pitched sine
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);

  // Harmonic - adds metallic character
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2400, t);
  osc2.frequency.exponentialRampToValueAtTime(1600, t + 0.08);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.15);
  osc2.stop(t + 0.15);
}

// ── Kill Chain Sound (increases with multiplier) ───────────
export function playComboSound(multiplier) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Different sound profiles based on multiplier level
  if (multiplier >= 5) {
    // x5+: Epic fanfare - triumphant chord
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.connect(gain);
      gain.connect(getSfxOutput());
      osc.start(t + i * 0.05);
      osc.stop(t + 0.5);
    });
  } else if (multiplier >= 4) {
    // x4: Triumphant chime - ascending arpeggio
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(getSfxOutput());
      osc.start(t + i * 0.06);
      osc.stop(t + 0.3);
    });
  } else if (multiplier >= 3) {
    // x3: Exciting ding - bright bell
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1108.73, t + 0.05);
    osc.frequency.setValueAtTime(1318.51, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + 0.25);
  } else {
    // x2: Satisfying pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + 0.15);
  }
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
  gain.connect(getSfxOutput());

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.8);
}

// ── Bullet-time ramp-up (when all nearby enemies cleared) ───
export function playSlowMoReverseSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.5);

  gain.gain.setValueAtTime(0.01, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

  osc.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.5);
}

// ── Kills remaining alert sound ────────────────────────────────
export function playKillsAlertSound(remaining = null) {
  if (remaining === 5 || remaining === 10 || remaining === 15 || remaining === 20) {
    const audio = new Audio(`https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_${remaining}-kills-remaining.mp3`);
    audio.volume = 0.5 * sfxVolume;
    audio.play().catch(err => {
      console.warn('[audio] Failed to play kills remaining clip:', err);
    });
    return;
  }

  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(208, t);
  osc.frequency.linearRampToValueAtTime(520, t + 0.47);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0);
  gain.gain.setValueAtTime(0.25, t + 0.058);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.47);

  osc.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.47);
}

// ── Incoming boss alert sound ──────────────────────────────────
export function playIncomingBossSound() {
  if (!shouldStreamRemoteAudio()) return;
  const audio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_incoming-boss.mp3');
  audio.volume = 0.5 * sfxVolume;
  audio.play().catch(err => console.warn('[audio] Failed to play incoming boss clip:', err));
}

// ── No one makes it to level 20 sound ──────────────────────────
export function playNoOneMakesItSound() {
  const audio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_no-one-makes-it-to-level-20.mp3');
  audio.volume = 0.5 * sfxVolume;
  audio.play().catch(err => console.warn('[audio] Failed to play name entry clip:', err));
}

// ── Low health warning loop (gentle pulse) ────────────────────
let lowHealthOsc = null;
let lowHealthGain = null;
let lowHealthLfo = null;
let lowHealthLfoGain = null;

export function startLowHealthWarningSound() {
  if (lowHealthOsc) return;

  const ctx = getAudioContext();
  const t = ctx.currentTime;

  lowHealthOsc = ctx.createOscillator();
  lowHealthGain = ctx.createGain();
  lowHealthLfo = ctx.createOscillator();
  lowHealthLfoGain = ctx.createGain();

  lowHealthOsc.type = 'triangle';
  lowHealthOsc.frequency.setValueAtTime(220, t);

  lowHealthLfo.type = 'sine';
  lowHealthLfo.frequency.setValueAtTime(1.2, t);

  lowHealthGain.gain.setValueAtTime(0.03, t);
  lowHealthLfoGain.gain.setValueAtTime(0.02, t);

  lowHealthLfo.connect(lowHealthLfoGain);
  lowHealthLfoGain.connect(lowHealthGain.gain);

  lowHealthOsc.connect(lowHealthGain);
  lowHealthGain.connect(getSfxOutput());

  lowHealthOsc.start(t);
  lowHealthLfo.start(t);
}

export function stopLowHealthWarningSound() {
  if (!lowHealthOsc) return;

  const ctx = getAudioContext();
  const stopTime = ctx.currentTime + 0.12;

  lowHealthGain.gain.cancelScheduledValues(ctx.currentTime);
  lowHealthGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);

  lowHealthOsc.stop(stopTime);
  lowHealthLfo.stop(stopTime);

  lowHealthOsc = null;
  lowHealthGain = null;
  lowHealthLfo = null;
  lowHealthLfoGain = null;
}

// ── Lightning beam continuous sound (MP3 loop with Web Audio API) ─────────────
let lightningAudio = null;
let lightningSource = null;
let lightningGain = null;
let lightningVolumeTimeout = null;

export function startLightningSound() {
  if (lightningSource) return;  // Already playing

  const ctx = getAudioContext();
  
  // Create audio element and source
  lightningAudio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_lightning_loop.mp3');
  lightningAudio.loop = true;
  lightningAudio.crossOrigin = 'anonymous';
  
  // Create MediaElementSource and GainNode for volume control
  lightningSource = ctx.createMediaElementSource(lightningAudio);
  lightningGain = ctx.createGain();
  
  // Set normal gain (volume boosted in MP3 file)
  lightningGain.gain.setValueAtTime(1.0, ctx.currentTime);
  
  // Connect: source -> gain -> destination
  lightningSource.connect(lightningGain);
  lightningGain.connect(getSfxOutput());
  
  // Start playback
  lightningAudio.play().catch(err => {
    console.warn('[audio] Lightning loop playback failed:', err);
  });

  // After 4 seconds of continuous play, ease volume down slightly
  lightningVolumeTimeout = setTimeout(() => {
    if (lightningGain) {
      lightningGain.gain.setValueAtTime(0.8, ctx.currentTime);
      console.log('[audio] Lightning volume eased (4s continuous)');
    }
  }, 4000);
}

export function stopLightningSound() {
  if (lightningAudio) {
    lightningAudio.pause();
    lightningAudio.currentTime = 0;
    lightningAudio = null;
  }
  if (lightningSource) {
    lightningSource.disconnect();
    lightningSource = null;
  }
  if (lightningGain) {
    lightningGain.disconnect();
    lightningGain = null;
  }
  if (lightningVolumeTimeout) {
    clearTimeout(lightningVolumeTimeout);
    lightningVolumeTimeout = null;
  }
}

// ── Music System ───────────────────────────────────────────
let currentMusic = null;
let musicVolume = 0.33;
// Apply saved settings now that musicVolume is declared
loadSettings();
let currentPlaylist = [];
let currentTrackIndex = 0;
let loopPlaylist = true;  // Controls whether playlist loops (false for game over)
let musicFadeToken = 0;

const musicTracks = {
  menu: ['https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/00_Main_Menu.mp3'],
  gameOver: ['https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_game-over.mp3'],
  levels1to5: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0101_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0102_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0103_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0104_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0105_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0106_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0107_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0108_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0109_Levels_1-4.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0110_Levels_1-4.mp3'
  ],
  levels6to10: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0201_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0202_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0203_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0204_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0205_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0206_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0207_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0208_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0209_Levels_6-9.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0210_Levels_6-9.mp3'
  ],
  levels11to14: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0301_Levels_11-14.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0302_Levels_11-14.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0304_Levels_11-14.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0305_Levels_11-14.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0306_Levels_11-14.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0307_Levels_11-14.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0308_Levels_11-14.mp3'
  ],
  levels16to19: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0401_Levels_16-19.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0402_Levels_16-19.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0403_Levels_16-19.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/0404_Levels_16-19.mp3'
  ]
};

const lastBossTrack = {};

const bossTracks = {
  1: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B101_Level_05_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B102_Level_05_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B103_Level_05_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B104_Level_05_Boss.mp3'
  ],
  2: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B201_Level_10_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B202_Level_10_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B203_Level_10_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B204_Level_10_Boss.mp3'
  ],
  3: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B301_Level_15_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B302_Level_15_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B303_Level_15_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B304_Level_15_Boss.mp3'
  ],
  4: [
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B401_Level_20_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B402_Level_20_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B403_Level_20_Boss.mp3',
    'https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/B404_Level_20_Boss.mp3'
  ]
};

// Shuffle array using Fisher-Yates with crypto.getRandomValues when available (avoids same order every session)
function shuffleArray(array) {
  const shuffled = [...array];
  const n = shuffled.length;
  const getRandom = (max) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return (arr[0] / 0xffffffff) * max;
    }
    return Math.random() * max;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(getRandom(i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function playNextTrack() {
  if (currentPlaylist.length === 0) return;

  const track = currentPlaylist[currentTrackIndex];
  const token = musicFadeToken; // capture so error handler can detect stale calls
  console.log(`[music] Playing track ${currentTrackIndex + 1}/${currentPlaylist.length}: ${track}`);

  const ctx = getAudioContext();

  currentMusic = new Audio(track);
  currentMusic.volume = musicVolume;
  currentMusic.loop = false;  // Don't loop individual tracks

  // Auto-advance to next track when current ends (only if playlist looping is enabled)
  currentMusic.addEventListener('ended', () => {
    if (!loopPlaylist) return;  // Don't loop for single-play tracks like game over
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    playNextTrack();
  });

  // Handle loading errors — guard against infinite recursion if all tracks fail
  let errorRetries = 0;
  currentMusic.addEventListener('error', (e) => {
    console.warn(`[music] Failed to load: ${track}`, e);
    if (token !== musicFadeToken) return; // stale, stop was already called
    if (++errorRetries >= currentPlaylist.length) {
      console.warn('[music] All tracks failed to load, stopping playlist');
      stopCurrentMusic();
      return;
    }
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    playNextTrack();
  });

  currentMusic.play().catch(err => {
    console.warn('[music] Autoplay prevented, will start on first interaction');
  });
}

function stopCurrentMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

export function playMusic(category, loop = true) {
  stopCurrentMusic();
  musicFadeToken += 1;
  loopPlaylist = loop;  // Store loop preference
  currentPlaylist = [];
  currentTrackIndex = 0;

  if (!shouldStreamRemoteAudio()) {
    return;
  }

  // Get tracks for category (fresh copy)
  const tracks = musicTracks[category] ? [...musicTracks[category]] : [];
  if (!tracks || tracks.length === 0) return;

  // Create randomized playlist
  currentPlaylist = shuffleArray(tracks);
  currentTrackIndex = 0;

  console.log(`[music] Starting playlist for ${category} with ${currentPlaylist.length} tracks (loop: ${loop})`);
  playNextTrack();
}

export function playBossMusic(tier) {
  stopCurrentMusic();
  musicFadeToken += 1;
  currentPlaylist = [];
  currentTrackIndex = 0;

  if (!shouldStreamRemoteAudio()) {
    return;
  }

  const tracks = bossTracks[tier] ? [...bossTracks[tier]] : [];
  if (!tracks || tracks.length === 0) return;

  let track;
  if (tracks.length === 1) {
    track = tracks[0];
  } else {
    const last = lastBossTrack[tier];
    const candidates = tracks.filter(t => t !== last);
    track = candidates[Math.floor(Math.random() * candidates.length)];
  }
  lastBossTrack[tier] = track;

  currentPlaylist = [track];
  currentTrackIndex = 0;

  console.log(`[music] Starting boss track (tier ${tier}): ${track.split('/').pop()}`);
  playNextTrack();
}

export function stopMusic() {
  musicFadeToken += 1;
  stopCurrentMusic();
}

export function fadeOutMusic(durationMs = 1200) {
  if (!currentMusic) return;

  const token = ++musicFadeToken;
  const startVolume = currentMusic.volume;
  const startTime = performance.now();

  const step = () => {
    if (token !== musicFadeToken) return;
    if (!currentMusic) return;

    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    currentMusic.volume = startVolume * (1 - t);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      stopCurrentMusic();
    }
  };

  requestAnimationFrame(step);
}

// 3-2-1 countdown beep — plays on the "3" of every game-start and unpause countdown.
let countdown321Audio = null;
export function playCountdown321() {
  if (!countdown321Audio) {
    countdown321Audio = new Audio('mnt/project/music/sfx_321.m4a');
  }
  countdown321Audio.volume = 0.5 * sfxVolume;
  countdown321Audio.currentTime = 0;
  countdown321Audio.play().catch(() => {});
}

// ── Phase Wraith charge-up telegraph ───────────────────────
// Eerie rising tone played 1s before phase wraith spawns a swarm
export function playPhaseWraithCharge() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc2.type = 'sawtooth';
  filter.type = 'lowpass';

  // Ghostly rising sweep - two oscillators beat against each other
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.8);
  osc2.frequency.setValueAtTime(200, t);
  osc2.frequency.exponentialRampToValueAtTime(560, t + 0.8);

  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(2000, t + 0.6);
  filter.Q.setValueAtTime(8, t);

  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.1, t + 0.15);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.9);
  osc2.stop(t + 0.9);
}

// ── Skull Boss: Phase Transition "Angry Distortion" ────────────
// Sawtooth sweep down with bitcrusher-like gain modulation
export function playSkullPhaseSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Main sawtooth sweep 800Hz -> 100Hz
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);

  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

  // Bitcrusher: LFO modulates gain on/off at ~30Hz
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(30, t);
  lfoGain.gain.setValueAtTime(0.18, t);
  lfoGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  osc.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.6);
  lfo.stop(t + 0.6);
}

// ── Skull Boss: Hit Player "Laugh" ───────────────────────────
// Square wave rapid C4-C5 alternation for "ha-ha" effect
export function playSkullLaughSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';

  // 4 "ha" pulses: alternate C4 (262Hz) and C5 (523Hz)
  const haDuration = 0.1;
  for (let i = 0; i < 4; i++) {
    const freq = i % 2 === 0 ? 262 : 523;
    osc.frequency.setValueAtTime(freq, t + i * haDuration);
    gain.gain.setValueAtTime(0.15, t + i * haDuration);
    gain.gain.setValueAtTime(0.01, t + i * haDuration + haDuration * 0.7);
  }
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

  osc.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.4);
}

// ── Skull Boss: Hand Lost Growl ───────────────────────────────
// Low sawtooth with FM noise
export function playSkullHandGrowlSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

  // FM noise: modulate frequency with another oscillator
  const modOsc = ctx.createOscillator();
  const modGain = ctx.createGain();
  modOsc.type = 'sine';
  modOsc.frequency.setValueAtTime(120, t);
  modGain.gain.setValueAtTime(30, t);
  modGain.gain.exponentialRampToValueAtTime(5, t + 0.3);

  modOsc.connect(modGain);
  modGain.connect(osc.frequency);

  osc.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  modOsc.start(t);
  osc.stop(t + 0.3);
  modOsc.stop(t + 0.3);
}

// ── Skull Boss: Death Knell ───────────────────────────────────
// Dramatic 2.5s sweep with arpeggios and rumble
export function playSkullDeathKnell() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Layer 1: High square wave sweep 600Hz -> 40Hz over 2s
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(600, t);
  osc1.frequency.exponentialRampToValueAtTime(40, t + 2.0);
  gain1.gain.setValueAtTime(0.15, t);
  gain1.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
  osc1.connect(gain1);
  gain1.connect(getSfxOutput());
  osc1.start(t);
  osc1.stop(t + 2.5);

  // Layer 2: Rapid arpeggios (minor chord: C, Eb, G) that slow down
  const arpeggioNotes = [261.63, 311.13, 392.00]; // C4, Eb4, G4
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  gain2.gain.setValueAtTime(0.1, t);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 2.0);

  // Start fast, slow down: note intervals increase
  let noteTime = t;
  for (let i = 0; i < 16; i++) {
    const freq = arpeggioNotes[i % 3];
    const interval = 0.06 + i * 0.015; // 60ms -> ~285ms
    osc2.frequency.setValueAtTime(freq, noteTime);
    noteTime += interval;
    if (noteTime > t + 2.0) break;
  }
  osc2.connect(gain2);
  gain2.connect(getSfxOutput());
  osc2.start(t);
  osc2.stop(t + 2.5);

  // Layer 3: Final low rumble (0.5s, starting at t+2.0)
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sawtooth';
  osc3.frequency.setValueAtTime(50, t + 2.0);
  osc3.frequency.exponentialRampToValueAtTime(20, t + 2.5);
  gain3.gain.setValueAtTime(0.0, t);
  gain3.gain.setValueAtTime(0.2, t + 2.0);
  gain3.gain.exponentialRampToValueAtTime(0.01, t + 2.5);
  osc3.connect(gain3);
  gain3.connect(getSfxOutput());
  osc3.start(t);
  osc3.stop(t + 2.5);
}
