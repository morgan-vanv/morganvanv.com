import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CustomNavbarComponent } from './custom-navbar.component';

describe('CustomNavbarComponent', () => {
  let component: CustomNavbarComponent;
  let fixture: ComponentFixture<CustomNavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomNavbarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomNavbarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
