import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SITE_CONFIG } from '../config/site.config';
import { raDecToVector } from './sky-math';
import { NAMING_FINE_PRINT, NAMING_SENT, StarNamingComponent } from './star-naming.component';
import { SkyService } from './sky.service';
import { UnnamedStar } from './sky-naming';

const gerald: UnnamedStar = { ra: 281.193, dec: 37.605, mag: 4.34, v: raDecToVector(281.193, 37.605), near: 'Vega' };
const other: UnnamedStar = { ra: 282.52, dec: 33.363, mag: 3.45, v: raDecToVector(282.52, 33.363), near: 'Sheliak' };

describe('StarNamingComponent', () => {
  let fixture: ComponentFixture<StarNamingComponent>;
  let component: StarNamingComponent;
  let http: HttpTestingController;
  let sky: SkyService;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    sky = TestBed.inject(SkyService);
    sky.unnamed.set(Array.from({ length: 766 }, () => gerald));
    sky.startNaming();
    sky.setCandidates([{ star: other, x: 100, y: 100 }, { star: gerald, x: 400, y: 120 }]);
    sky.select(gerald);
    fixture = TestBed.createComponent(StarNamingComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    sky.leaveLookUp();
    vi.useRealTimers();
  });

  const text = (selector: string) => el.querySelector(selector)!.textContent!.replace(/\s+/g, ' ').trim();

  it('names the selected star, its magnitude and how many are left, in a live region', () => {
    expect(text('.label')).toBe('name a star');
    expect(text('.title')).toBe('an unnamed star near Vega');
    expect(text('.detail')).toBe('magnitude 4.3 · 766 stars up here have no name yet');
    expect(el.querySelector('.which')!.getAttribute('aria-live')).toBe('polite');
    expect(text('.fine-print')).toBe(NAMING_FINE_PRINT);
  });

  it('steps with ‹ and › buttons', async () => {
    const [previous, next] = Array.from(el.querySelectorAll<HTMLButtonElement>('.step'));
    expect(previous.getAttribute('aria-label')).toBe('Previous unnamed star');
    expect(next.getAttribute('aria-label')).toBe('Next unnamed star');
    previous.click();
    await fixture.whenStable();
    expect(sky.selected()).toBe(other);
    expect(text('.title')).toBe('an unnamed star near Sheliak');
  });

  it('has the two fields, capped at 24, and a hidden honeypot', () => {
    const name = el.querySelector<HTMLInputElement>('#star-name')!;
    const credit = el.querySelector<HTMLInputElement>('#star-credit')!;
    expect(text('label[for="star-name"]')).toBe('Its name');
    expect(text('label[for="star-credit"]')).toBe('Named by (optional)');
    expect(name.required).toBe(true);
    expect(name.maxLength).toBe(24);
    expect(credit.maxLength).toBe(24);
    expect(credit.placeholder).toBe('a visitor');
    expect(el.querySelector('.honey-pot')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector<HTMLInputElement>('.honey-pot input')!.tabIndex).toBe(-1);
  });

  it('cannot send without a name', async () => {
    expect(component.canSubmit()).toBe(false);
    await component.submit();
    http.expectNone(SITE_CONFIG.askMorganSubmitUrl);
  });

  it('sends the suggestion to the Ask Morgan function and shows the sent state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0));
    component.name.set(' Gerald ');
    component.credit.set('sam');
    const submit = component.submit();
    const req = http.expectOne(SITE_CONFIG.askMorganSubmitUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      question: '⭐ Star name suggestion\n"Gerald" for the unnamed star near Vega (magnitude 4.3)\nnamed by: sam\napprove: [281.193, 37.605, "Gerald", "sam", "2026-10"]',
      username_honey: '',
      kind: 'star',
      name: 'Gerald',
      credit: 'sam',
      star: { ra: 281.193, dec: 37.605, mag: 4.34, near: 'Vega' },
    });
    req.flush({});
    await submit;
    await fixture.whenStable();
    expect(sky.sent()).toBe(true);
    expect(text('.sent p')).toBe(NAMING_SENT);
    expect(el.querySelector('form')).toBeNull();
  });

  it('a blank credit goes as anonymous', async () => {
    component.name.set('Gerald');
    const submit = component.submit();
    const req = http.expectOne(SITE_CONFIG.askMorganSubmitUrl);
    expect(req.request.body.credit).toBeNull();
    expect(req.request.body.question).toContain('named by: anonymous');
    req.flush({});
    await submit;
  });

  it('pretends to succeed, sending nothing, when the honeypot is filled', async () => {
    component.name.set('spam');
    component.honey.set('bot');
    await component.submit();
    http.expectNone(SITE_CONFIG.askMorganSubmitUrl);
    expect(sky.sent()).toBe(true);
  });

  it('shows an error and keeps the form when sending fails', async () => {
    component.name.set('Gerald');
    const submit = component.submit();
    http.expectOne(SITE_CONFIG.askMorganSubmitUrl).flush('down', { status: 503, statusText: 'Unavailable' });
    await submit;
    await fixture.whenStable();
    expect(sky.sent()).toBe(false);
    expect(component.error()).not.toBe('');
    expect(el.querySelector('.error')).not.toBeNull();
    expect(component.name()).toBe('Gerald');
  });

  it('name another: the next star along and an empty form', async () => {
    component.name.set('Gerald');
    sky.sent.set(true);
    component.nameAnother();
    await fixture.whenStable();
    expect(sky.sent()).toBe(false);
    expect(component.name()).toBe('');
    expect(sky.selected()).toBe(other);
  });
});
