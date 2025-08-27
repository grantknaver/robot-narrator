import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaveformComponent } from '../waveform/waveform';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';

import { InputIconModule } from 'primeng/inputicon';

@Component({
  selector: 'app-narration',
  imports: [CommonModule, ButtonModule, IconFieldModule, WaveformComponent, InputIconModule],
  templateUrl: './narration.html',
  styleUrl: './narration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NarrationComponent {}
