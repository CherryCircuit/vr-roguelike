// ============================================================
//  AUDIO SYSTEM - 8-bit Web Audio procedural sounds
// ============================================================

let audioCtx = null;
let _musicRetryAttached = false;  // Fix: one-shot autoplay retry flag
const AUDIO_INFO_LOGS = false;
const audioInfoLog = AUDIO_INFO_LOGS ? console.log.bind(console) : () => {};

const skipStreamingAudio = typeof navigator !== 'undefined' && navigator.webdriver;
let loggedStreamingSkip = false;
function shouldStreamRemoteAudio() {
  if (typeof window !== 'undefined' && window.debugForceStreamingAudio) return true;
  if (!skipStreamingAudio) return true;
  if (!loggedStreamingSkip) {
    audioInfoLog('[audio] Skipping remote streaming audio under automation (navigator.webdriver=true)');
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
    // Fix: contexts can start 'suspended' (autoplay policy / VR session
    // switches) — try to resume so SFX don't silently die
    resumeAudioContext();
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
  // Reactive music layer master bus follows the music volume slider
  if (musicMasterGain) {
    musicMasterGain.gain.value = musicVolume;
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

// Fix: resume the AudioContext when the tab regains visibility — VR session
// switches / tab backgrounding can leave it suspended (all SFX silently die)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resumeAudioContext();
  });
}

// Export so main.js can resume on WebXR sessionstart too
export { resumeAudioContext };

// ── Shoot sound (laser pew) — heavily randomized ───────────
export function playShoothSound(projectileCount = 1) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Randomize everything: base frequency, pitch sweep, waveform, duration
  const baseFreqs = [600, 700, 800, 900, 1000, 1100];
  const baseFreq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
  const pitch = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
  const duration = 0.06 + Math.random() * 0.08;  // 60-140ms
  const waveforms = ['square', 'sawtooth', 'triangle'];

  // Scale volume by sqrt(N) instead of N to avoid audio overload
  // This gives a thicker sound for more projectiles without stacking N copies
  const volumeScale = projectileCount > 1 ? Math.min(Math.sqrt(projectileCount) / projectileCount, 1) : 1;
  const baseVol = 0.14 * volumeScale * Math.min(projectileCount, 3);

  // Stack up to 3 slightly detuned oscillators for multi-projectile "thickness"
  const layers = projectileCount > 1 ? Math.min(projectileCount, 3) : 1;

  for (let layer = 0; layer < layers; layer++) {
    const layerPitch = layer === 0 ? 1 : (0.9 + Math.random() * 0.2); // ±10% detune for extra layers
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveforms[Math.floor(Math.random() * waveforms.length)];

    // Randomize sweep direction: most go down, some go up
    if (Math.random() < 0.8) {
      osc.frequency.setValueAtTime(baseFreq * pitch * layerPitch, t);
      osc.frequency.exponentialRampToValueAtTime(150 * pitch * layerPitch, t + duration);
    } else {
      osc.frequency.setValueAtTime(300 * pitch * layerPitch, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * pitch * layerPitch, t + duration * 0.5);
      osc.frequency.exponentialRampToValueAtTime(200 * pitch * layerPitch, t + duration);
    }

    const layerVol = layer === 0 ? baseVol : baseVol * 0.4;
    gain.gain.setValueAtTime(layerVol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + duration);
  }

  // 30% chance: layer a noise-like oscillator for "fat" laser sound (only for single shots)
  if (layers === 1 && Math.random() < 0.3) {
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

// ── Nuke explosion ──────────────────────────────────────────
export function playNukeExplosionSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const duration = 2.0;

  // Low rumble oscillator: starts ~80Hz, glides down to ~20Hz with distortion
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(20, t + duration);

  // Distortion via waveshaper
  const waveshaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = (Math.PI + 20) * x / (Math.PI + 20 * Math.abs(x));
  }
  waveshaper.curve = curve;

  // Low-pass filter for rumble character
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + duration);
  filter.Q.setValueAtTime(2, t);

  // Envelope: sharp attack, long rumble decay
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.05); // quick punch
  gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  // Noise layer for texture
  const noise = ctx.createBufferSource();
  noise.buffer = getExplosionBuffer();
  noise.playbackRate.value = 0.25;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(600, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(30, t + 1.5);

  // Connect: osc -> distortion -> filter -> gain -> out
  osc.connect(waveshaper);
  waveshaper.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + duration);

  // Noise: noise -> noiseFilter -> noiseGain -> out
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(getSfxOutput());
  noise.start(t);
  noise.stop(t + 1.5);
}

// ── Player damage ──────────────────────────────────────────
let playerDamageNoiseBuffer = null;

function getPlayerDamageNoiseBuffer(ctx) {
  if (playerDamageNoiseBuffer) return playerDamageNoiseBuffer;
  const noiseBufferSize = Math.floor(ctx.sampleRate * 0.5);
  playerDamageNoiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
  const noiseData = playerDamageNoiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    // Cached harsh noise keeps player-hit SFX distinct without allocating a
    // fresh random buffer on every damage event.
    noiseData[i] = Math.random() * 2 - 1;
  }
  return playerDamageNoiseBuffer;
}

export function playDamageSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Player hurt alarm: noisy front edge plus a descending dissonant pair so it
  // reads as health loss instead of the normal weapon impact crack.
  const noise = ctx.createBufferSource();
  noise.buffer = getPlayerDamageNoiseBuffer(ctx);
  noise.playbackRate.setValueAtTime(0.9, t);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(1800, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(520, t + 0.36);
  noiseFilter.Q.setValueAtTime(3.5, t);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.38, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(getSfxOutput());
  noise.start(t);
  noise.stop(t + 0.42);

  const thumpOsc = ctx.createOscillator();
  thumpOsc.type = 'sine';
  thumpOsc.frequency.setValueAtTime(120, t);
  thumpOsc.frequency.exponentialRampToValueAtTime(34, t + 0.24);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.42, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

  thumpOsc.connect(thumpGain);
  thumpGain.connect(getSfxOutput());
  thumpOsc.start(t);
  thumpOsc.stop(t + 0.3);

  const alarmFreqs = [760, 610];
  for (let i = 0; i < alarmFreqs.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(alarmFreqs[i], t + i * 0.015);
    osc.frequency.exponentialRampToValueAtTime(180 - i * 35, t + 0.33);
    gain.gain.setValueAtTime(i === 0 ? 0.16 : 0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + i * 0.015);
    osc.stop(t + 0.36);
  }
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

// ── Eclipse Engine corruption layer (Issue #172) ────────────

/** Phase 2 trigger: deep void bass drop — the arena "opens up". */
export function playEclipsePhase2StartSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Descending bass drop (reverse-cymbal feel)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 1.1);
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 1.5);

  // Airy "void" hiss layered on top (cached noise buffer — no allocation)
  const noise = ctx.createBufferSource();
  noise.buffer = getPlayerDamageNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, t);
  filter.frequency.exponentialRampToValueAtTime(90, t + 1.2);
  noiseGain.gain.setValueAtTime(0.0, t);
  noiseGain.gain.linearRampToValueAtTime(0.09, t + 0.1);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(getSfxOutput());
  noise.start(t);
  noise.stop(t + 1.4);
}

/** Corruption activate: glitchy stutter — the upgrade "turns". */
export function playEclipseCorruptSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // 8 rapid stutter blips sweeping downward (digital corruption feel)
  for (let i = 0; i < 8; i++) {
    const start = t + i * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i % 2 === 0 ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(880 - i * 70, start);
    osc.frequency.exponentialRampToValueAtTime(320, start + 0.06);
    gain.gain.setValueAtTime(0.0, start);
    gain.gain.linearRampToValueAtTime(0.07, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(start);
    osc.stop(start + 0.07);
  }
}

/** Purge: bright ice-crack — the upgrade returns with a satisfying pop. */
export function playEclipsePurgeSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [520, 780, 1170].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 0.85, t + i * 0.03);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.1 + i * 0.03);
    gain.gain.setValueAtTime(0.0, t + i * 0.03);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.04 + i * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 + i * 0.03);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + i * 0.03);
    osc.stop(t + 0.4 + i * 0.03);
  });

  // Short noise "pop" on top (crystal crack)
  const noise = ctx.createBufferSource();
  noise.buffer = getPlayerDamageNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(2400, t);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0, t);
  ng.gain.linearRampToValueAtTime(0.06, t + 0.01);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  noise.connect(hp);
  hp.connect(ng);
  ng.connect(getSfxOutput());
  noise.start(t);
  noise.stop(t + 0.13);
}

/** Bombardier spray (Issue #199): sustained noise "whoosh" through a rising bandpass. */
/** Void Anchor planting (Issue #198): low bass thrum — the well "locks in". */
export function playVoidAnchorPlantSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.9);
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.14, t + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 1.2);
}

/** Bombardier spray (Issue #199): sustained noise "whoosh" through a rising bandpass. */
export function playBombardierSpraySound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = getPlayerDamageNoiseBuffer(ctx);
  noise.loop = true; // 0.5s cached buffer loops for the 1.5s spray
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
  filter.Q.setValueAtTime(2.5, t);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.12, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());
  noise.start(t);
  noise.stop(t + 1.3);
}

/** Eclipse self-damage: damage sound but "wrong" (detuned double-hit). */
export function playEclipseSelfDamageSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  [0, 0.045].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Detuned pair: one slightly flat, one slightly sharp — sounds corrupted
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150 - i * 12, t + offset);
    osc.frequency.exponentialRampToValueAtTime(70, t + offset + 0.18);
    gain.gain.setValueAtTime(0.0, t + offset);
    gain.gain.linearRampToValueAtTime(0.09, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.22);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t + offset);
    osc.stop(t + offset + 0.25);
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

// ── Bullet Carnival grade-up sting (Issue #189) ────────────
// Ascending arpeggio; higher tiers get a brighter, longer flourish.
export function playStyleGradeUpSound(tier = 6) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.14, t);
  master.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
  master.connect(getSfxOutput());
  // Base arpeggio rises with the grade tier (D = low, SSS = high)
  const root = 440 * Math.pow(2, (6 - Math.min(tier, 6)) / 12);
  const notes = [root, root * 1.25, root * 1.5, root * 2];
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(notes[i], t + i * 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.07 + 0.25);
    osc.connect(g);
    g.connect(master);
    osc.start(t + i * 0.07);
    osc.stop(t + i * 0.07 + 0.3);
  }
}

// ── Upgrade card preview blip (Issue #215) ─────────────────
// Short two-tone 'data readout' blip when the stat preview
// panel appears. Softer than the menu hover so it doesn't
// fight with hover sounds while sweeping the card row.
export function playUpgradePreviewSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.setValueAtTime(990, t + 0.06);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.12);
}

// ── Alchemy Bench sounds (Issue #185) ──────────────────────
// Dissolve: crystalline shatter — a fast descending arpeggio of short
// triangle blips, like an upgrade shattering into Essence.
export function playDissolveSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.12, t);
  master.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
  master.connect(getSfxOutput());
  // Descending fourths (880 → 660 → 495 → 330) — 'glass breaking' contour
  const notes = [880, 660, 495, 330];
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(notes[i], t + i * 0.045);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t + i * 0.045);
    g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.045 + 0.12);
    osc.connect(g);
    g.connect(master);
    osc.start(t + i * 0.045);
    osc.stop(t + i * 0.045 + 0.15);
  }
}

// Forge: bubbling rise into a triumphant ding — new upgrade crystallizes.
export function playForgeSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  // Bubbling: wobbling pitch ramp (essence being consumed)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.linearRampToValueAtTime(520, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, t);
  g.gain.setValueAtTime(0.05, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
  osc.connect(g);
  g.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.6);
  // Ding: bright sine at the payoff moment
  const ding = ctx.createOscillator();
  ding.type = 'sine';
  ding.frequency.setValueAtTime(1320, t + 0.45);
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0.0001, t + 0.45);
  dg.gain.exponentialRampToValueAtTime(0.15, t + 0.48);
  dg.gain.exponentialRampToValueAtTime(0.01, t + 0.9);
  ding.connect(dg);
  dg.connect(getSfxOutput());
  ding.start(t + 0.45);
  ding.stop(t + 0.95);
}

// ── Buckshot fire (heavy mechanical thud) ──────────────────
export function playBuckshotSound(pelletCount = 1) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Scale volume by sqrt(N) to convey more pellets without audio overload.
  // Cap at 3 stacked layers regardless of actual pellet count.
  const layers = Math.min(pelletCount, 3);
  const volScale = pelletCount > 1 ? Math.sqrt(pelletCount) / pelletCount : 1;

  // Low heavy thump(s) - slightly detuned for each layer
  for (let i = 0; i < layers; i++) {
    const detune = i === 0 ? 1 : (0.85 + Math.random() * 0.3); // ±15% detune
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(150 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(40 * detune, t + 0.15);
    gain.gain.setValueAtTime((i === 0 ? 0.3 : 0.12) * volScale, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(getSfxOutput());
    osc.start(t);
    osc.stop(t + 0.15);
  }

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
  const now = performance.now();
  if (now - (playTingSound._lastPlayed || 0) < 120) return; // 120ms throttle - max ~8 per second
  playTingSound._lastPlayed = now;

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
  if (!shouldStreamRemoteAudio()) return;
  const audio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_no-one-makes-it-to-level-20.mp3');
  audio.volume = 0.5 * sfxVolume;
  audio.play().catch(err => console.warn('[audio] Failed to play name entry clip:', err));
}

// ── You made it to level 20! (played when player reached level 20) ──
export function playYouMadeItSound() {
  if (!shouldStreamRemoteAudio()) return;
  const audio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_you_made_it_to_level_20.mp3');
  audio.volume = 0.6 * sfxVolume;
  audio.play().catch(err => console.warn('[audio] Failed to play victory clip:', err));
}

// ── Low health warning loop (gentle pulse) ────────────────────
let lowHealthInterval = null;

export function startLowHealthWarningSound() {
  if (lowHealthInterval) return;

  // Heartbeat-style: two quick thuds (lub-dub) every ~1 second
  function playHeartbeat() {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // Lub (first thud - slightly higher)
    const lubOsc = ctx.createOscillator();
    const lubGain = ctx.createGain();
    lubOsc.type = 'sine';
    lubOsc.frequency.setValueAtTime(80, t);
    lubOsc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
    lubGain.gain.setValueAtTime(0.2, t);
    lubGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    lubOsc.connect(lubGain);
    lubGain.connect(getSfxOutput());
    lubOsc.start(t);
    lubOsc.stop(t + 0.15);

    // Dub (second thud - slightly lower, delayed 150ms)
    const dubOsc = ctx.createOscillator();
    const dubGain = ctx.createGain();
    dubOsc.type = 'sine';
    dubOsc.frequency.setValueAtTime(60, t + 0.15);
    dubOsc.frequency.exponentialRampToValueAtTime(28, t + 0.15 + 0.1);
    dubGain.gain.setValueAtTime(0.15, t + 0.15);
    dubGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 + 0.12);
    dubOsc.connect(dubGain);
    dubGain.connect(getSfxOutput());
    dubOsc.start(t + 0.15);
    dubOsc.stop(t + 0.15 + 0.12);
  }

  playHeartbeat();
  lowHealthInterval = setInterval(playHeartbeat, 1000);
}

export function stopLowHealthWarningSound() {
  if (lowHealthInterval) {
    clearInterval(lowHealthInterval);
    lowHealthInterval = null;
  }
}

// ── Lightning beam continuous sound (MP3 loop with Web Audio API) ─────────────
let lightningAudio = null;
let lightningSource = null;
let lightningGain = null;
let lightningVolumeTimeout = null;
let lightningPaused = false;  // Track pause/resume state

export function startLightningSound() {
  // If paused, resume instead of creating new source
  if (lightningPaused && lightningAudio && lightningSource) {
    lightningAudio.play().catch(err => {
      console.warn('[audio] Lightning loop resume failed:', err);
    });
    lightningPaused = false;
    return;
  }

  if (lightningSource) return;  // Already playing

  const ctx = getAudioContext();
  
  // Create audio element and source
  lightningAudio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_lightning_loop.mp3');
  lightningAudio.loop = true;
  lightningAudio.crossOrigin = 'anonymous';
  
  // Create MediaElementSource and GainNode for volume control
  lightningSource = ctx.createMediaElementSource(lightningAudio);
  lightningGain = ctx.createGain();
  
  // Set gain to 1.5 (+50% volume)
  lightningGain.gain.setValueAtTime(1.5, ctx.currentTime);
  
  // Connect: source -> gain -> destination
  lightningSource.connect(lightningGain);
  lightningGain.connect(getSfxOutput());
  
  // Start playback
  lightningAudio.play().catch(err => {
    console.warn('[audio] Lightning loop playback failed:', err);
  });

  // After 4 seconds of continuous play, ease volume down slightly (1.2 = 0.8 * 1.5)
  lightningVolumeTimeout = setTimeout(() => {
    if (lightningGain) {
      lightningGain.gain.setValueAtTime(1.2, ctx.currentTime);
      audioInfoLog('[audio] Lightning volume eased (4s continuous)');
    }
  }, 4000);
}

export function pauseLightningSound() {
  if (lightningAudio && !lightningPaused) {
    lightningAudio.pause();
    lightningPaused = true;
  }
  if (lightningVolumeTimeout) {
    clearTimeout(lightningVolumeTimeout);
    lightningVolumeTimeout = null;
  }
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
  lightningPaused = false;
}

// ── Lightning Rod boss orb sounds ───────────────────────────
const lightningOrbChargeNodes = [null, null];

export function startLightningOrbChargeSound(handIndex = 0) {
  stopLightningOrbChargeSound(handIndex);
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const shimmer = ctx.createOscillator();
  const gain = ctx.createGain();
  const shimmerGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Boss-mode charge should not be confused with the charge cannon; this is a
  // thinner electrical whine with a bright shimmer layer.
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t);
  shimmer.type = 'square';
  shimmer.frequency.setValueAtTime(520, t);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, t);
  filter.Q.setValueAtTime(5, t);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.08);
  shimmerGain.gain.setValueAtTime(0.025, t);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());
  shimmer.connect(shimmerGain);
  shimmerGain.connect(getSfxOutput());
  osc.start(t);
  shimmer.start(t);
  lightningOrbChargeNodes[handIndex] = { ctx, osc, shimmer, gain, shimmerGain, filter };
}

export function updateLightningOrbChargeSound(handIndex = 0, progress = 0) {
  const node = lightningOrbChargeNodes[handIndex];
  if (!node) return;
  const t = node.ctx.currentTime;
  const p = Math.max(0, Math.min(1, progress));
  node.osc.frequency.setTargetAtTime(180 + p * 460, t, 0.035);
  node.shimmer.frequency.setTargetAtTime(520 + p * 880, t, 0.035);
  node.filter.frequency.setTargetAtTime(900 + p * 1600, t, 0.035);
  node.gain.gain.setTargetAtTime(0.08 + p * 0.1, t, 0.04);
  node.shimmerGain.gain.setTargetAtTime(0.02 + p * 0.04, t, 0.04);
}

export function stopLightningOrbChargeSound(handIndex = 0) {
  const node = lightningOrbChargeNodes[handIndex];
  if (!node) return;
  const t = node.ctx.currentTime;
  node.gain.gain.cancelScheduledValues(t);
  node.shimmerGain.gain.cancelScheduledValues(t);
  node.gain.gain.setTargetAtTime(0.001, t, 0.02);
  node.shimmerGain.gain.setTargetAtTime(0.001, t, 0.02);
  node.osc.stop(t + 0.08);
  node.shimmer.stop(t + 0.08);
  lightningOrbChargeNodes[handIndex] = null;
}

export function playLightningOrbFireSound(progress = 1) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const p = Math.max(0, Math.min(1, progress));
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420 + p * 260, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.24);
  gain.gain.setValueAtTime(0.18 + p * 0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.28);
}

export function startLightningOrbTravelLoop(progress = 1) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const p = Math.max(0, Math.min(1, progress));
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(170 + p * 90, t);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.035 + p * 0.025, t + 0.05);
  osc.connect(gain);
  gain.connect(getSfxOutput());
  osc.start(t);
  return { ctx, osc, gain };
}

export function stopLightningOrbTravelLoop(loop) {
  if (!loop) return;
  const t = loop.ctx.currentTime;
  loop.gain.gain.cancelScheduledValues(t);
  loop.gain.gain.setTargetAtTime(0.001, t, 0.02);
  loop.osc.stop(t + 0.08);
}

// ── Music System ───────────────────────────────────────────
let currentMusic = null;
let musicVolume = 0.33;
// Master bus for the reactive music layer (Issue #142) — follows musicVolume
let musicMasterGain = null;
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
  audioInfoLog(`[music] Playing track ${currentTrackIndex + 1}/${currentPlaylist.length}: ${track}`);

  const ctx = getAudioContext();

  currentMusic = new Audio(track);
  currentMusic.volume = musicVolume;
  currentMusic.loop = false;  // Don't loop individual tracks

  // Auto-advance to next track when current ends (only if playlist looping is enabled)
  currentMusic.addEventListener('ended', () => {
    if (!loopPlaylist) return;  // Don't loop for single-play tracks like game over
    // Don't auto-advance if a fade-out is in progress — the fade will stop the music.
    // Without this guard, a track ending mid-fade creates a new Audio at full volume,
    // causing music to pop back in during upgrade/boss transition screens.
    if (token !== musicFadeToken) return;
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
    // Fix: actually retry on first user interaction instead of never starting
    console.warn('[music] Autoplay prevented — will start on first interaction');
    if (!_musicRetryAttached) {
      _musicRetryAttached = true;
      const retry = () => {
        if (currentMusic && currentMusic.paused && currentMusic.src) {
          currentMusic.play().catch(() => {});
        }
        resumeAudioContext();
        document.removeEventListener('pointerdown', retry);
        document.removeEventListener('keydown', retry);
      };
      document.addEventListener('pointerdown', retry);
      document.addEventListener('keydown', retry);
    }
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

  audioInfoLog(`[music] Starting playlist for ${category} with ${currentPlaylist.length} tracks (loop: ${loop})`);
  playNextTrack();
}

export function playBossMusic(tier) {
  stopCurrentMusic();
  musicFadeToken += 1;
  loopPlaylist = true;
  currentPlaylist = [];
  currentTrackIndex = 0;

  if (!shouldStreamRemoteAudio()) {
    return;
  }

  const tracks = bossTracks[tier] ? [...bossTracks[tier]] : [];
  if (!tracks || tracks.length === 0) return;

  // Shuffle the full playlist for this tier
  currentPlaylist = shuffleArray(tracks);

  // Rotate so a different track starts each run (avoid repeating the same opener)
  if (currentPlaylist.length > 1) {
    const last = lastBossTrack[tier];
    if (last) {
      const lastIdx = currentPlaylist.findIndex(t => t === last);
      if (lastIdx >= 0) {
        // Rotate so the last-started track is at the end, ensuring a fresh opener
        currentPlaylist.push(...currentPlaylist.splice(0, lastIdx + 1));
      }
    }
  }

  lastBossTrack[tier] = currentPlaylist[0];
  currentTrackIndex = 0;

  audioInfoLog(`[music] Starting boss playlist (tier ${tier}) with ${currentPlaylist.length} tracks, opener: ${currentPlaylist[0].split('/').pop()}`);
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
  const musicRef = currentMusic; // Capture reference so we fade the RIGHT audio element

  // Use setTimeout instead of rAF — rAF may not fire reliably in WebXR immersive mode.
  // 50ms steps give smooth fade over 1200ms (~24 steps).
  const stepMs = 50;
  const step = () => {
    if (token !== musicFadeToken) return; // Cancelled by new play/stop

    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    musicRef.volume = startVolume * (1 - t);

    if (t < 1) {
      setTimeout(step, stepMs);
    } else {
      // Only stop if this is still the current music (not replaced by new playlist)
      if (currentMusic === musicRef) {
        stopCurrentMusic();
      }
    }
  };

  setTimeout(step, stepMs);
}

// 3-2-1 countdown beep — plays on the "3" of every game-start and unpause countdown.
let countdown321Audio = null;
export function playCountdown321() {
  if (!countdown321Audio) {
    countdown321Audio = new Audio('https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/sfx_321.mp3');
  }
  countdown321Audio.volume = 0.5 * sfxVolume;
  countdown321Audio.currentTime = 0;
  countdown321Audio.play().catch(() => {});
}

// ── Boss projectile destroy fizzle sound ────────────────────
// Short descending tone + white noise sizzle when player destroys a boss projectile
let lastBossProjDestroySound = 0;
export function playBossProjectileDestroySound() {
  const now = performance.now();
  if (now - lastBossProjDestroySound < 50) return; // 50ms throttle
  lastBossProjDestroySound = now;
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // White noise burst with fast decay (sizzle)
  const bufferSize = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.playbackRate.value = 0.6 + Math.random() * 0.3;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(3000, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.1);
  noiseFilter.Q.setValueAtTime(2, t);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.15, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(getSfxOutput());
  noise.start(t);
  noise.stop(t + 0.12);

  // Short descending tone (fizzle)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
  oscGain.gain.setValueAtTime(0.1, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(oscGain);
  oscGain.connect(getSfxOutput());
  osc.start(t);
  osc.stop(t + 0.15);
}

// ── Music Navigation (for settings menu track display) ───────

// Track title lookup (filename → display name)
const TRACK_TITLES = {
  '00_Main_Menu.mp3': 'SPACEOMICIDE Theme',
  '0101_Levels_1-4.mp3': 'Nightfall Over Paradise',
  '0102_Levels_1-4.mp3': 'Cassette Hearts',
  '0103_Levels_1-4.mp3': 'Chrome Kisses',
  '0104_Levels_1-4.mp3': 'Starhaze Avenue',
  '0105_Levels_1-4.mp3': 'Neonara',
  '0106_Levels_1-4.mp3': 'Mirror Headlights',
  '0107_Levels_1-4.mp3': 'Velvet Static',
  '0108_Levels_1-4.mp3': 'Skylush',
  '0109_Levels_1-4.mp3': 'The City Burns Magenta',
  '0110_Levels_1-4.mp3': 'Palm Parade',
  '0201_Levels_6-9.mp3': 'Nightlogic',
  '0202_Levels_6-9.mp3': 'Lucid Highway',
  '0203_Levels_6-9.mp3': 'Dreamvelocity',
  '0204_Levels_6-9.mp3': 'Radiant Overdrive',
  '0205_Levels_6-9.mp3': 'Mirrorglide',
  '0206_Levels_6-9.mp3': 'Hyperlight Memory',
  '0207_Levels_6-9.mp3': 'The Obelisk',
  '0208_Levels_6-9.mp3': 'Neurostar',
  '0209_Levels_6-9.mp3': 'Synapse Singularity',
  '0210_Levels_6-9.mp3': 'Heatwave Cruise',
  '0301_Levels_11-14.mp3': 'Synaptic Freefall',
  '0302_Levels_11-14.mp3': 'Fractaline Rush',
  '0304_Levels_11-14.mp3': 'Mouroboros',
  '0305_Levels_11-14.mp3': 'Violight',
  '0306_Levels_11-14.mp3': 'Bloodrush Panic',
  '0307_Levels_11-14.mp3': 'Pulsebreaker',
  '0308_Levels_11-14.mp3': 'Redline',
  '0401_Levels_16-19.mp3': 'Cathedral of the Machine',
  '0402_Levels_16-19.mp3': 'Anxiety Hymn',
  '0403_Levels_16-19.mp3': 'Teeth in the Abyss',
  '0404_Levels_16-19.mp3': 'Ritual Silence',
  'B101_Level_05_Boss.mp3': 'Cranium Cruise',
  'B102_Level_05_Boss.mp3': 'Neon Ossuary',
  'B103_Level_05_Boss.mp3': 'Voltage Revue',
  'B104_Level_05_Boss.mp3': 'Luxdrift',
  'B201_Level_10_Boss.mp3': 'Darkflora',
  'B202_Level_10_Boss.mp3': 'Shardwake',
  'B203_Level_10_Boss.mp3': 'Refraction Engine',
  'B204_Level_10_Boss.mp3': 'The Crystal Opens',
  'B301_Level_15_Boss.mp3': 'Neon Gore Stampede',
  'B302_Level_15_Boss.mp3': 'Predator Signal',
  'B303_Level_15_Boss.mp3': 'Velocitaur',
  'B304_Level_15_Boss.mp3': 'Choir of the Crimson',
  'B401_Level_20_Boss.mp3': 'The Devourer Descends',
  'B402_Level_20_Boss.mp3': 'Grief Titan',
  'B403_Level_20_Boss.mp3': 'The Sound of Extinction',
  'B404_Level_20_Boss.mp3': 'Pulse of the Maw',
};

export function getCurrentTrackName() {
  if (!currentMusic || !currentMusic.src) return 'No track playing';
  try {
    const url = new URL(currentMusic.src);
    const filename = url.pathname.split('/').pop();
    // Look up display title, fall back to filename without extension
    if (TRACK_TITLES[filename]) return TRACK_TITLES[filename];
    return filename.replace(/\.[^.]+$/, '');
  } catch {
    return 'Unknown';
  }
}

export function skipToNextTrack() {
  if (currentPlaylist.length === 0) return;
  musicFadeToken += 1; // Cancel any in-progress fade
  stopCurrentMusic();
  currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
  playNextTrack();
}

export function skipToPrevTrack() {
  if (currentPlaylist.length === 0) return;
  // Capture current time before stopping (stopCurrentMusic nulls currentMusic)
  const wasPlaying = currentMusic !== null;
  const elapsedTime = currentMusic ? currentMusic.currentTime : 0;
  musicFadeToken += 1; // Cancel any in-progress fade
  stopCurrentMusic();
  // If more than 3 seconds into current track, restart it instead of going back
  if (wasPlaying && elapsedTime > 3) {
    // Restart same track (keep currentTrackIndex)
  } else {
    currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
  }
  playNextTrack();
}

export function getPlaylistInfo() {
  return {
    current: currentTrackIndex + 1,
    total: currentPlaylist.length,
    name: getCurrentTrackName(),
  };
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

// ── Buffed enemy hit sound (muffled/dull thud) ──────────────
let lastBuffedHitSound = 0;
export function playBuffedHitSound() {
  const now = performance.now();
  if (now - lastBuffedHitSound < 30) return; // 30ms throttle
  lastBuffedHitSound = now;
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Muffled low thud: heavy lowpass filter, short duration
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);
  filter.Q.setValueAtTime(3, t);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxOutput());

  osc.start(t);
  osc.stop(t + 0.12);
}

// ============================================================
// REACTIVE MUSIC LAYER (Issue #142 — Hybrid 4-stem system)
// Procedural stems (ambient pad, percussion, melody, intensity)
// layered ON TOP of the streamed CDN soundtrack. All synthesis
// uses Web Audio API — no external assets. Perf: the node graph
// is created once at startReactiveMusic(); the step scheduler
// emits short oscillator bursts (cheap) and stem gains are
// crossfaded with setTargetAtTime (no per-frame allocation).
// When CDN streaming is unavailable (offline / headless), the
// stems alone provide the gameplay soundtrack.
// ============================================================

const REACTIVE_BPM = { calm: 100, combat: 120, frenzy: 140, boss: 160 };
// A minor pentatonic (A2..A4) — melody notes; index pattern below
const PENTATONIC = [110, 130.81, 146.83, 164.81, 196.0, 220, 261.63, 293.66, 329.63, 392.0];
// Deterministic 16th-note melody pattern (no Math.random in scheduler)
const MELODY_PATTERN = [0, 3, 1, 4, 2, 5, 1, 3, 0, 4, 2, 5, 3, 6, 2, 4];

let reactiveMusic = {
  running: false,
  bpm: REACTIVE_BPM.calm,
  targetBpm: REACTIVE_BPM.calm,
  intensityHigh: false,
  step: 0,
  schedulerTimer: null,
  stems: null,   // { ambient, percussion, melody, intensity } GainNodes
  drones: null,  // continuous oscillator nodes (pad + intensity)
  noiseBuffer: null,
};

// Master bus for reactive stems — follows the music volume slider
function getMusicBus() {
  if (!musicMasterGain) {
    musicMasterGain = getAudioContext().createGain();
    musicMasterGain.gain.value = musicVolume;
    musicMasterGain.connect(getAudioContext().destination);
  }
  return musicMasterGain;
}

function createReactiveStem(initialGain) {
  const g = getAudioContext().createGain();
  g.gain.value = initialGain;
  g.connect(getMusicBus());
  return g;
}

function getReactiveNoiseBuffer() {
  if (!reactiveMusic.noiseBuffer) {
    const ctx = getAudioContext();
    reactiveMusic.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = reactiveMusic.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return reactiveMusic.noiseBuffer;
}

// Smoothly crossfade a stem gain toward a target volume
function rampStem(gainNode, target, time, tc = 0.4) {
  gainNode.gain.setTargetAtTime(target, time, tc);
}

// Start the reactive layer. Idempotent — safe to call every level start.
export function startReactiveMusic() {
  if (reactiveMusic.running) return;
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  reactiveMusic.stems = {
    ambient: createReactiveStem(0),
    percussion: createReactiveStem(0),
    melody: createReactiveStem(0),
    intensity: createReactiveStem(0),
  };

  // Ambient pad drone: two detuned saws (root + fifth) through a lowpass.
  // The pad filter opens up when combat intensity rises.
  const padGain = ctx.createGain();
  padGain.gain.value = 0.5;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  const padOscA = ctx.createOscillator();
  padOscA.type = 'sawtooth';
  padOscA.frequency.value = 110; // A2
  padOscA.detune.value = 6;
  const padOscB = ctx.createOscillator();
  padOscB.type = 'sawtooth';
  padOscB.frequency.value = 164.81; // E3 (fifth)
  padOscB.detune.value = -6;
  padOscA.connect(padFilter);
  padOscB.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(reactiveMusic.stems.ambient);
  padOscA.start(t);
  padOscB.start(t);

  // Intensity drone: sub-bass saw + detuned octave for grit
  const intGain = ctx.createGain();
  intGain.gain.value = 0.35;
  const intOscA = ctx.createOscillator();
  intOscA.type = 'sawtooth';
  intOscA.frequency.value = 55; // A1
  const intOscB = ctx.createOscillator();
  intOscB.type = 'sawtooth';
  intOscB.frequency.value = 110.7; // detuned A2
  intOscA.connect(intGain);
  intOscB.connect(intGain);
  intGain.connect(reactiveMusic.stems.intensity);
  intOscA.start(t);
  intOscB.start(t);

  reactiveMusic.drones = { padGain, padFilter, intGain, padOscA, padOscB, intOscA, intOscB };
  reactiveMusic.running = true;
  reactiveMusic.bpm = REACTIVE_BPM.calm;
  reactiveMusic.targetBpm = REACTIVE_BPM.calm;
  reactiveMusic.step = 0;
  getReactiveNoiseBuffer();

  audioInfoLog('[reactive-music] Started 4-stem layer');
  scheduleReactiveStep();
}

// Stop the reactive layer: fade stems to silence, stop the scheduler
// and release continuous oscillators.
export function stopReactiveMusic() {
  if (!reactiveMusic.running) return;
  reactiveMusic.running = false;
  if (reactiveMusic.schedulerTimer) {
    clearTimeout(reactiveMusic.schedulerTimer);
    reactiveMusic.schedulerTimer = null;
  }
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const stopAt = t + 0.5;
  for (const key of Object.keys(reactiveMusic.stems)) {
    reactiveMusic.stems[key].gain.setTargetAtTime(0, t, 0.05);
  }
  if (reactiveMusic.drones) {
    reactiveMusic.drones.padGain.gain.setTargetAtTime(0, t, 0.05);
    reactiveMusic.drones.intGain.gain.setTargetAtTime(0, t, 0.05);
    for (const key of ['padOscA', 'padOscB', 'intOscA', 'intOscB']) {
      try { reactiveMusic.drones[key].stop(stopAt); } catch (err) { /* already stopped */ }
    }
  }
  reactiveMusic.stems = null;
  reactiveMusic.drones = null;
  audioInfoLog('[reactive-music] Stopped');
}

// Per-frame state push from main.js. All values are plain numbers so
// audio.js stays decoupled from game.js. Crossfade targets computed
// from the Issue #142 intensity table (CALM/COMBAT/FRENZY/BOSS).
export function updateReactiveMusic(state) {
  if (!reactiveMusic.running) return;
  const s = state || {};
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const enemyCount = s.enemyCount || 0;
  const boss = !!s.bossActive;
  const combo = s.comboMultiplier || 1;
  const lowHealth = !!s.lowHealth;

  let amb = 0.04;
  let perc = 0;
  let mel = 0;
  let inten = 0;
  let targetBpm = REACTIVE_BPM.calm;

  if (s.playing) {
    // Percussion: floor of light drums during combat, scales with enemy count
    perc = Math.min(0.22, enemyCount * 0.02);
    if (enemyCount > 0 && perc < 0.08) perc = 0.08;
    // Melody: arpeggios once the combo multiplier reaches 2x
    mel = combo >= 2 ? Math.min(0.16, (combo - 1) * 0.04) : 0;
    // Intensity: boss fight or low health
    inten = boss ? 0.2 : lowHealth ? 0.14 : 0;
    // Ambient pad swells with tension
    amb = 0.06 + (boss ? 0.06 : 0) + (enemyCount > 8 ? 0.03 : 0);

    if (boss) targetBpm = REACTIVE_BPM.boss;
    else if (enemyCount >= 9) targetBpm = REACTIVE_BPM.frenzy;
    else if (enemyCount >= 3) targetBpm = REACTIVE_BPM.combat;
  }

  reactiveMusic.targetBpm = targetBpm;
  reactiveMusic.intensityHigh = boss || lowHealth || enemyCount >= 9;

  rampStem(reactiveMusic.stems.ambient, amb, t);
  rampStem(reactiveMusic.stems.percussion, perc, t);
  rampStem(reactiveMusic.stems.melody, mel, t);
  rampStem(reactiveMusic.stems.intensity, inten, t);
  // Pad filter brightness follows intensity (muffled when calm)
  if (reactiveMusic.drones) {
    reactiveMusic.drones.padFilter.frequency.setTargetAtTime(600 + inten * 2600, t, 0.4);
  }
}

// Debug/state getter — used by tests and the settings menu later
export function getReactiveMusicState() {
  const stems = reactiveMusic.stems ? {
    ambient: +reactiveMusic.stems.ambient.gain.value.toFixed(3),
    percussion: +reactiveMusic.stems.percussion.gain.value.toFixed(3),
    melody: +reactiveMusic.stems.melody.gain.value.toFixed(3),
    intensity: +reactiveMusic.stems.intensity.gain.value.toFixed(3),
  } : null;
  return {
    running: reactiveMusic.running,
    bpm: Math.round(reactiveMusic.bpm),
    targetBpm: reactiveMusic.targetBpm,
    step: reactiveMusic.step,
    stems,
  };
}

// Scheduler: 16th-note step clock driven by setTimeout (rAF is not
// reliable in WebXR immersive mode — same pattern as fadeOutMusic).
function scheduleReactiveStep() {
  const stepMs = 15000 / reactiveMusic.bpm; // 60000 / bpm / 4
  reactiveMusic.schedulerTimer = setTimeout(() => {
    if (!reactiveMusic.running) return;
    reactiveStep();
    scheduleReactiveStep();
  }, stepMs);
}

function reactiveStep() {
  const ctx = getAudioContext();
  const t = ctx.currentTime + 0.02; // small lookahead so envelopes start on time
  reactiveMusic.step++;
  const step16 = reactiveMusic.step % 16;
  const beat = step16 % 4;

  // Glide BPM toward the target (±1.5 BPM per 16th) for smooth transitions
  const diff = reactiveMusic.targetBpm - reactiveMusic.bpm;
  if (diff !== 0) {
    reactiveMusic.bpm += Math.sign(diff) * Math.min(1.5, Math.abs(diff));
  }

  const stems = reactiveMusic.stems;
  if (!stems) return;

  const percLevel = stems.percussion.gain.value;
  if (percLevel > 0.02) {
    if (beat === 0) synthKick(t, percLevel);
    if (step16 % 4 === 2) synthHat(t, false, percLevel);
    if (step16 % 8 === 4 && percLevel > 0.1) synthSnare(t, percLevel);
    if (reactiveMusic.intensityHigh && step16 % 2 === 1) synthHat(t, true, percLevel);
  }

  const melLevel = stems.melody.gain.value;
  if (melLevel > 0.02 && step16 % 2 === 0) {
    const freq = PENTATONIC[MELODY_PATTERN[step16 % MELODY_PATTERN.length]] * 2;
    synthMelodyNote(freq, t, melLevel);
  }
}

function synthKick(t, level) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  g.gain.setValueAtTime(0.5 * level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g);
  g.connect(reactiveMusic.stems.percussion);
  osc.start(t);
  osc.stop(t + 0.3);
}

function synthHat(t, open, level) {
  const ctx = getAudioContext();
  const src = ctx.createBufferSource();
  src.buffer = getReactiveNoiseBuffer();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.18 * level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.18 : 0.05));
  src.connect(hp);
  hp.connect(g);
  g.connect(reactiveMusic.stems.percussion);
  src.start(t);
  src.stop(t + 0.25);
}

function synthSnare(t, level) {
  const ctx = getAudioContext();
  const src = ctx.createBufferSource();
  src.buffer = getReactiveNoiseBuffer();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25 * level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(bp);
  bp.connect(g);
  g.connect(reactiveMusic.stems.percussion);
  src.start(t);
  src.stop(t + 0.15);
}

function synthMelodyNote(freq, t, level) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  osc.detune.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16 * level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(g);
  g.connect(reactiveMusic.stems.melody);
  osc.start(t);
  osc.stop(t + 0.35);
}

// ============================================================
// THREAT SPATIAL AUDIO (Issue #184)
// Directional per-enemy-type alert cues via PannerNode (HRTF).
// Emitters are pooled per enemy id (nearest MAX_THREAT_EMITTERS
// win), so close enemies are heard as distinct, localized threats
// around the stationary player. The Web Audio listener tracks the
// camera, so cues stay directionally accurate as the player turns
// their head in VR. Replaces the old stereo-pan fast/swarm alerts.
// ============================================================

const THREAT_PROFILES = {
  basic:          { wave: 'sine',     f0: 440, f1: 660,  dur: 0.12, gain: 0.5,  range: 6,  interval: 0.35, style: 'sweep' },
  fast:           { wave: 'square',   f0: 880, f1: 1320, dur: 0.09, gain: 0.45, range: 10, interval: 0.2,  style: 'sweep' },
  swarm:          { wave: 'square',   f0: 700, f1: 1100, dur: 0.1,  gain: 0.5,  range: 8,  interval: 0.15, style: 'double' },
  tank:           { wave: 'sawtooth', f0: 120, f1: 80,   dur: 0.3,  gain: 0.6,  range: 7,  interval: 0.4,  style: 'sweep' },
  conductor:      { wave: 'sine',     f0: 520, f1: 780,  dur: 0.35, gain: 0.4,  range: 12, interval: 0.5,  style: 'wail' },
  mortar:         { wave: 'triangle', f0: 620, f1: 480,  dur: 0.15, gain: 0.4,  range: 9,  interval: 0.5,  style: 'sweep' },
  spiral_swimmer: { wave: 'sine',     f0: 500, f1: 620,  dur: 0.25, gain: 0.4,  range: 8,  interval: 0.45, style: 'wobble' },
  jelly:          { wave: 'sine',     f0: 220, f1: 260,  dur: 0.2,  gain: 0.45, range: 7,  interval: 0.5,  style: 'wobble' },
};
const DEFAULT_THREAT_PROFILE = THREAT_PROFILES.basic;
const MAX_THREAT_EMITTERS = 10; // HRTF panners are expensive on Quest — cap the pool

// enemyId -> { panner, gain, nextAlert, lastPosUpdate, lastDist, profile }
const threatEmitters = new Map();
// Reused across frames to avoid per-frame Set allocation in the render loop
const threatAliveIds = new Set();

// Scratch vectors for listener orientation (no allocation in the render loop)
const _lFwd = { x: 0, y: 0, z: 0 };
const _lUp = { x: 0, y: 0, z: 0 };

// Apply camera quaternion to (0,0,-1); result written to out. Quaternion
// rotation formula: v' = v + 2w(q×v) + 2(q×(q×v))
function quatForwardTo(q, out) {
  const { x, y, z, w } = q;
  out.x = -2 * w * y - 2 * z * x;
  out.y = 2 * w * x - 2 * z * y;
  out.z = -1 + 2 * (x * x + y * y);
}

// Apply camera quaternion to (0,1,0)
function quatUpTo(q, out) {
  const { x, y, z, w } = q;
  out.x = -2 * w * z + 2 * y * x;
  out.y = 1 - 2 * (z * z + x * x);
  out.z = 2 * w * x + 2 * y * z;
}

function syncListenerFromCamera(camera) {
  const ctx = getAudioContext();
  const p = camera.position;
  const q = camera.quaternion;
  const L = ctx.listener;
  if (L.positionX && L.forwardX) {
    // Direct .value writes — cheaper than scheduling automation events
    L.positionX.value = p.x;
    L.positionY.value = p.y;
    L.positionZ.value = p.z;
    quatForwardTo(q, _lFwd);
    quatUpTo(q, _lUp);
    L.forwardX.value = _lFwd.x;
    L.forwardY.value = _lFwd.y;
    L.forwardZ.value = _lFwd.z;
    L.upX.value = _lUp.x;
    L.upY.value = _lUp.y;
    L.upZ.value = _lUp.z;
  } else if (L.setPosition) {
    // Older Safari fallback
    L.setPosition(p.x, p.y, p.z);
  }
}

function getThreatEmitter(enemyId) {
  let em = threatEmitters.get(enemyId);
  if (!em) {
    const ctx = getAudioContext();
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.rolloffFactor = 0.6;
    panner.maxDistance = 30;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(panner);
    panner.connect(getSfxOutput());
    em = { panner, gain, nextAlert: 0, lastPosUpdate: 0, lastDist: 0, profile: DEFAULT_THREAT_PROFILE };
    threatEmitters.set(enemyId, em);
  }
  return em;
}

function releaseThreatEmitter(enemyId) {
  const em = threatEmitters.get(enemyId);
  if (!em) return;
  threatEmitters.delete(enemyId);
  try {
    em.gain.disconnect();
    em.panner.disconnect();
  } catch (err) { /* already disconnected */ }
}

// Pool is full — evict the farthest emitter to make room
function evictFarthestThreatEmitter() {
  let farId = null;
  let farDist = -1;
  for (const [id, em] of threatEmitters) {
    if (em.lastDist > farDist) {
      farDist = em.lastDist;
      farId = id;
    }
  }
  if (farId !== null) releaseThreatEmitter(farId);
}

// Play one alert burst through an emitter's gain (panner handles position).
// The oscillator is short-lived; the panner/gain are pooled per enemy.
function playThreatBurst(outputGain, profile, intensity) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const level = Math.min(0.35, profile.gain * intensity);
  const burst = (startT, dur) => {
    const osc = ctx.createOscillator();
    osc.type = profile.wave;
    osc.frequency.setValueAtTime(profile.f0, startT);
    osc.frequency.exponentialRampToValueAtTime(profile.f1, startT + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, startT);
    g.gain.exponentialRampToValueAtTime(0.001, startT + dur);
    osc.connect(g);
    g.connect(outputGain);
    osc.start(startT);
    osc.stop(startT + dur + 0.02);
  };

  if (profile.style === 'double') {
    // Swarm: two quick bursts read as "buzz"
    burst(t, profile.dur);
    burst(t + 0.09, profile.dur);
  } else if (profile.style === 'wail') {
    // Conductor: dual detuned sines = eerie wail
    burst(t, profile.dur);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(profile.f0 * 1.5, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(level * 0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + profile.dur);
    osc2.connect(g2);
    g2.connect(outputGain);
    osc2.start(t);
    osc2.stop(t + profile.dur + 0.02);
  } else if (profile.style === 'wobble') {
    // Spiral/jelly: sweep up then back down = warbling
    const osc = ctx.createOscillator();
    osc.type = profile.wave;
    osc.frequency.setValueAtTime(profile.f0, t);
    osc.frequency.exponentialRampToValueAtTime(profile.f1, t + profile.dur * 0.5);
    osc.frequency.exponentialRampToValueAtTime(profile.f0, t + profile.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + profile.dur);
    osc.connect(g);
    g.connect(outputGain);
    osc.start(t);
    osc.stop(t + profile.dur + 0.02);
  } else {
    burst(t, profile.dur);
  }
}

/**
 * Per-frame threat audio update. Call from the render loop while PLAYING.
 * @param dt frame delta in seconds
 * @param enemies array of enemy objects ({id, type, hp, mesh:{position}})
 * @param playerPos THREE.Vector3 of the player's gameplay position
 * @param camera THREE camera (headset position/orientation on VR)
 */
export function updateThreatAudio(dt, enemies, playerPos, camera) {
  const ctx = getAudioContext();
  if (camera) syncListenerFromCamera(camera);
  void dt;

  if (!enemies || enemies.length === 0) {
    if (threatEmitters.size > 0) {
      for (const id of threatEmitters.keys()) releaseThreatEmitter(id);
    }
    return;
  }

  const now = performance.now();
  threatAliveIds.clear();

  for (const e of enemies) {
    if (!e || !e.mesh || !e.mesh.position || !(e.hp > 0)) continue;
    threatAliveIds.add(e.id);
    const profile = THREAT_PROFILES[e.type] || DEFAULT_THREAT_PROFILE;
    const dist = e.mesh.position.distanceTo(playerPos);
    if (dist > profile.range) continue;

    let em = threatEmitters.get(e.id);
    if (!em) {
      if (threatEmitters.size >= MAX_THREAT_EMITTERS) evictFarthestThreatEmitter();
      em = getThreatEmitter(e.id);
      em.profile = profile;
    }

    // Throttle panner position updates (~12/sec per emitter) — HRTF panning
    // is expensive; moving the node every frame is not needed for accuracy.
    if (now - em.lastPosUpdate > 80) {
      em.panner.positionX.value = e.mesh.position.x;
      em.panner.positionY.value = e.mesh.position.y;
      em.panner.positionZ.value = e.mesh.position.z;
      em.lastPosUpdate = now;
    }
    em.lastDist = dist;

    if (now >= em.nextAlert) {
      em.nextAlert = now + profile.interval * 1000;
      playThreatBurst(em.gain, profile, 1 - (dist / profile.range));
    }
  }

  // Reap emitters for enemies that died or left the arena.
  // Map iteration tolerates deleting the current entry — no array allocs.
  for (const id of threatEmitters.keys()) {
    if (!threatAliveIds.has(id)) releaseThreatEmitter(id);
  }
}

// Debug/state getter — used by tests
export function getActiveThreatEmitterCount() {
  return threatEmitters.size;
}
