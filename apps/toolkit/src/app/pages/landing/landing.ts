import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RobotNarratorComponent } from '../../component/robot-narrator/robot-narrator';
import { trigger, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, RobotNarratorComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px) scale(.98)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'none' })),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateY(8px) scale(.98)' })
        ),
      ]),
    ]),
    trigger('rightFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(1rem) scale(.98)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'none' })),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateX(8px) scale(.98)' })
        ),
      ]),
    ]),
  ],
})
export class LandingComponent {
  showScript = false;
  isNarrationPlaying = false;
}
