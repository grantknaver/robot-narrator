import { ChangeDetectionStrategy, Component, AfterViewInit, OnDestroy, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';

@Component({
  selector: 'app-wave-narration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wave-narration.html',
  styleUrls: ['./wave-narration.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveNarrationComponent implements AfterViewInit, OnDestroy {
  // Number of bars you want
  bars = Array.from({ length: 32 });

  tl: gsap.core.Timeline = gsap.timeline({repeat: -1, paused: true})
  rand = gsap.utils.random(0.35, 2.0, true);

  constructor(private el: ElementRef<HTMLElement>, private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    // Keep Angular change detection calm while animating

      // IMPORTANT: scope selection to this component so multiple instances don't clash
      const els = gsap.utils.toArray<HTMLElement>(
        this.el.nativeElement.querySelectorAll('.bar')
      );

      const n = els.length;
      const half = Math.floor(n / 2);
      const targets: number[] = new Array(n);

      // Fill a mirrored array of scale factors so the waveform is symmetric
      const fillTargets = () => {
        for (let i = 0; i < half; i++) {
          const v = this.rand();
          targets[i] = v;
          targets[n - 1 - i] = v; // mirror
        }
        if (n % 2 === 1) targets[half] = this.rand(); // center bar for odd counts
      };

      // Initial setup
      gsap.set(els, { transformOrigin: 'bottom center', scaleY: 1 });
      fillTargets();

      // A timeline is a container for tweens; we repeat the whole wave forever

      // The tween animates all bars toward the current targets, then yoyos back
      this.tl.to(els, {
        scaleY: (i) => targets[i],
        duration: 0.35,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1, // forward then back = 1 repeat with yoyo
        stagger: { each: 0.03, from: 'center' },
        onRepeat: fillTargets, // reshuffle heights each cycle
      });

      this.tl.pause()

  }

  ngOnDestroy(): void {
    this.tl?.kill();
  }

  // TrackBy to keep DOM stable (index + item signature)
  trackByIndex(index: number, _item: unknown): number {
    return index;
  }
}
