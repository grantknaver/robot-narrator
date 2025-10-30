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
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import {
  auditTime,
  distinctUntilChanged,
  filter,
  fromEvent,
  map,
  of,
  startWith,
  Subscription,
  take,
  tap,
  combineLatest,
  shareReplay,
} from 'rxjs';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { DividerModule } from 'primeng/divider';
import { toObservable } from '@angular/core/rxjs-interop';
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

interface Character {
  name: string;
  url: string;
}

const DEFAULTS: SimpleConfig = {
  // fps: 18,
  minScale: 0.15,
  maxScale: 2.2,
  gain: 1.5,
  offset: 0,
  silenceGate: 0.05,
};

const ENVELOPE_HZ = 120; // dynamic envelope resolution (samples/sec)

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
  private _cfg!: SimpleConfig;
  private _barSetters: Array<(v: number) => void> = [];
  private _rafId: number | null = null;
  private env: number[] = []; // normalized 0..1
  private envHz = ENVELOPE_HZ; // envelope frames per second
  private duration = 0; // seconds
  private expectedEndAt = 0;
  private bookTween: gsap.core.Tween | null = null;
  private getViewportWidth = () =>
    Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  private smBreakpoint = 600;
  private widthPx = signal(this.getViewportWidth());
  private eyeEls = viewChildren<ElementRef<SVGGraphicsElement>>('eyeEl');
  private barEls = viewChildren<ElementRef<SVGGraphicsElement>>('barEl');
  private bookEl = viewChild<ElementRef<SVGGraphicsElement>>('bookEl');
  private desktopActionBtnEl =
    viewChild<ElementRef<SVGGraphicsElement>>('desktopActionBtn');
  private tl: gsap.core.Timeline = gsap.timeline({ repeat: -1, paused: true });
  private resizeSub?: Subscription;
  private player!: Tone.Player;
  private startedAt = 0; // Tone.now() at last play
  private offsetSec = 0; // accumulated pause/seek offset
  private hasEngineStarted = false;
  private _switching = false; // guards onstop during character change
  private amplitudes$ = of([]).pipe(take(1), shareReplay(1));
  private bars$ = toObservable(this.barEls).pipe(
    map((list) => list.length > 0)
  );
  private eyes$ = toObservable(this.eyeEls).pipe(
    map((list) => list.length > 0)
  );
  private book$ = toObservable(this.bookEl).pipe(map((el) => !!el));
  private domReady$ = combineLatest([this.bars$, this.eyes$, this.book$]).pipe(
    map(([eye, bars, book]) => eye && bars && book),
    distinctUntilChanged(),
    filter(Boolean),
    take(1),
    shareReplay(1),
    tap(() => console.log('domReady$ check...'))
  );
  private _manualStop = false;
  isPlaying = false;
  characters: Character[] = [];
  selectedCharacter: Character = {
    name: 'Austin',
    url: '../../../assets/austin-texas.mp3',
  };

  get isResponsive(): boolean {
    return this.widthPx() < this.smBreakpoint;
  }

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this._cfg = { ...DEFAULTS, ...this.config };
    this.characters = [
      { name: 'Austin', url: '../../../assets/austin-texas.mp3' },
      {
        name: 'Grandpa Spuds',
        url: '../../../assets/grandpa-spuds-oxley.mp3',
      },
    ];
    this.amplitudes$
      .pipe(
        take(1),
        tap(() => console.log('amplitudes$'))
      )
      .subscribe();
  }

  ngAfterViewInit(): void {
    this.domReady$.subscribe();

    combineLatest([this.amplitudes$, this.domReady$])
      .pipe(take(1))
      .subscribe(() => this.startEngine());

    this.resizeSub = fromEvent(window, 'resize')
      .pipe(
        auditTime(50),
        map(() => this.getViewportWidth()),
        startWith(this.getViewportWidth()),
        distinctUntilChanged()
      )
      .subscribe((w) => this.widthPx.set(w));
  }

  ngOnDestroy(): void {
    this.resizeSub?.unsubscribe();
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

  restartNarration() {
    if (!this.bookTween) return;
    this.bookTween
      ?.timeScale(4) // 4× faster reverse (adjust to taste)
      .reverse();

    this.bookTween?.eventCallback('onReverseComplete', () => {
      // Reset to normal speed for the next play
      this.bookTween?.timeScale(1);
      this.restartWave(); // ensures bars, eyes, etc. reset cleanly
    });
  }

  private startEngine() {
    const barsSorted = Array.from(this.barEls()).sort((a, b) => {
      const ax = a.nativeElement.getBBox().x;
      const bx = b.nativeElement.getBBox().x;
      return ax - bx;
    });
    this._barSetters = barsSorted.map(
      (ref) =>
        gsap.quickSetter(ref.nativeElement, 'scaleY') as (v: number) => void
    );
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

          const manual = this._manualStop;
          this._manualStop = false;

          if (!manual) {
            // natural end
            this.offsetSec = this.duration;
            this.bookTween?.timeScale(4).reverse();
            this.bookTween?.eventCallback('onReverseComplete', () => {
              this.bookTween!.timeScale(1);
              this.restartWave(); // this resets offsetSec to 0 on purpose
            });
          }
        },
      }).toDestination();
    });
  }

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

  async playAudio() {
    if (!this.hasEngineStarted) {
      console.log('starting engine');
      combineLatest([this.amplitudes$, this.domReady$])
        .pipe(
          take(1),
          tap(() => {
            console.log('starting engine');
            this.hasEngineStarted = true;
          })
        )
        .subscribe(() => this.startEngine());
    }
    await Tone.start();
    if (this.isPlaying) return;
    console.log('is not playing');
    console.log(
      'this.player | ',
      this.player,
      'this.duration | ',
      this.duration,
      'this.env.length | ',
      this.env.length
    );
    if (!this.player || !this.duration || !this.env.length) return; // not ready yet
    console.log('audio check');
    console.log('');
    this.tl?.play();
    this.bookTween?.play(); // NEW

    this.startedAt = Tone.now();
    this.player.start(this.startedAt, this.offsetSec);

    const remaining = Math.max(0, this.duration - this.offsetSec);
    this.expectedEndAt = this.startedAt + remaining;

    if (!this._rafId) this._rafId = requestAnimationFrame(this.renderFrame);

    this.isPlaying = true;
    this.cdr.markForCheck();
  }

  pauseAudio(force = false) {
    if (!force && !this.isPlaying) return;

    // capture BEFORE stop
    const now = Tone.now();
    this.offsetSec = Math.min(
      this.duration,
      now - this.startedAt + this.offsetSec
    );

    this._manualStop = true;
    this.player?.stop(); // after this, you can’t query position
    cancelAnimationFrame(this._rafId!);
    this._rafId = null;
    this.tl?.pause();
    this.bookTween?.reverse();
    this.isPlaying = false;
    this.cdr.markForCheck();
  }

  restartWave() {
    // Treat this as a manual stop so onstop doesn't run the natural-end path.
    this._manualStop = true;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.player?.stop(); // safe: _manualStop prevents natural branch
    this.isPlaying = false;

    // Reset clocks
    this.offsetSec = 0;
    this.expectedEndAt = 0;
    this.startedAt = 0;

    if (this._barSetters.length) this.applyBarsAtTime(0);
    this.tl?.pause(0);

    if (this.bookTween) {
      // Clear any stacked handlers and hard-reset the tween
      this.bookTween.eventCallback('onReverseComplete', null);
      this.bookTween.timeScale(1).pause(0);
    }

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

  desktopAction() {
    gsap.set(this.desktopActionBtnEl, {
      scale: 1,
      rotation: 0,
    });
    if (this.isPlaying) {
      this.pauseAudio();
    } else {
      this.playAudio();
    }
  }
}
function ref(arg0: number) {
  throw new Error('Function not implemented.');
}
