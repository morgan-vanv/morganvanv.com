import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let component: HomePageComponent;
  let fixture: ComponentFixture<HomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the h-card band with its own h1 and rel="me" social links', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    const card = el.querySelector('.h-card');
    expect(card?.querySelector('h1.p-name')?.textContent?.trim()).toBe('Morgan Van Valkenburgh');
    expect(card?.querySelector('img.u-photo')).toBeTruthy();
    expect(card?.querySelector('.p-note')).toBeTruthy();
    const links = [...(card?.querySelectorAll('.social-media-container a') ?? [])];
    expect(links.length).toBe(component.socialLinks.length);
    for (const [i, link] of component.socialLinks.entries()) {
      expect(links[i].getAttribute('rel')).toBe(link.external ? 'me noopener noreferrer' : null);
    }
  });

  it('puts the intro and contact in panels, with the form in Contact', () => {
    const el = fixture.nativeElement as HTMLElement;
    const headings = [...el.querySelectorAll('.home-panels .panel h2')].map(h => h.textContent?.trim());
    expect(headings).toEqual(["What's going on here?", 'Contact']);
    expect(el.querySelector('.contact app-ask-morgan-form')).toBeTruthy();
  });
});
