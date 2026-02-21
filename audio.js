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

export function resumeAudioContext() {
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
  gain.connect(ctx.destination);
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
    gain2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + duration);
  }
}

// ── Double Shot sound ──────────────────────────────────────
export function playDoubleShotSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Two quick pulses
  for (let i = 0; i < 2; i++) {
    const start = t + i * 0.05;
    const duration = 0.06;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 + i * 200, start);
    osc.frequency.exponentialRampToValueAtTime(100, start + duration);
    gain.gain.setValueAtTime(0.1, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }
}

// ── Charge Up Logic ────────────────────────────────────────
let chargeOsc = null;
let chargeGain = null;

export function updateChargeUpSound(active, progress) {
  const ctx = getAudioContext();
  if (active) {
    if (!chargeOsc) {
      chargeOsc = ctx.createOscillator();
      chargeGain = ctx.createGain();
      chargeOsc.type = 'sawtooth';
      chargeGain.gain.setValueAtTime(0, ctx.currentTime);
      chargeOsc.connect(chargeGain);
      chargeGain.connect(ctx.destination);
      chargeOsc.start();
    }
    // Frequency rises from 100Hz to 600Hz based on charge
    const freq = 100 + progress * 500;
    chargeOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
    const volume = 0.02 + progress * 0.08;
    chargeGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
  } else {
    if (chargeOsc) {
      chargeGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      chargeOsc.stop(ctx.currentTime + 0.1);
      chargeOsc = null;
      chargeGain = null;
    }
  }
}

export function playChargeFireSound(damage) {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Smash Bros "Clink" logic for high damage
  if (damage >= 450) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.15);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    // Add low boom
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, t);
    boom.frequency.exponentialRampToValueAtTime(20, t + 0.4);
    boomGain.gain.setValueAtTime(0.5, t);
    boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(t);
    boom.stop(t + 0.4);
  } else {
    // Normal medium beam sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

// ── Enemy hit sound — heavily randomized ───────────────────
export function playHitSound() {
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
  gain.connect(ctx.destination);

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

export function playExplosionSound() {
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
  gain.connect(ctx.destination);

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
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }
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
  gain.connect(ctx.destination);
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
  gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.5);
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
  gain.connect(ctx.destination);
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
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.03);
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
  gain.connect(ctx.destination);
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
  gain.connect(ctx.destination);
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
  gain2.connect(ctx.destination);
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
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.5);
}

// ── Lightning beam continuous sound (MP3 loop) ─────────────
let lightningAudio = null;
let lightningVolumeTimeout = null;

export function startLightningSound() {
  if (lightningAudio) return;  // Already playing

  lightningAudio = new Audio('mnt/project/soundfx/lightning_loop.mp3');
  lightningAudio.loop = true;
  lightningAudio.volume = 0.5; // "Full" starting volume
  lightningAudio.play().catch(err => {
    console.warn('[audio] Lightning loop playback failed:', err);
  });

  // After 4 seconds of continuous play, lower volume by 40%
  lightningVolumeTimeout = setTimeout(() => {
    if (lightningAudio) {
      lightningAudio.volume = 0.3; // 40% reduction (0.5 * 0.6)
      console.log('[audio] Lightning volume dipped (4s continuous)');
    }
  }, 4000);
}

export function stopLightningSound() {
  if (lightningAudio) {
    lightningAudio.pause();
    lightningAudio.currentTime = 0;
    lightningAudio = null;
  }
  if (lightningVolumeTimeout) {
    clearTimeout(lightningVolumeTimeout);
    lightningVolumeTimeout = null;
  }
}

// ── Music System ───────────────────────────────────────────
let currentMusic = null;
let musicVolume = 0.3;
let currentPlaylist = [];
let currentTrackIndex = 0;
let musicAnalyser = null;
let musicSource = null;

const musicTracks = {
  menu: ['mnt/project/music/00_Main_Menu.mp3'],
  levels1to5: [
    'mnt/project/music/0101_Levels_1-4.mp3',
    'mnt/project/music/0102_Levels_1-4.mp3',
    'mnt/project/music/0103_Levels_1-4.mp3',
    'mnt/project/music/0104_Levels_1-4.mp3'
  ],
  levels6to10: [
    'mnt/project/music/0201_Levels_6-9.mp3',
    'mnt/project/music/0202_Levels_6-9.mp3',
    'mnt/project/music/0203_Levels_6-9.mp3',
    'mnt/project/music/0204_Levels_6-9.mp3'
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
  console.log(`[music] Playing track ${currentTrackIndex + 1}/${currentPlaylist.length}: ${track}`);

  const ctx = getAudioContext();

  // Create analyser if it doesn't exist
  if (!musicAnalyser) {
    musicAnalyser = ctx.createAnalyser();
    musicAnalyser.fftSize = 64;  // Small for performance (32 frequency bins)
    musicAnalyser.smoothingTimeConstant = 0.8;
    musicAnalyser.connect(ctx.destination);
  }

  currentMusic = new Audio(track);
  currentMusic.volume = musicVolume;
  currentMusic.loop = false;  // Don't loop individual tracks

  // Connect audio through analyser for visualization
  musicSource = ctx.createMediaElementSource(currentMusic);
  musicSource.connect(musicAnalyser);

  // Auto-advance to next track when current ends
  currentMusic.addEventListener('ended', () => {
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    playNextTrack();
  });

  // Handle loading errors
  currentMusic.addEventListener('error', (e) => {
    console.warn(`[music] Failed to load: ${track}`, e);
    // Skip to next track on error
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    playNextTrack();
  });

  currentMusic.play().catch(err => {
    console.warn('[music] Autoplay prevented, will start on first interaction');
  });
}

// Get audio frequency data for visualization
export function getMusicFrequencyData() {
  if (!musicAnalyser) return null;
  const dataArray = new Uint8Array(musicAnalyser.frequencyBinCount);
  musicAnalyser.getByteFrequencyData(dataArray);
  return dataArray;
}

export function playMusic(category) {
  // Stop current music
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }

  // Get tracks for category (fresh copy)
  const tracks = musicTracks[category] ? [...musicTracks[category]] : [];
  if (!tracks || tracks.length === 0) return;

  // Create randomized playlist
  currentPlaylist = shuffleArray(tracks);
  currentTrackIndex = 0;

  console.log(`[music] Starting playlist for ${category} with ${currentPlaylist.length} tracks`);
  playNextTrack();
}

export function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

export function setMusicVolume(vol) {
  musicVolume = Math.max(0, Math.min(1, vol));
  if (currentMusic) {
    currentMusic.volume = musicVolume;
  }
}

// ── Boss teleport disappear (warp out) ─────────────────────
export function playBossTeleportDisappear() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Reverse sweep - high to low
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

  // Add stereo panning effect
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime((Math.random() - 0.5) * 2, t);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.25);

  // Layer a second osc for richness
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(600, t);
  osc2.frequency.exponentialRampToValueAtTime(80, t + 0.2);
  gain2.gain.setValueAtTime(0.08, t);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.2);
}

// ── Boss teleport reappear (warp in) ───────────────────────
export function playBossTeleportReappear() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Forward sweep - low to high
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime((Math.random() - 0.5) * 2, t);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.2);

  // Layer a second osc
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(80, t);
  osc2.frequency.exponentialRampToValueAtTime(600, t + 0.15);
  gain2.gain.setValueAtTime(0.08, t + 0.02);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.15);
}

// ── Boss explosion (charge up explosion) ────────────────────
export function playBossExplosion() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Noise burst for explosion
  const noise = ctx.createBufferSource();
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000, t);
  filter.frequency.exponentialRampToValueAtTime(100, t + 0.4);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.4);

  // Low boom underneath
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  oscGain.gain.setValueAtTime(0.25, t);
  oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);
}

// ── Boss stunned (electrical buzz) ─────────────────────────
export function playBossStunned() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Electrical buzzing sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, t);
  // Frequency wobble for electrical effect
  osc.frequency.linearRampToValueAtTime(150, t + 0.05);
  osc.frequency.linearRampToValueAtTime(120, t + 0.1);
  osc.frequency.linearRampToValueAtTime(140, t + 0.15);

  gain.gain.setValueAtTime(0.12, t);
  gain.gain.setValueAtTime(0.15, t + 0.05);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t);
  filter.Q.setValueAtTime(2, t);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.2);
}
