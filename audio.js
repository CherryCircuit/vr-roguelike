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
  const baseFreqs = [700, 800, 900];
  const baseFreq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
  const pitch = 0.85 + Math.random() * 0.3;
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

// [Power Outage Update] #3: Boss alert klaxon sound (3 beeps over ~2 seconds)
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
    gain.connect(ctx.destination);
    osc.start(beepTime);
    osc.stop(beepTime + 0.4);
  }
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
let currentMusicCategory = null;  // Track what's currently playing to avoid restarts
// let musicAnalyser = null;  // Music visualizer - commented out
// let musicSource = null;  // Music visualizer - commented out

const musicTracks = {
  menu: ['mnt/project/music/00_Main_Menu.mp3'],
  levels1to4: [
    'mnt/project/music/0101_Levels_1-4.mp3',
    'mnt/project/music/0102_Levels_1-4.mp3',
    'mnt/project/music/0103_Levels_1-4.mp3',
    'mnt/project/music/0104_Levels_1-4.mp3'
  ],
  levels6to9: [
    'mnt/project/music/0201_Levels_6-9.mp3',
    'mnt/project/music/0202_Levels_6-9.mp3',
    'mnt/project/music/0203_Levels_6-9.mp3',
    'mnt/project/music/0204_Levels_6-9.mp3'
  ],
  levels11to14: [
    'mnt/project/music/0301_Levels_11-14.mp3',
    'mnt/project/music/0302_Levels_11-14.mp3',
    'mnt/project/music/0303_Levels_11-14.mp3',
    'mnt/project/music/0304_Levels_11-14.mp3'
  ],
  levels16to19: [
    'mnt/project/music/0401_Levels_16-19.mp3',
    'mnt/project/music/0402_Levels_16-19.mp3',
    'mnt/project/music/0403_Levels_16-19.mp3',
    'mnt/project/music/0404_Levels_16-19.mp3'
  ],
  boss5: [
    'mnt/project/music/B101_Level_05_Boss.mp3',
    'mnt/project/music/B102_Level_05_Boss.mp3',
    'mnt/project/music/B103_Level_05_Boss.mp3',
    'mnt/project/music/B104_Level_05_Boss.mp3'
  ],
  boss10: [
    'mnt/project/music/B201_Level_10_Boss.mp3',
    'mnt/project/music/B202_Level_10_Boss.mp3',
    'mnt/project/music/B203_Level_10_Boss.mp3',
    'mnt/project/music/B204_Level_10_Boss.mp3'
  ],
  boss15: [
    'mnt/project/music/B301_Level_15_Boss.mp3',
    'mnt/project/music/B302_Level_15_Boss.mp3',
    'mnt/project/music/B303_Level_15_Boss.mp3',
    'mnt/project/music/B304_Level_15_Boss.mp3'
  ],
  boss20: [
    'mnt/project/music/B401_Level_20_Boss.mp3',
    'mnt/project/music/B402_Level_20_Boss.mp3',
    'mnt/project/music/B403_Level_20_Boss.mp3',
    'mnt/project/music/B404_Level_20_Boss.mp3'
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

  // Music visualizer code - commented out
  // const ctx = getAudioContext();
  // if (!musicAnalyser) {
  //   musicAnalyser = ctx.createAnalyser();
  //   musicAnalyser.fftSize = 64;
  //   musicAnalyser.smoothingTimeConstant = 0.8;
  //   musicAnalyser.connect(ctx.destination);
  // }

  currentMusic = new Audio(track);
  currentMusic.volume = musicVolume;
  currentMusic.loop = false;

  // Connect audio through analyser for visualization - commented out
  // musicSource = ctx.createMediaElementSource(currentMusic);
  // musicSource.connect(musicAnalyser);

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

// Get audio frequency data for visualization - commented out
// export function getMusicFrequencyData() {
//   if (!musicAnalyser) return null;
//   const dataArray = new Uint8Array(musicAnalyser.frequencyBinCount);
//   musicAnalyser.getByteFrequencyData(dataArray);
//   return dataArray;
// }

export function playMusic(category) {
  // If same category is already playing, don't restart
  if (currentMusicCategory === category && currentMusic && !currentMusic.paused) {
    console.log(`[music] Category "${category}" already playing, skipping restart`);
    return;
  }

  // Stop current music
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }

  // Get tracks for category (fresh copy)
  const tracks = musicTracks[category] ? [...musicTracks[category]] : [];
  if (!tracks || tracks.length === 0) return;

  // Track the current category
  currentMusicCategory = category;

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
  currentMusicCategory = null;  // Clear category tracking
}

// Get the currently playing music category (for checking what's playing)
export function getCurrentMusicCategory() {
  return currentMusicCategory;
}

export function setMusicVolume(vol) {
  musicVolume = Math.max(0, Math.min(1, vol));
  if (currentMusic) {
    currentMusic.volume = musicVolume;
  }
}

// [Power Outage Update] #6: Big explosion sound for level complete finale
export function playBigExplosionSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = getExplosionBuffer();
  noise.playbackRate.value = 0.2 + Math.random() * 0.3; // Lower, deeper

  const duration = 0.8 + Math.random() * 0.4; // Longer duration

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, t);
  filter.frequency.exponentialRampToValueAtTime(30, t + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, t); // Louder
  gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(t);
  noise.stop(t + duration);

  // Add deep boom
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60 + Math.random() * 30, t);
  osc.frequency.exponentialRampToValueAtTime(20, t + duration);
  oscGain.gain.setValueAtTime(0.2, t);
  oscGain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.9);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

// ── Epic Boss Death Sound (much more dramatic than regular explosion) ────────
export function playBossDeathSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  
  // Multiple layered explosions for epic feel
  const durations = [2.5, 1.8, 1.2, 0.8];
  
  durations.forEach((duration, layer) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getExplosionBuffer();
    noise.playbackRate.value = 0.15 + layer * 0.1 + Math.random() * 0.1;

    const filter = ctx.createBiquadFilter();
    filter.type = layer % 2 === 0 ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(2000 - layer * 300, t + layer * 0.1);
    filter.frequency.exponentialRampToValueAtTime(20, t + layer * 0.1 + duration);
    filter.Q.setValueAtTime(2 + layer, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t + layer * 0.1);
    gain.gain.linearRampToValueAtTime(0.4 - layer * 0.05, t + layer * 0.1 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + layer * 0.1 + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t + layer * 0.1);
    noise.stop(t + layer * 0.1 + duration);
  });

  // Deep rumbling bass (multiple oscillators)
  [25, 35, 50].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(15, t + 3);
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.25 - i * 0.05, t + 0.1);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 3);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 3);
  });

  // High-pitched shriek for dramatic effect
  const shriekOsc = ctx.createOscillator();
  const shriekGain = ctx.createGain();
  shriekOsc.type = 'sawtooth';
  shriekOsc.frequency.setValueAtTime(800, t + 0.3);
  shriekOsc.frequency.exponentialRampToValueAtTime(100, t + 1.5);
  shriekGain.gain.setValueAtTime(0, t + 0.3);
  shriekGain.gain.linearRampToValueAtTime(0.15, t + 0.4);
  shriekGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
  shriekOsc.connect(shriekGain);
  shriekGain.connect(ctx.destination);
  shriekOsc.start(t + 0.3);
  shriekOsc.stop(t + 1.5);

  console.log('[audio] Epic boss death sound played');
}

// [Power Outage Update] #15: Game over sound effect
let gameOverAudio = null;

export function playGameOverSound() {
  if (gameOverAudio) {
    gameOverAudio.pause();
    gameOverAudio.currentTime = 0;
  }
  gameOverAudio = new Audio('mnt/project/music/XX_Game_Over.mp3');
  gameOverAudio.volume = 0.5;
  gameOverAudio.play().catch(() => {});
}

// ── Button Hover Sound (sfxr params) ─────────────────────────
let lastHoverSoundTime = 0;
export function playButtonHoverSound() {
  const now = performance.now();
  
  // I commented this out. I want it to play fast if they hover fast. I don't care.
  //
  // if (now - lastHoverSoundTime < 100) return; // Debounce: max 1 per 100ms
  // lastHoverSoundTime = now;

  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Based on sfxr params: wave_type 3 (noise), quick attack/decay
  const bufferSize = ctx.sampleRate * 0.1;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.playbackRate.value = 0.8;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(2000, t + 0.05);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.1);
}

// ── Button Click Sound (sfxr params) ───────────────────────────
export function playButtonClickSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Based on sfxr params: wave_type 2 (square), arp mod
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  
  // Arpeggio-like frequency sweep
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.setValueAtTime(800, t + 0.03);
  osc.frequency.setValueAtTime(500, t + 0.08);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);

  gain.gain.setValueAtTime(0.1, t);
  gain.gain.setValueAtTime(0.08, t + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);

  // Layer with noise for punch
  const noise = ctx.createBufferSource();
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.04, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
  
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.05);
}

// ── Low Health Alert Sound (wav file) ───────────────────────
let lowHealthAudio = null;
export function playLowHealthAlertSound() {
  if (lowHealthAudio) {
    lowHealthAudio.pause();
    lowHealthAudio.currentTime = 0;
  }
  lowHealthAudio = new Audio('mnt/project/soundfx/lowhealth.mp3');
  lowHealthAudio.volume = 0.5;
  lowHealthAudio.play().catch(() => {});
}

// ── Vampire Heal Sound (wav file) ───────────────────────────
let vampireHealAudio = null;
export function playVampireHealSound() {
  if (vampireHealAudio) {
    vampireHealAudio.pause();
    vampireHealAudio.currentTime = 0;
  }
  vampireHealAudio = new Audio('mnt/project/soundfx/vampiric.mp3');
  vampireHealAudio.volume = 0.4;
  vampireHealAudio.play().catch(() => {});
}

// ── Buckshot Sound (wav file) ───────────────────────────
let buckshotAudio = null;
export function playBuckshotSoundNew() {
  if (buckshotAudio) {
    buckshotAudio.pause();
    buckshotAudio.currentTime = 0;
  }
  buckshotAudio = new Audio('mnt/project/soundfx/buckshot_01.mp3'); //But I want this to be random between "buckshot_01.mp3" and "buckshot_02.mp3"
  buckshotAudio.volume = 0.5;
  buckshotAudio.play().catch(() => {});
}

// ── [Instruction 1] Alt Weapon Ready Sound ───────────────────────────
export function playAltWeaponReadySound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Pleasant "ready" chime - two ascending tones
  const frequencies = [600, 900];
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.1);
    
    gain.gain.setValueAtTime(0, t + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.15, t + i * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + i * 0.1);
    osc.stop(t + i * 0.1 + 0.25);
  });
}

// ── Charge Shot Sounds (Mega Man style) ───────────────────────────────

// Charge sound oscillators and gain nodes (per hand: 0=left, 1=right)
const chargeOscillators = [null, null];
const chargeGains = [null, null];
const chargeLfoOscillators = [null, null];
const chargeLfoGains = [null, null];
let chargeAudioCtx = null;

/**
 * Start the Mega Man-style charging sound.
 * Creates a pulsing tone that rises in pitch and intensity.
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
  mainGain.connect(ctx.destination);
  
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
  gain.connect(ctx.destination);
  
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
  gain.connect(ctx.destination);
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
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000 + progress * 3000, t);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.15);
}

// ── Music Fade Out ─────────────────────────────────────────────
export function fadeOutMusic(durationSec = 2.0) {
  if (!currentMusic) return;
  
  const startVol = currentMusic.volume;
  const startTime = performance.now();
  const durationMs = durationSec * 1000;

  function fadeStep() {
    if (!currentMusic) return;
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    currentMusic.volume = startVol * (1 - t);
    
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      stopMusic();
    }
  }
  
  fadeStep();
}
