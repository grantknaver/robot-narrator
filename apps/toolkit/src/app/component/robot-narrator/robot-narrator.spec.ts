import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RobotNarratorComponent } from './robot-narrator';

describe('WaveNarrationComponent', () => {
  let component: RobotNarratorComponent;
  let fixture: ComponentFixture<RobotNarratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RobotNarratorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RobotNarratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
