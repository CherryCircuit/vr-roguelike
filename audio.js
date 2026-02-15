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
// let musicAnalyser = null;  // Music visualizer - commented out
// let musicSource = null;  // Music visualizer - commented out

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
  ],
  // [Power Outage Update] #2: Boss music playlists for each boss level
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

// ── Phase 3: New Weapon Sounds ───────────────────────────────

// Rocket Launcher - deep whoosh followed by explosion
export function playRocketSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Whoosh launch sound
  const noise = ctx.createBufferSource();
  noise.buffer = getExplosionBuffer();
  noise.playbackRate.value = 0.8 + Math.random() * 0.4;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  filter.Q.setValueAtTime(2, t);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.3);

  // Low thump
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
  oscGain.gain.setValueAtTime(0.15, t);
  oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

// Lightning sound - electric crackle
export function playLightningSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // High frequency crackle
  const noise = ctx.createBufferSource();
  noise.buffer = getExplosionBuffer();
  noise.playbackRate.value = 2 + Math.random();

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2000, t);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.1);

  // Electric buzz
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1200 + Math.random() * 400, t);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);
  oscGain.gain.setValueAtTime(0.08, t);
  oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

// Charge Cannon - charging up sound
export function playChargeSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Rising pitch
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(1500, t + 0.15);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);

  // Bass punch on release
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(80, t + 0.05);
  osc2.frequency.exponentialRampToValueAtTime(30, t + 0.3);
  gain2.gain.setValueAtTime(0.2, t + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t + 0.05);
  osc2.stop(t + 0.3);
}

// Plasma Carbine - rapid fire zaps
export function playPlasmaSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const baseFreq = 1500 + Math.random() * 500;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(baseFreq, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

  // Add slight stereo variation
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime((Math.random() - 0.5) * 0.3, t);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}

// Seeker Burst - multiple tracking sounds
export function playSeekerSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Create 3 quick tones
  for (let i = 0; i < 3; i++) {
    const delay = i * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600 + i * 200, t + delay);
    osc.frequency.exponentialRampToValueAtTime(400 + i * 100, t + delay + 0.1);

    gain.gain.setValueAtTime(0.1, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 0.1);
  }
}

// Shield activation - protective hum
export function playShieldSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Activation hum
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.setValueAtTime(600, t + 0.1);
  osc.frequency.setValueAtTime(500, t + 0.2);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.setValueAtTime(0.15, t + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.4);

  // Shimmer
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1200, t);
  osc2.frequency.exponentialRampToValueAtTime(800, t + 0.15);
  gain2.gain.setValueAtTime(0.08, t);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.15);
}

// Gravity Well - deep warble
export function playGravityWellSound() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Deep oscillating tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';

  // LFO-style warble
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.setValueAtTime(100, t + 0.1);
  osc.frequency.setValueAtTime(70, t + 0.2);
  osc.frequency.setValueAtTime(90, t + 0.3);

  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);

  // Sub bass
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(40, t);
  gain2.gain.setValueAtTime(0.15, t);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.4);
}
