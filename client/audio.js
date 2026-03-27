// Procedural sound effects using Web Audio API — no external files

let ctx = null;
let masterGain = null;
let initialized = false;

function init() {
  if (initialized) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);
    initialized = true;
  } catch (e) {
    // Audio not supported
  }
}

// Resume AudioContext on first user interaction (required by browsers)
function ensureResumed() {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

document.addEventListener('click', () => { init(); ensureResumed(); }, { once: false });
document.addEventListener('keydown', () => { init(); ensureResumed(); }, { once: false });

// ── Sound generators ──

function playNoise(duration, freq, type, volume, filterFreq) {
  if (!ctx || !initialized) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(volume || 0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }

  gain.connect(masterGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playWhiteNoiseBurst(duration, volume) {
  if (!ctx || !initialized) return;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(ctx.currentTime);
}

// ── Specific sounds ──

export function playFootstep() {
  if (!ctx || !initialized) return;
  // Soft thud
  const freq = 80 + Math.random() * 40;
  playNoise(0.08, freq, 'sine', 0.04);
  playWhiteNoiseBurst(0.04, 0.02);
}

export function playHitGather() {
  if (!ctx || !initialized) return;
  // Impact sound: low thud + higher click
  playNoise(0.12, 150 + Math.random() * 50, 'triangle', 0.08);
  playNoise(0.05, 800 + Math.random() * 400, 'square', 0.03, 2000);
  playWhiteNoiseBurst(0.06, 0.04);
}

export function playHitAttack() {
  if (!ctx || !initialized) return;
  // Melee hit: sharper, more punch
  playNoise(0.08, 200 + Math.random() * 100, 'sawtooth', 0.1, 1500);
  playNoise(0.04, 1200 + Math.random() * 600, 'square', 0.04);
  playWhiteNoiseBurst(0.05, 0.06);
}

export function playGunshot() {
  if (!ctx || !initialized) return;
  playNoise(0.03, 100, 'square', 0.15);
  playWhiteNoiseBurst(0.12, 0.15);
  playNoise(0.15, 60, 'sine', 0.08);
}

export function playBowShot() {
  if (!ctx || !initialized) return;
  // Twang
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playInventoryOpen() {
  if (!ctx || !initialized) return;
  playNoise(0.06, 600, 'sine', 0.04);
  playNoise(0.04, 800, 'sine', 0.03);
}

export function playInventoryClose() {
  if (!ctx || !initialized) return;
  playNoise(0.06, 500, 'sine', 0.03);
  playNoise(0.04, 350, 'sine', 0.03);
}

export function playCraftComplete() {
  if (!ctx || !initialized) return;
  // Pleasant ascending tones
  playNoise(0.1, 600, 'sine', 0.05);
  setTimeout(() => playNoise(0.1, 800, 'sine', 0.05), 80);
  setTimeout(() => playNoise(0.15, 1000, 'sine', 0.04), 160);
}

export function playPickup() {
  if (!ctx || !initialized) return;
  playNoise(0.06, 1000, 'sine', 0.04);
  playNoise(0.04, 1400, 'sine', 0.03);
}

export function playDeath() {
  if (!ctx || !initialized) return;
  playNoise(0.3, 100, 'sine', 0.1);
  playNoise(0.5, 60, 'sine', 0.08);
}

export function playDoorOpen() {
  if (!ctx || !initialized) return;
  // Creaky door
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.03, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playPlaceStructure() {
  if (!ctx || !initialized) return;
  playNoise(0.15, 120, 'triangle', 0.06);
  playWhiteNoiseBurst(0.08, 0.04);
}

// ── Ambient system ──

let ambientInterval = null;
let ambientGain = null;

export function startAmbient(lightLevel) {
  if (!ctx || !initialized) return;
  if (ambientInterval) return;

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.015;
  ambientGain.connect(masterGain);

  ambientInterval = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;

    // Wind gust
    if (Math.random() < 0.3) {
      const bufferSize = ctx.sampleRate * (0.5 + Math.random() * 1.0);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300 + Math.random() * 200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.3);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + bufferSize / ctx.sampleRate);
      source.connect(filter);
      filter.connect(g);
      g.connect(masterGain);
      source.start(ctx.currentTime);
    }

    // Night crickets
    if (lightLevel < 0.5 && Math.random() < 0.4) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 3000 + Math.random() * 2000;
      g.gain.setValueAtTime(0.008, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  }, 2000 + Math.random() * 3000);
}

export function stopAmbient() {
  if (ambientInterval) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
}

// Footstep timing
let lastFootstepTime = 0;
const FOOTSTEP_INTERVAL = 350; // ms between footsteps

export function updateFootsteps(isMoving, isSprinting) {
  if (!isMoving) return;
  const now = Date.now();
  const interval = isSprinting ? FOOTSTEP_INTERVAL * 0.6 : FOOTSTEP_INTERVAL;
  if (now - lastFootstepTime > interval) {
    playFootstep();
    lastFootstepTime = now;
  }
}
