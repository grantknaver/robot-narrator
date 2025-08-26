import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NarrationComponent } from '../../component/narration/narration';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, NarrationComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {}
