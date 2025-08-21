import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaveNarrationComponent } from '../wave-narration/wave-narration';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, WaveNarrationComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {}
