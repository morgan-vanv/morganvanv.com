import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BasePageComponent } from './base-page.component';

describe('BasePageComponent', () => {
  let component: BasePageComponent;
  let fixture: ComponentFixture<BasePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasePageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BasePageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
