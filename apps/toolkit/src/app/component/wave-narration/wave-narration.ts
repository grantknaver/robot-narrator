import {
  ChangeDetectionStrategy, Component, AfterViewInit, OnDestroy,
  ElementRef, NgZone, OnInit, ViewChildren, QueryList, ChangeDetectorRef,
  viewChild,
  Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { gsap } from 'gsap';
import { Observable, of, tap } from 'rxjs';


type SimpleConfig = {
  fps: number;        // how fast the wave updates (~frames per second)
  minScale: number;   // shortest bar
  maxScale: number;   // tallest bar
  gain: number;       // boost the envelope 0..1 before mapping
};

const DEFAULTS: SimpleConfig = {
  fps: 33,
  minScale: 0.35,
  maxScale: 2.0,
  gain: 1.0,
};

@Component({
  selector: 'app-wave-narration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wave-narration.html',
  styleUrls: ['./wave-narration.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveNarrationComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() fixedBarCount = 32;
  @Input() config: Partial<SimpleConfig> = {...DEFAULTS};


  private _hasEngineStarted = false;
  private _head = 0;
  private _cfg!: SimpleConfig;
  private _len = 0;
  private _setters: Array<(v: number) => void> = [];
  fixedBars = Array.from({ length: 32 });
  audioElement = viewChild<ElementRef>('audioElement')
  amplitudes: number[] = [];
  amplitudes$: Observable<number[]> = of([]);
  @ViewChildren('barEl', { read: ElementRef })
  barEls!: QueryList<ElementRef<HTMLElement>>;
  tl: gsap.core.Timeline = gsap.timeline({ repeat: -1, paused: true });
  isPlaying = false;

  constructor(
    private ngZone: NgZone,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  /** Load + normalize your envelope JSON */
  ngOnInit(): void {
    this._cfg = { ...DEFAULTS, ...this.config };


    this.amplitudes$ = this.http.get<number[]>('assets/envelope.json').pipe(
      tap((amps) => {
        this.amplitudes = this.normalize(amps); // 0..1
        this.maybeStart();                      // try to start once data arrives
        this.cdr.detectChanges();
      }),
    );
    // Important: actually subscribe so the HTTP request fires
    this.amplitudes$.subscribe();
  }

  /** Watch for DOM readiness (bars rendered) */
  ngAfterViewInit(): void {
    // Initial check
    if (this.barEls?.length) this.maybeStart();

    // In case bars render later or change
    this.barEls.changes.subscribe(() => {
      if (this.barEls.length) this.maybeStart();
    });
  }

  /** Start only once, after BOTH DOM + data are ready */
  private maybeStart() {
    if (this._hasEngineStarted) return;
    if (!this.barEls?.length) return;          // need DOM
    if (!this.amplitudes?.length) return;      // need data
    this._hasEngineStarted = true;
    this.startEngine();
  }

  /** Build a symmetric wave driven by your envelope samples */
  private startEngine() {
    const els = this.barEls.map((ref) => ref.nativeElement);
    const setters = els.map((el) => gsap.quickSetter(el, 'scaleY') as (v: number) => void);

    this._setters = setters;
    const n = els.length;
    const half = Math.floor(n / 2);
    const len = this.amplitudes.length;

    // Map a 0..1 sample to your desired scale range (same as your old rand() range)
    const scaleFromSample = (s: number) => 0.35 + s * (2.0 - 0.35);

    // Current read head into the envelope array
    this._head = 0;

    const applyFrame = () => {
      // Fill pairs symmetrically from center-out using the current “window” of samples
      for (let i = 0; i < half; i++) {
        const sample = this.amplitudes[(this._head + i) % len];
        const v = scaleFromSample(sample);
        setters[i](v);
        setters[n - 1 - i](v);
      }
      if (n % 2 === 1) {
        const sample = this.amplitudes[(this._head + half) % len];
        setters[half](scaleFromSample(sample));
      }
      this._head = (this._head + 1) % len; // advance through your envelope
    };

    this.ngZone.runOutsideAngular(() => {
      // Set initial transform origin and base scale
      gsap.set(els, { transformOrigin: 'bottom center', scaleY: 1 });

      // Drive the updates at a steady tempo using a tiny repeating tween.
      // Tweak "frameDuration" to speed up/slow down the wave.
      const frameDuration = 0.03; // seconds between frames (~33 FPS)
      this.tl.clear().to({}, {
        duration: frameDuration,
        repeat: -1,
        onRepeat: applyFrame,
      }).pause(); // keep it stopped until you call play()
    });
  }

  /** Public controls you can call from template buttons if you want */
  playWave() { this.tl?.play(); }
  pauseWave() { this.tl?.pause(); }
  restartWave() {
    if (!this.tl) return;
    this._head = 0;
    this.tl?.pause(0);

        // flat baseline so reset is obvious
    const v = this._cfg.minScale;
    for (const set of this._setters) set(v);
   }

  ngOnDestroy(): void {
    this.tl?.kill();
  }

  trackByIndex(index: number) { return index; }

  normalize(arr: number[]) {
    if (!arr.length) return arr;
    let min = Infinity, max = -Infinity;
    for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
    if (max <= min) return arr.map(() => 0);
    return arr.map(v => (v - min) / (max - min));
  }

  playAudio() {
    const audioEl= this.audioElement()?.nativeElement;
    audioEl.play();
    this.playWave();
    this.isPlaying = true;
  }

  pauseAudio() {
    const audioEl = this.audioElement()?.nativeElement;
    audioEl.currentTime = 0;
    audioEl.pause();
    this.restartWave();
    this.isPlaying = false;
  }
}
