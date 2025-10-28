import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  NgZone,
  OnInit,
  ChangeDetectorRef,
  viewChild,
  viewChildren,
  Input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { gsap } from 'gsap';
import { map, Observable, of, shareReplay, take, tap } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { DividerModule } from 'primeng/divider';

type SimpleConfig = {
  fps: number;
  minScale: number;
  maxScale: number;
  gain: number;
};

const DEFAULTS: SimpleConfig = {
  fps: 18,
  minScale: 0.25,
  maxScale: 2.2,
  gain: 1.5,
};

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

  private _head = 0;
  private _cfg!: SimpleConfig;
  private _barSetters: Array<(v: number) => void> = [];

  eyeEls = viewChildren<ElementRef<SVGGraphicsElement>>('eyeEl');
  eyes: ElementRef<SVGGraphicsElement>[] = [];
  barEls = viewChildren<ElementRef<SVGGraphicsElement>>('barEl');
  bars: ElementRef<SVGGraphicsElement>[] = [];
  amplitudes: number[] = [];
  amplitudes$: Observable<number[]> = of([]);
  engineIgnition$: Observable<unknown> = new Observable();
  audioElement = viewChild<ElementRef>('audioElement');
  tl: gsap.core.Timeline = gsap.timeline({ repeat: -1, paused: true });
  isPlaying = false;
  characters: Character[] = [];
  selectedCharacter: Character = {
    name: 'Austin',
    url: '../../../assets/austin_texas_clean.mp3',
  };

  constructor(
    private ngZone: NgZone,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('Cleaned audio');
    this._cfg = { ...DEFAULTS, ...this.config };
    this.getAmplitudes();
    this.characters = [
      { name: 'Austin', url: '../../../assets/austin_texas_clean.mp3' },
      {
        name: 'Grandpa Spuds',
        url: '../../../assets/grandpa_spuds_oxley_clean.mp3',
      },
    ];
  }

  ngAfterViewInit(): void {
    this.bars = Array.from(this.barEls()).sort((a, b) => {
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
    const eyeEls = this.eyeEls().map((ref) => ref.nativeElement);
    const barEls = this.bars.map((ref) => ref.nativeElement);
    this._barSetters = barEls.map(
      (el) => gsap.quickSetter(el, 'scaleY') as (v: number) => void
    );
    const barsLength = barEls.length;
    const half = Math.floor(barsLength / 2);
    const ampsLength = this.amplitudes.length;
    const { minScale, maxScale, gain, fps } = this._cfg;
    const scaleBarSample = (s: number) =>
      minScale + this.normalize(s * gain) * (maxScale - minScale);
    this._head = 0;

    const applyFrame = () => {
      for (let i = 0; i < half; i++) {
        const sample = this.amplitudes[(this._head + i) % ampsLength];

        const b = sample <= 0.05 ? minScale : scaleBarSample(sample);
        this._barSetters[i](b);
        this._barSetters[barsLength - 1 - i](b);
      }
      if (barsLength % 2 === 1) {
        const sample = this.amplitudes[(this._head + half) % ampsLength];
        const b = sample <= 0.05 ? minScale : sample;
        this._barSetters[half](b);
      }
      this._head = (this._head + 1) % ampsLength;
    };

    this.ngZone.runOutsideAngular(() => {
      // Init transforms
      gsap.set(barEls, { transformOrigin: 'center center', scaleY: minScale });
      gsap.set(eyeEls, { transformOrigin: 'center center', x: 0 });

      // Eye sweep params
      const dx = 15;

      const frameDuration = 1 / Math.max(1, fps || 33);

      this.tl.clear();

      // Eyes together (look left/right in sync)
      if (eyeEls.length) {
        gsap.set(eyeEls, { x: -dx }); // start at left
        this.tl.to(
          eyeEls,
          {
            x: dx,
            duration: 2,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          },
          0 // start at time 0 so it runs alongside the mouth
        );
      }
      // Mouth ticker (per-frame)
      this.tl
        .to(
          {},
          {
            duration: frameDuration,
            repeat: -1,
            onRepeat: applyFrame,
          },
          0
        )
        .pause();
    });
  }

  playWave() {
    this.tl?.play();
    this.startAudio.emit(true);
  }
  pauseWave() {
    this.tl?.pause();
  }
  restartWave() {
    if (!this.tl) return;
    this._head = 0;

    this.tl.pause();
    const v = this._cfg.minScale;
    this.isPlaying = false;
    for (const set of this._barSetters) set(v);
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
