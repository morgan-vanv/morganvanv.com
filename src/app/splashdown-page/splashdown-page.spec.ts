import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SplashdownPage } from './splashdown-page';

describe('SplashdownPage', () => {
  let component: SplashdownPage;
  let fixture: ComponentFixture<SplashdownPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplashdownPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SplashdownPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
