import './style.css';
import { NarratorAudio, sampleEnvelope } from './audio';
import { Robot } from './robot';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

const robot = new Robot($<SVGSVGElement>('.robot'));
const audio = new NarratorAudio();

const app = $<HTMLElement>('.app');
const playBtn = $<HTMLButtonElement>('[data-action="toggle"]');
const restartBtn = $<HTMLButtonElement>('[data-action="restart"]');
const scrubber = $<HTMLInputElement>('.scrubber');
const elapsedEl = $<HTMLElement>('[data-elapsed]');
const durationEl = $<HTMLElement>('[data-duration]');
const statusEl = $<HTMLElement>('[data-status]');
const voiceInputs = [
  ...document.querySelectorAll<HTMLInputElement>('input[name="voice"]'),
];

type State = 'idle' | 'loading' | 'playing' | 'paused';
let state: State = 'idle';
let scrubbing = false;
let loadedUrl: string | null = null;

const currentVoice = () =>
  voiceInputs.find((i) => i.checked) ?? voiceInputs[0]!;

function setState(next: State) {
  state = next;
  app.dataset.state = next;
  const playing = next === 'playing';
  playBtn.setAttribute('aria-pressed', String(playing));
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  playBtn.setAttribute('aria-busy', String(next === 'loading'));
  robot.setReading(playing);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
  wake();
}

// --- transport --------------------------------------------------------------

async function play() {
  if (state === 'playing' || state === 'loading') return;
  const voice = currentVoice();
  if (loadedUrl !== voice.value) {
    setState('loading');
    announce(`Loading ${voice.dataset.name}…`);
    try {
      await audio.load(voice.value);
    } catch (err) {
      console.error(err);
      announce(`Couldn't load ${voice.dataset.name}. Try again.`);
      setState('idle');
      return;
    }
    // voice may have changed while loading
    if (currentVoice() !== voice) return setState('idle');
    loadedUrl = voice.value;
    durationEl.textContent = fmt(audio.duration);
    scrubber.max = String(audio.duration);
  }
  await audio.play();
  setMediaMetadata(voice.dataset.name ?? 'Narrator');
  announce(`${voice.dataset.name} is reading`);
  setState('playing');
}

function pause() {
  if (state !== 'playing') return;
  audio.pause();
  announce('Paused');
  setState('paused');
}

function restart() {
  audio.pause();
  audio.seek(0);
  updateProgress(0);
  setState(audio.track ? 'paused' : 'idle');
  announce('Back to the beginning');
}

const toggle = () => (state === 'playing' ? pause() : play());

audio.onEnded = () => {
  updateProgress(0);
  setState('paused');
  announce('The end');
};

playBtn.addEventListener('click', toggle);
restartBtn.addEventListener('click', restart);

for (const input of voiceInputs) {
  input.addEventListener('change', () => {
    audio.pause();
    loadedUrl = null;
    updateProgress(0);
    durationEl.textContent = '0:00';
    setState('idle');
    audio.prefetch(input.value).catch(() => {});
    announce(`Voice: ${input.dataset.name}`);
  });
}

scrubber.addEventListener('input', () => {
  scrubbing = true;
  elapsedEl.textContent = fmt(Number(scrubber.value));
  paintScrubber(Number(scrubber.value));
});
scrubber.addEventListener('change', () => {
  scrubbing = false;
  audio.seek(Number(scrubber.value));
  wake();
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  const typing = t.closest('input[type="range"], button, select, textarea');
  if (e.code === 'Space' && !typing) {
    e.preventDefault();
    toggle();
  } else if (e.key === 'r' && !typing) {
    restart();
  }
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => void play());
  navigator.mediaSession.setActionHandler('pause', pause);
  navigator.mediaSession.setActionHandler('stop', restart);
  navigator.mediaSession.setActionHandler('seekto', (d) => {
    if (d.seekTime != null) audio.seek(d.seekTime);
  });
}

function setMediaMetadata(name: string) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `Read by ${name}`,
    artist: 'Readbot',
  });
}

// --- render loop ------------------------------------------------------------
// Runs while audio plays, and keeps going briefly afterwards so the mouth
// eases shut instead of freezing mid-word.

const levels = new Float32Array(robot.barCount);
let raf = 0;
let last = 0;

function wake() {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  const env = audio.track?.envelope;
  const t = audio.position;
  const speaking = state === 'playing' && env;
  for (let i = 0; i < levels.length; i++) {
    levels[i] = speaking ? sampleEnvelope(env, t + robot.barOffset(i)) : 0;
  }
  const settled = robot.renderMouth(levels, dt);
  if (state === 'playing' && !scrubbing) updateProgress(t);

  raf = state === 'playing' || !settled ? requestAnimationFrame(frame) : 0;
}

// --- ui helpers -------------------------------------------------------------

function updateProgress(t: number) {
  elapsedEl.textContent = fmt(t);
  scrubber.value = String(t);
  paintScrubber(t);
}

function paintScrubber(t: number) {
  const pct = audio.duration ? (t / audio.duration) * 100 : 0;
  scrubber.style.setProperty('--progress', `${pct}%`);
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function announce(msg: string) {
  statusEl.textContent = msg;
}

// Warm the default voice once the page is idle.
const idle =
  window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
idle(() => void audio.prefetch(currentVoice().value).catch(() => {}));
