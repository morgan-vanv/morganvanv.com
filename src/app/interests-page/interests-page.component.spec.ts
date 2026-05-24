import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InterestsPageComponent } from './interests-page.component';

describe('SplashdownPage', () => {
  let component: InterestsPageComponent;
  let fixture: ComponentFixture<InterestsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterestsPageComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterestsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
