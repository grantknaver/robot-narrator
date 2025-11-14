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
import { FormsModule } from '@angular/forms';
import { toObservable } from '@angular/core/rxjs-interop';
import { ToneService } from '../../services.ts/tone.service';
import { v4 as uuidv4 } from 'uuid';
import { SimpleConfig } from '../../types/simplyConfig';
import { Character } from '../../types/character';

type TonePlayer = import('tone').Player;

const DEFAULTS: SimpleConfig = {
  // fps: 18,
  minScale: 0.15,
  maxScale: 2.2,
  gain: 1.5,
  offset: 0,
  silenceGate: 0.05,
};
@Component({
  selector: 'app-robot-narrator',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  private currentUrl: string | null = null;
  private duration = 0; // seconds
  private bookTween: gsap.core.Tween | null = null;
  private getViewportWidth = () =>
    Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  private envHz = this.getViewportWidth() <= 600 ? 60 : 120; // envelope frames per second
  private smBreakpoint = 600;
  private widthPx = signal(this.getViewportWidth());
  private eyeEls = viewChildren<ElementRef<SVGGraphicsElement>>('eyeEl');
  private barEls = viewChildren<ElementRef<SVGGraphicsElement>>('barEl');
  private bookEl = viewChild<ElementRef<SVGGraphicsElement>>('bookEl');
  private desktopActionBtnEl =
    viewChild<ElementRef<SVGGraphicsElement>>('desktopActionBtn');
  private tl: gsap.core.Timeline = gsap.timeline({ repeat: -1, paused: true });
  private resizeSub?: Subscription;
  private player: TonePlayer | undefined;
  private startedAt = 0; // Tone.now() at last play
  private offsetSec = 0; // accumulated pause/seek offset
  private hasEngineStarted = false;
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
    shareReplay(1)
  );
  private _manualStop = false;
  isPlaying = false;
  characters: Character[] = [
    { name: 'Austin', url: '../../../assets/austin-texas.mp3', id: uuidv4() },
    {
      name: 'Grandpa Spuds',
      url: '../../../assets/grandpa-spuds-oxley.mp3',
      id: uuidv4(),
    },
  ];
  selectedCharacter: Character;

  get isResponsive(): boolean {
    return this.widthPx() < this.smBreakpoint;
  }

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private toneService: ToneService
  ) {}

  ngOnInit(): void {
    this._cfg = { ...DEFAULTS, ...this.config };
    this.selectedCharacter = this.characters[0];
    this.amplitudes$.pipe(take(1)).subscribe();
  }
  ngAfterViewInit(): void {
    this.domReady$.subscribe();
    combineLatest([this.amplitudes$, this.domReady$])
      .pipe(take(1))
      .subscribe(() => {
        requestIdleCallback(() => this.startEngine());
        if (!this.hasEngineStarted) {
          setTimeout(() => this.startEngine(), 0);
        }
      });

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

  trackById(index: number, c: Character) {
    return c.id;
  }

  async restartNarration() {
    this.restartWave();

    // If you want Restart = "go back to start and play":
    // await this.playAudio();
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
  }

  private async setupTonePlayer(url: string): Promise<void> {
    if (this.player) {
      try {
        this.player.dispose();
      } catch (err) {
        console.log('setupTonePlayer dispose err', err);
      }
      this.player = undefined;
    }

    this.duration = 0;
    this.env = [];

    const player = await this.toneService.createPlayer({
      url,
      autostart: false,
    });

    const pAny = player as any;
    if (pAny.loaded && typeof pAny.loaded.then === 'function') {
      await pAny.loaded;
    } else {
      await player.load(url);
    }

    const buf = player.buffer?.get() as AudioBuffer | undefined;
    if (!buf) throw new Error('No AudioBuffer after load');

    this.duration = buf.duration;
    this.env = this.buildRmsEnvelope(buf, this.envHz);
    this.player = player;
    this.currentUrl = url; // ✅ remember which file this.player is for
    this.cdr.markForCheck();

    this.player.onstop = () => {
      // Just clear the manual flag; renderFrame handles the reset.
      this._manualStop = false;
    };
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

  private renderFrame = async () => {
    const t =
      (await this.toneService.now()) -
      this.startedAt +
      this.offsetSec +
      (this._cfg.offset ?? 0);

    if (this.duration && t >= this.duration) {
      // Draw the final frame so bars end in a sane state
      this.applyBarsAtTime(this.duration);

      // ✅ Hard reset everything: eyes, book, state, etc.
      this.restartWave();

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
      combineLatest([this.amplitudes$, this.domReady$])
        .pipe(
          take(1),
          tap(() => (this.hasEngineStarted = true))
        )
        .subscribe(() => this.startEngine());
    }

    await this.toneService.start();

    if (this.isPlaying) return;

    const targetUrl = this.selectedCharacter?.url;

    // 🔑 Rebuild player if:
    // - we don't have one yet
    // - or the env/duration aren't ready
    // - or the selected character changed
    if (
      !this.player ||
      !this.duration ||
      !this.env.length ||
      this.currentUrl !== targetUrl
    ) {
      this.restartWave(); // reset bars/eyes/book state
      await this.setupTonePlayer(targetUrl!);
      if (!this.player || !this.duration || !this.env.length) return;
    }

    this.tl?.play();
    this.bookTween?.play();

    this.startedAt = await this.toneService.now();

    this.player.start(this.startedAt, this.offsetSec);

    if (!this._rafId) {
      this._rafId = requestAnimationFrame(this.renderFrame);
    }

    this.isPlaying = true;
    this.cdr.markForCheck();
  }

  async pauseAudio(force = false) {
    if (!force && !this.isPlaying) return;

    const now = await this.toneService.now();
    this.offsetSec = Math.min(
      this.duration,
      now - this.startedAt + this.offsetSec
    );

    this._manualStop = true;
    this.player?.stop();
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.tl?.pause();
    this.bookTween?.reverse(); // just for the animation
    this.isPlaying = false;
    this.cdr.markForCheck();
  }

  restartWave() {
    this._manualStop = true;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this.player?.stop();
    this.isPlaying = false;

    // Reset clocks
    this.offsetSec = 0;
    this.startedAt = 0;

    if (this._barSetters.length) {
      this.applyBarsAtTime(0);
    }

    // Reset eyes timeline
    this.tl?.pause(0);

    // 🔑 Reset the book tween directly instead of waiting for reverse to finish
    if (this.bookTween) {
      this.bookTween.timeScale(1).reverse();
      this.bookTween.eventCallback('onReverseComplete', () => {
        // Put the tween back to normal speed for next time
        this.bookTween?.timeScale(1).pause(0).progress(0); // snap to "closed" (start)
        // Now that the close animation actually finished,
        // do your full reset (eyes, bars, state, etc.)
      }); // clear any old handlers
    }

    this.cdr.markForCheck();
  }

  onCharacterChange = (char: Character | null) => {
    if (!char) return;
    this.selectedCharacter = char;

    // Reset visual + timing state whenever voice changes
    this.restartWave();

    // Optional: pre-load the new voice so first Play is snappy
    // (you can leave this out and let playAudio() call setupTonePlayer)
    this.setupTonePlayer(char.url);
  };

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

  // ---------- helpers ----------
  private clamp01(x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }
}
