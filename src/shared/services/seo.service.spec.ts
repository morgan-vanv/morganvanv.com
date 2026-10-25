import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { routes } from '../../app/app.routes';
import { SeoTitleStrategy } from './seo.service';
import { MAIN_ROUTES } from '../main-routes';
import { SITE_CONFIG } from '../config/site.config';

describe('SeoTitleStrategy', () => {
  let router: Router;
  let title: Title;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: TitleStrategy, useClass: SeoTitleStrategy }],
    });
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
  });

  it('uses the bare domain on the greeting page', async () => {
    await router.navigateByUrl('/');
    expect(title.getTitle()).toBe(SITE_CONFIG.domain);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE_CONFIG.url}/`);
  });

  it('sets a suffixed title, the route description and canonical URL on main pages', async () => {
    const route = MAIN_ROUTES[3];
    await router.navigateByUrl(`/${route.path}`);
    expect(title.getTitle()).toBe(`${route.title} · ${SITE_CONFIG.domain}`);
    expect(meta.getTag('name="description"')?.content).toBe(route.description);
    expect(meta.getTag('property="og:url"')?.content).toBe(`${SITE_CONFIG.url}/${route.path}/`);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE_CONFIG.url}/${route.path}/`);
  });

  it('adds one JSON-LD Person block', () => {
    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts.length).toBe(1);
    const person = JSON.parse(scripts[0].textContent ?? '{}');
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe(SITE_CONFIG.name);
    expect(person.sameAs.length).toBeGreaterThan(3);
  });
});
