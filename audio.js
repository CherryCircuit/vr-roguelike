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

// ── Shoot sound (laser pew) — random pitch variation ───────
export function playShoothSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const pitch = 0.6 + Math.random() * 0.8;  // ±40% pitch variation

  osc.type = 'square';
  osc.frequency.setValueAtTime(800 * pitch, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200 * pitch, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// ── Enemy hit sound — random pitch variation ───────────────
export function playHitSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const pitch = 0.5 + Math.random() * 1.0;  // ±50% pitch variation

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400 * pitch, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100 * pitch, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
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
  const noise = ctx.createBufferSource();
  noise.buffer = getExplosionBuffer();
  // Random playback rate for pitch variation (±25%)
  noise.playbackRate.value = 0.5 + Math.random() * 1.0;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const filterPitch = 0.4 + Math.random() * 1.2;  // Wide filter cutoff variation
  filter.frequency.setValueAtTime(2000 * filterPitch, ctx.currentTime);
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

// ── Lightning beam continuous sound (electric crackle) ─────
let lightningInterval = null;

export function startLightningSound() {
  if (lightningInterval) return;  // Already playing

  const ctx = getAudioContext();

  // Play subtle reminder crackle every 2 seconds (not constant)
  lightningInterval = setInterval(() => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150 + Math.random() * 100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    // MUCH quieter - 0.03 instead of 0.12
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }, 2000);  // Every 2 seconds instead of every 60ms
}

export function stopLightningSound() {
  if (lightningInterval) {
    clearInterval(lightningInterval);
    lightningInterval = null;
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

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

  // Get tracks for category
  const tracks = musicTracks[category];
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
