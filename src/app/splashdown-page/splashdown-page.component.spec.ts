import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SplashdownPageComponent } from './splashdown-page.component';

describe('SplashdownPage', () => {
  let component: SplashdownPageComponent;
  let fixture: ComponentFixture<SplashdownPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplashdownPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SplashdownPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
