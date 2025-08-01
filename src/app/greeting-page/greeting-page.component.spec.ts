import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GreetingPageComponent } from './greeting-page.component';

describe('LandingPage', () => {
  let component: GreetingPageComponent;
  let fixture: ComponentFixture<GreetingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GreetingPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GreetingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
