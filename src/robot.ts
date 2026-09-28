import { gsap } from 'gsap';

export interface MouthConfig {
  /** Bar scaleY when silent */
  minScale: number;
  /** Bar scaleY at full loudness */
  maxScale: number;
  /** Multiplier on normalized loudness before clamping */
  gain: number;
  /** Loudness below this reads as silence */
  silenceGate: number;
  /** Time offset (s) between neighbouring bars — makes the mouth "ripple" */
  barSpread: number;
  /** Smoothing time constants (s) */
  attack: number;
  release: number;
}

export const DEFAULT_MOUTH: MouthConfig = {
  minScale: 0.15,
  maxScale: 2.2,
  gain: 1.5,
  silenceGate: 0.05,
  barSpread: 1 / 90,
  attack: 0.018,
  release: 0.085,
};

/**
 * Owns every moving part of the robot SVG:
 *  - mouth bars (driven per-frame from loudness)
 *  - eyes (look side-to-side while reading, blink now and then)
 *  - book (lifts while reading, drops when stopped)
 */
export class Robot {
  readonly barCount: number;
  private setBar: Array<(v: number) => void>;
  private barValues: Float32Array;
  private eyes: SVGElement[];
  private book: SVGElement;
  private scan: gsap.core.Timeline | null = null;
  private blinkTimer = 0;
  private reduced: boolean;

  constructor(
    svg: SVGSVGElement,
    private mouth: MouthConfig = DEFAULT_MOUTH,
  ) {
    const bars = [...svg.querySelectorAll<SVGElement>('[data-bar]')].sort(
      (a, b) => Number(a.dataset.bar) - Number(b.dataset.bar),
    );
    this.eyes = [...svg.querySelectorAll<SVGElement>('[data-eye]')];
    this.book = svg.querySelector<SVGElement>('[data-book]')!;
    this.barCount = bars.length;
    this.barValues = new Float32Array(bars.length).fill(mouth.minScale);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    gsap.set(bars, { transformOrigin: '50% 50%', scaleY: mouth.minScale });
    gsap.set(this.eyes, { transformOrigin: '50% 50%', x: 0, scaleY: 1 });
    gsap.set(this.book, { transformOrigin: '50% 50%', y: 0 });
    this.setBar = bars.map(
      (el) => gsap.quickSetter(el, 'scaleY') as (v: number) => void,
    );

    if (!this.reduced) this.scheduleBlink();
  }

  /** Time offset for bar i, centred on the middle bar. */
  barOffset(i: number): number {
    return (i - Math.floor(this.barCount / 2)) * this.mouth.barSpread;
  }

  /**
   * Push loudness levels (0..1 per bar) into the mouth.
   * Returns true once every bar has settled (safe to stop the render loop).
   */
  renderMouth(levels: ArrayLike<number>, dt: number): boolean {
    const { minScale, maxScale, gain, silenceGate, attack, release } =
      this.mouth;
    const kUp = 1 - Math.exp(-dt / attack);
    const kDown = 1 - Math.exp(-dt / release);
    let settled = true;

    for (let i = 0; i < this.barCount; i++) {
      const l = levels[i] ?? 0;
      const target =
        l <= silenceGate
          ? minScale
          : minScale + Math.min(1, l * gain) * (maxScale - minScale);
      const cur = this.barValues[i]!;
      const next = cur + (target - cur) * (target > cur ? kUp : kDown);
      this.barValues[i] = next;
      this.setBar[i]!(next);
      if (Math.abs(next - target) > 0.002) settled = false;
    }
    return settled;
  }

  /** Start/stop the "reading" body language. */
  setReading(reading: boolean) {
    gsap.killTweensOf(this.book);
    this.scan?.kill();
    this.scan = null;

    if (reading) {
      gsap.to(this.book, {
        y: -100,
        duration: this.reduced ? 0 : 0.5,
        ease: 'back.out(1.6)',
      });
      if (!this.reduced) {
        // glance to the start of the line, then scan back and forth
        this.scan = gsap
          .timeline()
          .to(this.eyes, { x: -15, duration: 0.35, ease: 'power2.out' })
          .to(this.eyes, {
            x: 15,
            duration: 2,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
      }
    } else {
      gsap.to(this.book, {
        y: 0,
        duration: this.reduced ? 0 : 0.6,
        ease: 'bounce.out',
      });
      gsap.to(this.eyes, {
        x: 0,
        duration: this.reduced ? 0 : 0.4,
        ease: 'power2.out',
      });
    }
  }

  destroy() {
    clearTimeout(this.blinkTimer);
    gsap.killTweensOf([...this.eyes, this.book]);
  }

  private scheduleBlink() {
    this.blinkTimer = window.setTimeout(
      () => {
        gsap.to(this.eyes, {
          scaleY: 0.1,
          duration: 0.07,
          ease: 'power1.in',
          yoyo: true,
          repeat: 1,
          overwrite: false,
        });
        this.scheduleBlink();
      },
      2500 + Math.random() * 4000,
    );
  }
}
