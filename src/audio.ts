/**
 * Minimal Web Audio narrator engine.
 *
 * - Fetches + decodes a narration file once and caches it.
 * - Pre-computes a normalized RMS loudness envelope (ENVELOPE_HZ frames/sec)
 *   so the robot's mouth can be driven from the audio clock with zero
 *   analyser jitter.
 * - Tracks play position across pause/resume/seek.
 */

export const ENVELOPE_HZ = 120;

export interface Track {
  buffer: AudioBuffer;
  /** Loudness per frame, normalized 0..1 */
  envelope: Float32Array;
  duration: number;
}

export class NarratorAudio {
  private ctx: AudioContext | null = null;
  private bytes = new Map<string, Promise<ArrayBuffer>>();
  private tracks = new Map<string, Promise<Track>>();

  private source: AudioBufferSourceNode | null = null;
  private startedAt = 0; // ctx time corresponding to position 0
  private offset = 0; // position (s) when paused

  track: Track | null = null;
  playing = false;
  onEnded: (() => void) | null = null;

  /** Warm the HTTP cache without touching the AudioContext (no autoplay warnings). */
  prefetch(url: string): Promise<ArrayBuffer> {
    let p = this.bytes.get(url);
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
        return r.arrayBuffer();
      });
      p.catch(() => this.bytes.delete(url));
      this.bytes.set(url, p);
    }
    return p;
  }

  /** Decode (once) and select a track. Must be called after a user gesture. */
  async load(url: string): Promise<Track> {
    const ctx = this.context();
    let p = this.tracks.get(url);
    if (!p) {
      p = this.prefetch(url)
        // decodeAudioData detaches its input, so hand it a copy
        .then((buf) => ctx.decodeAudioData(buf.slice(0)))
        .then((buffer) => ({
          buffer,
          envelope: buildEnvelope(buffer, ENVELOPE_HZ),
          duration: buffer.duration,
        }));
      p.catch(() => this.tracks.delete(url));
      this.tracks.set(url, p);
    }
    const track = await p;
    if (this.track !== track) {
      this.stopSource();
      this.playing = false;
      this.offset = 0;
      this.track = track;
    }
    return track;
  }

  async play(): Promise<void> {
    const ctx = this.context();
    if (ctx.state !== 'running') await ctx.resume();
    if (!this.track || this.playing) return;
    if (this.offset >= this.track.duration - 0.01) this.offset = 0;
    this.startSource(this.offset);
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.position;
    this.stopSource();
    this.playing = false;
  }

  seek(seconds: number): void {
    if (!this.track) return;
    const t = clamp(seconds, 0, this.track.duration);
    if (this.playing) {
      this.stopSource();
      this.startSource(t);
    } else {
      this.offset = t;
    }
  }

  /** Current position in seconds, compensated for output latency. */
  get position(): number {
    if (!this.track) return 0;
    if (!this.playing || !this.ctx) return this.offset;
    const latency = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return clamp(
      this.ctx.currentTime - this.startedAt - latency,
      0,
      this.track.duration,
    );
  }

  get duration(): number {
    return this.track?.duration ?? 0;
  }

  // ---------------------------------------------------------------------------

  private context(): AudioContext {
    this.ctx ??= new AudioContext({ latencyHint: 'interactive' });
    return this.ctx;
  }

  private startSource(at: number) {
    const ctx = this.context();
    const src = ctx.createBufferSource();
    src.buffer = this.track!.buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      // Only a natural end — manual stops null out this.source first.
      if (this.source !== src) return;
      this.source = null;
      this.playing = false;
      this.offset = 0;
      this.onEnded?.();
    };
    src.start(0, at);
    this.source = src;
    this.startedAt = ctx.currentTime - at;
  }

  private stopSource() {
    const src = this.source;
    this.source = null;
    if (src) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
  }
}

/** Mono RMS envelope, normalized so the loudest frame is 1. */
function buildEnvelope(buffer: AudioBuffer, hz: number): Float32Array {
  const hop = Math.max(1, Math.floor(buffer.sampleRate / hz));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  const nCh = channels.length;
  const out = new Float32Array(Math.ceil(buffer.length / hop));
  let peak = 1e-6;

  for (let frame = 0, i = 0; i < buffer.length; i += hop, frame++) {
    const end = Math.min(i + hop, buffer.length);
    let sum = 0;
    for (let s = i; s < end; s++) {
      let v = 0;
      for (let c = 0; c < nCh; c++) v += channels[c]![s]!;
      v /= nCh;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - i));
    out[frame] = rms;
    if (rms > peak) peak = rms;
  }
  for (let k = 0; k < out.length; k++) out[k]! /= peak;
  return out;
}

/** Linear-interpolated envelope lookup at time t (seconds). */
export function sampleEnvelope(env: Float32Array, t: number): number {
  const n = env.length;
  if (n === 0) return 0;
  const idx = t * ENVELOPE_HZ;
  if (idx <= 0) return env[0]!;
  if (idx >= n - 1) return env[n - 1]!;
  const i0 = Math.floor(idx);
  const a = env[i0]!;
  return a + (env[i0 + 1]! - a) * (idx - i0);
}

export const clamp = (x: number, lo: number, hi: number) =>
  x < lo ? lo : x > hi ? hi : x;
