import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HOME_STOPS, HomePageComponent } from './home-page.component';
import { MAIN_ROUTES, SIDE_ROUTES } from '../../shared/main-routes';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';

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

  it('puts the welcome and Contact side by side, with the form in Contact', () => {
    const el = fixture.nativeElement as HTMLElement;
    const headings = [...el.querySelectorAll('.home-panels .panel > h2')].map(h => h.textContent?.trim());
    expect(headings).toEqual(['Welcome', 'Contact']);
    expect(el.querySelector('.welcome h2')?.classList).toContain('visually-hidden');
    expect(el.querySelector('.contact app-ask-morgan-form')).toBeTruthy();
  });

  it('lists every page in the welcome, in the nav\'s order with the Lab after Projects, each a link with its line', () => {
    const el = fixture.nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll<HTMLAnchorElement>('.welcome .stop')];
    expect(rows.map(a => a.getAttribute('href'))).toEqual(HOME_STOPS.map(stop => stop.path));
    expect(rows.map(a => a.querySelector('.pill')?.textContent?.trim())).toEqual(HOME_STOPS.map(stop => stop.name));
    expect(rows.every(a => a.querySelector('.line')?.textContent?.trim())).toBe(true);

    const pages = MAIN_ROUTES.filter(route => route.path !== 'home').map(route => `/${route.path}`);
    const known = [...pages, ...SIDE_ROUTES.map(route => `/${route.path}`)];
    expect(HOME_STOPS.every(stop => known.includes(stop.path))).toBe(true);
    expect(HOME_STOPS.map(stop => stop.path).filter(path => pages.includes(path))).toEqual(pages);
    expect(HOME_STOPS.findIndex(stop => stop.path === '/lab')).toBe(HOME_STOPS.findIndex(stop => stop.path === '/projects') + 1);
  });

  it('marks the blog under construction while it is', () => {
    const el = fixture.nativeElement as HTMLElement;
    const wip = [...el.querySelectorAll('.welcome .stop')].filter(a => a.querySelector('.wip'));
    expect(wip.map(a => a.getAttribute('href'))).toEqual(isUnderConstruction('blog') ? ['/blog'] : []);
  });

  it('ends with the porch', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.home-panels + app-home-porch')).toBeTruthy();
  });
});

describe('HomePageComponent, arriving at #home-contact', () => {
  it('scrolls the Contact panel into view', async () => {
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this); };
    try {
      await TestBed.configureTestingModule({
        imports: [HomePageComponent],
        providers: [
          provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { snapshot: { fragment: 'home-contact' } } },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(HomePageComponent);
      document.body.appendChild(fixture.nativeElement);
      await fixture.whenStable();
      expect(scrolled.map(el => el.className)).toEqual(['panel contact']);
      fixture.nativeElement.remove();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
