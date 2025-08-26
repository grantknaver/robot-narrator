import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NarrationComponent } from './narration';

describe('NarrationComponent', () => {
  let component: NarrationComponent;
  let fixture: ComponentFixture<NarrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NarrationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NarrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
