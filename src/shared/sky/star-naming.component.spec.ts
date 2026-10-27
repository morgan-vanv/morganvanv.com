import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SITE_CONFIG } from '../config/site.config';
import { raDecToVector } from './sky-math';
import { NAMING_ERROR, NAMING_FINE_PRINT, NAMING_SENT, StarNamingComponent } from './star-naming.component';
import { SkyService } from './sky.service';
import { UnnamedStar } from './sky-naming';

/** δ² Lyrae: genuinely unnamed, near Vega. */
const gerald: UnnamedStar = { ra: 283.626, dec: 36.899, mag: 4.22, v: raDecToVector(283.626, 36.899), near: 'Vega' };
const other: UnnamedStar = { ra: 269.441, dec: 29.248, mag: 3.7, v: raDecToVector(269.441, 29.248), near: 'Vega' };
/** Too far south ever to rise over Cincinnati. */
const southern: UnnamedStar = { ra: 100, dec: -70, mag: 4, v: raDecToVector(100, -70), near: 'Canopus' };

describe('StarNamingComponent', () => {
  let fixture: ComponentFixture<StarNamingComponent>;
  let component: StarNamingComponent;
  let http: HttpTestingController;
  let sky: SkyService;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    sky = TestBed.inject(SkyService);
    sky.unnamed.set([...Array.from({ length: 427 }, () => gerald), other, southern]);
    sky.startNaming();
    sky.setCandidates([{ star: other, x: 100, y: 100 }, { star: gerald, x: 400, y: 120 }]);
    sky.around.set([{ star: other, alt: 40, az: 100 }, { star: gerald, alt: 50, az: 200 }]);
    sky.select(gerald);
    fixture = TestBed.createComponent(StarNamingComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    document.body.append(el);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    sky.leaveLookUp();
    el.remove();
    vi.useRealTimers();
  });

  const text = (selector: string) => el.querySelector(selector)!.textContent!.replace(/\s+/g, ' ').trim();
  const type = async (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  };
  const sendOk = async () => {
    const submit = component.submit();
    http.expectOne(SITE_CONFIG.askMorganSubmitUrl).flush({});
    await submit;
    await fixture.whenStable();
  };

  it('names the selected star, its magnitude and how many unnamed stars ever rise here, in a live region', () => {
    expect(text('.label')).toBe('name a star');
    expect(text('.title')).toBe('an unnamed star near Vega');
    // 429 unnamed in the catalogue, one of which never rises over Cincinnati.
    expect(text('.detail')).toBe('magnitude 4.2 · 428 stars over Cincinnati have no name yet');
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
  });

  it('has the two fields, capped at 24, a hidden honeypot, and binds them without FormsModule', async () => {
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
    await type('#star-name', 'Gerald');
    await type('#star-credit', 'sam');
    expect(component.name()).toBe('Gerald');
    expect(component.credit()).toBe('sam');
    expect(component.canSubmit()).toBe(true);
  });

  it('disables the fields while there is no star to name (by day, say)', async () => {
    sky.select(null);
    await fixture.whenStable();
    expect(text('.title')).toBe('no unnamed stars in view');
    expect(el.querySelector<HTMLInputElement>('#star-name')!.disabled).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#star-credit')!.disabled).toBe(true);
  });

  it('cannot send without a name', async () => {
    expect(component.canSubmit()).toBe(false);
    await component.submit();
    http.expectNone(SITE_CONFIG.askMorganSubmitUrl);
  });

  it('submitting the form sends the suggestion and shows the sent state, focusing "name another"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0));
    await type('#star-name', ' Gerald ');
    await type('#star-credit', 'sam');
    const form = el.querySelector('form')!;
    const submitEvent = new Event('submit', { cancelable: true });
    form.dispatchEvent(submitEvent);
    expect(submitEvent.defaultPrevented).toBe(true);
    const req = http.expectOne(SITE_CONFIG.askMorganSubmitUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      question: '⭐ Star name suggestion\n"Gerald" for the unnamed star near Vega (magnitude 4.2)\nnamed by: sam\napprove: [283.626, 36.899, "Gerald", "sam", "2026-10"]',
      username_honey: '',
      kind: 'star',
      name: 'Gerald',
      credit: 'sam',
      star: { ra: 283.626, dec: 36.899, mag: 4.22, near: 'Vega' },
    });
    req.flush({});
    await vi.waitFor(() => expect(sky.sent()).toBe(true));
    await fixture.whenStable();
    expect(el.querySelector('form')).toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe('name another');
  });

  it('announces through one live region that is always there, changing only its text', async () => {
    const status = el.querySelector('[role="status"]')!;
    expect(status.textContent!.trim()).toBe('');
    component.name.set('Gerald');
    const failing = component.submit();
    http.expectOne(SITE_CONFIG.askMorganSubmitUrl).flush('down', { status: 503, statusText: 'Unavailable' });
    await failing;
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent!.trim()).toBe(NAMING_ERROR);
    expect(component.name()).toBe('Gerald'); // kept, to try again
    await sendOk();
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent!.trim()).toBe(NAMING_SENT);
    expect(el.querySelectorAll('[aria-live="assertive"], [role="alert"]').length).toBe(0);
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

  it('name another: the next star along, an empty form, and focus in the name field', async () => {
    component.name.set('Gerald');
    component.credit.set('sam');
    await sendOk();
    el.querySelector<HTMLButtonElement>('.actions .primary')!.click();
    await fixture.whenStable();
    expect(sky.sent()).toBe(false);
    expect(sky.selected()).toBe(other);
    expect(component.name()).toBe('');
    expect(el.querySelector<HTMLInputElement>('#star-name')!.value).toBe('');
    expect(document.activeElement).toBe(el.querySelector('#star-name'));
  });

  it('a sent name never comes back for the next star, however that star is picked (‹ ›, a tap on the sky)', async () => {
    component.name.set('Gerald');
    component.credit.set('sam');
    await sendOk();
    // Stepping (or a tap on the sky, which also selects) leaves the sent state…
    sky.step(1);
    await fixture.whenStable();
    expect(sky.sent()).toBe(false);
    // …and the form comes back empty, so one click can't resend the same name for a different star.
    expect(component.name()).toBe('');
    expect(component.credit()).toBe('');
    expect(el.querySelector<HTMLInputElement>('#star-name')!.value).toBe('');
    expect(component.canSubmit()).toBe(false);
  });
});
