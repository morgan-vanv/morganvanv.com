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

  it('puts the webring line under the card and, for small screens, at the end of the scroll', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector(':scope > app-site-strip.strip-under-card')).not.toBeNull();
    expect(el.querySelector('.page-content > app-site-strip.strip-in-card:last-child')).not.toBeNull();
  });
});
