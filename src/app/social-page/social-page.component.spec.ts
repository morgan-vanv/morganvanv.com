import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialPageComponent } from './social-page.component';

describe('SocialPageComponent', () => {
  let component: SocialPageComponent;
  let fixture: ComponentFixture<SocialPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialPageComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SocialPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
