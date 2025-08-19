import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaveNarrationComponent } from './wave-narration';

describe('WaveNarrationComponent', () => {
  let component: WaveNarrationComponent;
  let fixture: ComponentFixture<WaveNarrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaveNarrationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WaveNarrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
