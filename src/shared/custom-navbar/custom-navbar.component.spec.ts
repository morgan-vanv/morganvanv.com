import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomNavbarComponent } from './custom-navbar.component';

describe('SplashdownPage', () => {
  let component: CustomNavbarComponent;
  let fixture: ComponentFixture<CustomNavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomNavbarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomNavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
