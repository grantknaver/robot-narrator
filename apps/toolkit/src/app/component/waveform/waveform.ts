import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  NgZone,
  OnInit,
  ViewChildren,
  QueryList,
  ChangeDetectorRef,
  viewChild,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { gsap } from 'gsap';
import {
  combineLatest,
  filter,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs';

type SimpleConfig = {
  fps: number;
  minScale: number;
  maxScale: number;
  gain: number;
};

const DEFAULTS: SimpleConfig = {
  fps: 33,
  minScale: 0.35,
  maxScale: 2.0,
  gain: 1.0,
};

@Component({
  selector: 'app-waveform',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waveform.html',
  styleUrls: ['./waveform.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveformComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() config: Partial<SimpleConfig> = { ...DEFAULTS };
  @ViewChildren('barEl', { read: ElementRef })
  barEls!: QueryList<ElementRef<SVGGraphicsElement>>;

  private _head = 0;
  private _cfg!: SimpleConfig;
  private _setters: Array<(v: number) => void> = [];
  bars: ElementRef<SVGGraphicsElement>[] = [];
  amplitudes: number[] = [];
  amplitudes$: Observable<number[]> = of([]);
  engineIgnition$: Observable<unknown> = new Observable();
  audioElement = viewChild<ElementRef>('audioElement');
  tl: gsap.core.Timeline = gsap.timeline({ repeat: -1, paused: true });
  isPlaying = false;
  character = 'Narrator';

  constructor(
    private ngZone: NgZone,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._cfg = { ...DEFAULTS, ...this.config };
    this.getAmplitudes();
  }

  ngAfterViewInit(): void {
    this.bars = Array.from(this.barEls).sort((a, b) => {
      const first = a.nativeElement.getBBox().x;
      const second = b.nativeElement.getBBox().x;
      return first - second;
    });
    this.engineIgnition$ = this.amplitudes$.pipe(
      take(1),
      tap(() => this.startEngine())
    );
  }

  getAmplitudes() {
    this.amplitudes$ = this.http.get<number[]>('assets/envelope.json').pipe(
      map((amps) => this.normalize(amps)),
      tap((amps) => {
        this.amplitudes = amps;
        this.cdr.detectChanges();
      }),
      take(1),
      shareReplay(1)
    );
  }

  private startEngine() {
    const els = this.bars.map((ref) => ref.nativeElement);
    this._setters = els.map(
      (el) => gsap.quickSetter(el, 'scaleY') as (v: number) => void
    );
    const n = els.length;
    const half = Math.floor(n / 2);
    const len = this.amplitudes.length;
    const { minScale, maxScale, gain, fps } = this._cfg;
    const scaleFromSample = (s: number) =>
      minScale + this.normalize(s * gain) * (maxScale - minScale);
    this._head = 0;

    const applyFrame = () => {
      for (let i = 0; i < half; i++) {
        const sample = this.amplitudes[(this._head + i) % len];
        const v = scaleFromSample(sample);
        this._setters[i](v);
        this._setters[n - 1 - i](v);
      }
      if (n % 2 === 1) {
        const sample = this.amplitudes[(this._head + half) % len];
        this._setters[half](scaleFromSample(sample));
      }
      this._head = (this._head + 1) % len;
    };
    this.ngZone.runOutsideAngular(() => {
      gsap.set(els, { scaleY: minScale });

      const frameDuration = 1 / Math.max(1, fps || 33);
      this.tl
        .clear()
        .to(
          {},
          {
            duration: frameDuration,
            repeat: -1,
            onRepeat: applyFrame,
          }
        )
        .pause();
    });
  }

  playWave() {
    this.tl?.play();
  }
  pauseWave() {
    this.tl?.pause();
  }
  restartWave() {
    if (!this.tl) return;
    this._head = 0;
    this.tl?.pause(0);

    const v = this._cfg.minScale;
    for (const set of this._setters) set(v);
  }

  ngOnDestroy(): void {
    this.tl?.kill();
  }

  trackByIndex(index: number) {
    return index;
  }

  normalize(v: number): number;
  normalize(arr: number[]): number[];
  normalize(data: number | number[]): number | number[] {
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

    if (!Array.isArray(data)) {
      return clamp01(data);
    }

    if (!data.length) return data;

    let min = Infinity,
      max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max <= min) return data.map(() => 0);

    const range = max - min;
    return data.map((v) => (v - min) / range);
  }

  playAudio() {
    const audioEl = this.audioElement()?.nativeElement;
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
