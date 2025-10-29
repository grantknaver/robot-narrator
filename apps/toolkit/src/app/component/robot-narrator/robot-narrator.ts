import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  NgZone,
  OnInit,
  ChangeDetectorRef,
  viewChildren,
  Input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { Observable, of, shareReplay, take, tap } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { DividerModule } from 'primeng/divider';
import * as Tone from 'tone';

type SimpleConfig = {
  // Originally for GSAP eye sweep only
  // fps: number;
  // Bar scaling
  minScale: number;
  maxScale: number;
  gain: number;
  // Small timing nudge if needed (positive = bars ahead)
  offset?: number;
  // Silence gate for tiny noise
  silenceGate?: number; // 0..1
};

const DEFAULTS: SimpleConfig = {
  // fps: 18,
  minScale: 0.15,
  maxScale: 2.2,
  gain: 1.5,
  offset: 0,
  silenceGate: 0.05,
};

const ENVELOPE_HZ = 120; // dynamic envelope resolution (samples/sec)

interface Character {
  name: string;
  url: string;
}

@Component({
  selector: 'app-robot-narrator',
  standalone: true,
  imports: [CommonModule, SelectModule, FormsModule, DividerModule],
  templateUrl: './robot-narrator.html',
  styleUrls: ['./robot-narrator.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RobotNarratorComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @Input() config: Partial<SimpleConfig> = { ...DEFAULTS };
  readonly startAudio = output<boolean>();

  // ----- state -----
  private _cfg!: SimpleConfig;
  private _barSetters: Array<(v: number) => void> = [];
  private _rafId: number | null = null;

  // Dynamic envelope derived from decoded audio
  private env: number[] = []; // normalized 0..1
  private envHz = ENVELOPE_HZ; // envelope frames per second
  private duration = 0; // seconds
  expectedEndAt = 0;
  private bookTween: gsap.core.Tween | null = null;

  // Eyes + barsrefs
  eyeEls = viewChildren<ElementRef<SVGGraphicsElement>>('eyeEl');
  barEls = viewChildren<ElementRef<SVGGraphicsElement>>('barEl');
  bookEl = viewChild<ElementRef<SVGGraphicsElement>>('bookEl'); // NEW

  // Eye timeline: created paused; we won’t pause it in startEngine
  tl: gsap.core.Timeline = gsap.timeline({ repeat: -1, paused: true });
  isPlaying = false;
  characters: Character[] = [];
  selectedCharacter: Character = {
    name: 'Austin',
    url: '../../../assets/austin-texas.mp3',
  };

  // Tone
  player!: Tone.Player;

  // Playback clock bookkeeping (no Transport; use Tone.now())
  private startedAt = 0; // Tone.now() at last play
  private offsetSec = 0; // accumulated pause/seek offset

  // To keep your engineIgnition$ flow (DOM ready → build engine)
  amplitudes$: Observable<number[]> = of([]);
  engineIgnition$: Observable<unknown> = new Observable();
  private _switching = false; // guards onstop during character change

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this._cfg = { ...DEFAULTS, ...this.config };
    this.characters = [
      { name: 'Austin', url: '../../../assets/austin-texas.mp3' },
      {
        name: 'Grandpa Spuds',
        url: '../../../assets/grandpa-spuds-oxley.mp3',
      },
    ];
    // Emit once so engineIgnition$ can fire after view init
    this.amplitudes$ = of([]).pipe(take(1), shareReplay(1));
  }

  ngAfterViewInit(): void {
    // Sort bars left->right, prep setters
    const barsSorted = Array.from(this.barEls()).sort((a, b) => {
      const ax = a.nativeElement.getBBox().x;
      const bx = b.nativeElement.getBBox().x;
      return ax - bx;
    });
    this._barSetters = barsSorted.map(
      (ref) =>
        gsap.quickSetter(ref.nativeElement, 'scaleY') as (v: number) => void
    );

    // Build engine once amplitudes$ emits (we don’t actually need it; this matches your prior wiring)
    this.engineIgnition$ = this.amplitudes$.pipe(
      take(1),
      tap(() => this.startEngine())
    );
  }

  ngOnDestroy(): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    try {
      this.player?.dispose();
    } catch (err) {
      console.log('ngOnDestroy err', err);
    }
    this.tl?.kill();
  }

  // ---------- engine (build-only; leaves everything paused) ----------
  private startEngine() {
    console.log('startEngine');
    const eyeEls = this.eyeEls().map((r) => r.nativeElement);
    const barEls = this.barEls().map((r) => r.nativeElement);
    const { minScale } = this._cfg;

    this.ngZone.runOutsideAngular(() => {
      // Bars initial transform
      gsap.set(barEls, { transformOrigin: 'center center', scaleY: minScale });

      // Eyes: compose tweens on an already-paused timeline; DO NOT .pause() here
      this.tl.clear();
      const dx = 15;
      if (eyeEls.length) {
        gsap.set(eyeEls, { transformOrigin: 'center center', x: -dx });
        this.tl.to(
          eyeEls,
          {
            x: dx,
            duration: 2,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          },
          0
        );
      }

      const book = this.bookEl()?.nativeElement;
      if (book) {
        gsap.set(book, { y: 0, transformOrigin: 'center center' });
        this.bookTween = gsap.to(book, {
          y: -100,
          duration: 0.5,
          ease: 'power1.out',
          paused: true,
        });
      }
    });

    // Prepare the audio player after visuals are ready
    this.setupTonePlayer(this.selectedCharacter.url);
  }

  private setupTonePlayer(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Dispose any previous player
      if (this.player) {
        try {
          this.player.dispose();
        } catch (err) {
          console.log('player', err);
        }
        this.player = undefined as any;
      }

      // Reset decoded state for the new file
      this.duration = 0;
      this.env = [];

      const player = new Tone.Player({
        url,
        autostart: false,
        onload: () => {
          try {
            const buf = player.buffer?.get() as AudioBuffer | undefined;
            if (!buf) throw new Error('No AudioBuffer after load');

            this.duration = buf.duration;
            this.env = this.buildRmsEnvelope(buf, this.envHz);

            this.player = player; // set only after success
            this.cdr.markForCheck();
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        onstop: () => {
          if (this._switching) return;

          const EPS = 0.2; // 200ms
          const naturalEnd = Math.abs(Tone.now() - this.expectedEndAt) <= EPS;

          if (naturalEnd) {
            // Smoothly return the book, then reset visuals/state
            if (this.bookTween) {
              this.bookTween
                .timeScale(2) // 4× faster reverse (adjust to taste)
                .reverse();

              this.bookTween.eventCallback('onReverseComplete', () => {
                // Reset to normal speed for the next play
                this.bookTween!.timeScale(1);
                this.restartWave(); // ensures bars, eyes, etc. reset cleanly
              });
            } else {
              // Fallback if tween didn't exist for some reason
              const book = this.bookEl()?.nativeElement;
              if (book) {
                alert('end');
                gsap.to(book, {
                  y: 0,
                  duration: 0.3,
                  ease: 'power2.out',
                  onComplete: () => this.restartWave(),
                });
              } else {
                this.restartWave();
              }
            }
            return;
          }

          // manual stop/pause
          this.pauseAudio(true);
        },
      }).toDestination();
    });
  }

  // ---------- envelope builder ----------
  private buildRmsEnvelope(buffer: AudioBuffer, envHz: number): number[] {
    const sr = buffer.sampleRate; // e.g. 44100
    const hop = Math.max(1, Math.floor(sr / envHz)); // samples per envelope frame
    const win = hop; // window size ~ hop

    // Mixdown to mono
    const chs = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i)
    );
    const N = buffer.length;
    const outLen = Math.ceil(N / hop);
    const env = new Array<number>(outLen);

    let maxRms = 1e-6;
    for (let i = 0, frame = 0; i < N; i += hop, frame++) {
      const start = i;
      const end = Math.min(i + win, N);
      const n = end - start;
      let sumSq = 0;

      for (let s = start; s < end; s++) {
        let v = 0;
        for (let c = 0; c < chs.length; c++) v += chs[c][s];
        v /= chs.length;
        sumSq += v * v;
      }

      const rms = Math.sqrt(sumSq / Math.max(1, n));
      env[frame] = rms;
      if (rms > maxRms) maxRms = rms;
    }

    // Normalize to 0..1
    if (maxRms > 0) for (let k = 0; k < env.length; k++) env[k] /= maxRms;
    return env;
  }

  // ---------- render loop (bars driven by audio clock) ----------
  private renderFrame = () => {
    const t =
      Tone.now() - this.startedAt + this.offsetSec + (this._cfg.offset ?? 0);

    if (this.duration && t >= this.duration) {
      this.applyBarsAtTime(this.duration);
      this.pauseAudio(); // stop audio + rAF; eyes paused by pauseAudio
      return;
    }

    this.applyBarsAtTime(t);
    this._rafId = requestAnimationFrame(this.renderFrame);
  };

  private applyBarsAtTime(tSec: number) {
    const { minScale, maxScale, gain, silenceGate = 0.05 } = this._cfg;
    const setters = this._barSetters;
    const n = setters.length;
    const half = Math.floor(n / 2);

    for (let i = 0; i < n; i++) {
      const s = this.sampleEnv(tSec + (i - half) / this.envHz);
      const scaled =
        s <= silenceGate
          ? minScale
          : minScale + this.clamp01(s * gain) * (maxScale - minScale);
      setters[i](scaled);
    }
  }

  private sampleEnv(tSec: number): number {
    const env = this.env;
    const N = env.length;
    if (N === 0 || this.envHz <= 0) return 0;

    if (tSec <= 0) return env[0];
    const idx = tSec * this.envHz;
    if (idx >= N - 1) return env[N - 1];

    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const a = env[i0];
    const b = env[i0 + 1];
    return a + (b - a) * frac;
  }

  // ---------- controls ----------
  async playAudio() {
    await Tone.start();
    if (this.isPlaying) return;
    if (!this.player || !this.duration || !this.env.length) return; // not ready yet

    this.tl?.play();
    this.bookTween?.play(); // NEW

    this.startedAt = Tone.now();
    this.player.start(this.startedAt, this.offsetSec);

    const remaining = Math.max(0, this.duration - this.offsetSec);
    this.expectedEndAt = this.startedAt + remaining;

    if (!this._rafId) this._rafId = requestAnimationFrame(this.renderFrame);

    this.startAudio.emit(true);
    this.isPlaying = true;
    this.cdr.markForCheck();
  }

  pauseAudio(force = false) {
    if (!force && !this.isPlaying) return;
    try {
      this.player?.stop();
    } catch (err) {
      console.log('pauseAudio', err);
    }
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.tl?.pause();
    this.bookTween?.reverse(); // NEW (go back up)
    this.isPlaying = false;
    this.cdr.markForCheck();
  }

  // optional: restart to t=0
  restartWave() {
    // Hard stop everything regardless of current flag
    this.pauseAudio(true);

    // Reset clock and visuals
    this.offsetSec = 0;
    this.expectedEndAt = 0;

    const v = this._cfg.minScale;
    for (const set of this._barSetters) set(v);

    this.tl?.pause(0);
    this.bookTween?.pause(0);

    // Ensure UI updates under OnPush
    this.cdr.markForCheck();
  }

  async selectCharacter() {
    this.restartWave(); // sets offsetSec = 0, resets bars/eyes

    // Commit selection (so UI reflects it immediately)
    this.cdr.markForCheck();

    // Load new player + build new envelope
    this._switching = true;
    try {
      await this.setupTonePlayer(this.selectedCharacter.url);
    } finally {
      this._switching = false;
    }

    // If we were playing before, resume automatically from t=0
    if (this.isPlaying) {
      this.offsetSec = 0;
      await this.playAudio();
    }
  }

  // ---------- helpers ----------
  private clamp01(x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }
}
