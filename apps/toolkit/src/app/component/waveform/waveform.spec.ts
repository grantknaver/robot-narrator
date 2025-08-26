import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaveformComponent } from './waveform';

describe('WaveNarrationComponent', () => {
  let component: WaveformComponent;
  let fixture: ComponentFixture<WaveformComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaveformComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WaveformComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
