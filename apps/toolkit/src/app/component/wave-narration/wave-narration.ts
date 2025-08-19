import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-wave-narration',
  imports: [CommonModule],
  templateUrl: './wave-narration.html',
  styleUrl: './wave-narration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveNarrationComponent {}
