import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RobotNarratorComponent } from '../../component/robot-narrator/robot-narrator';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, RobotNarratorComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {}
