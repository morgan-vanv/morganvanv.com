import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AskMorganFormComponent } from './ask-morgan-form';
import { SITE_CONFIG } from '../../../shared/config/site.config';

describe('AskMorganFormComponent', () => {
  let component: AskMorganFormComponent;
  let fixture: ComponentFixture<AskMorganFormComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AskMorganFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AskMorganFormComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('cannot submit an empty question', async () => {
    expect(component.canSubmit()).toBe(false);
    await component.submitForm();
    http.expectNone(SITE_CONFIG.askMorganSubmitUrl);
  });

  it('posts the trimmed question and shows the success state', async () => {
    component.question.set('  why?  ');
    const submit = component.submitForm();
    const req = http.expectOne(SITE_CONFIG.askMorganSubmitUrl);
    expect(req.request.body).toEqual({ question: '❓ Question\nwhy?', kind: 'question', text: 'why?', username_honey: '' });
    req.flush({});
    await submit;
    expect(component.isSuccess()).toBe(true);
    expect(component.isSubmitting()).toBe(false);
  });

  it('silently "succeeds" without a request when the honeypot is filled', async () => {
    component.question.set('spam');
    component.usernameHoney.set('bot');
    await component.submitForm();
    http.expectNone(SITE_CONFIG.askMorganSubmitUrl);
    expect(component.isSuccess()).toBe(true);
  });

  it('shows an error and stays on the form when the request fails', async () => {
    component.question.set('hello');
    const submit = component.submitForm();
    http.expectOne(SITE_CONFIG.askMorganSubmitUrl).flush('down', { status: 503, statusText: 'Unavailable' });
    await submit;
    expect(component.isSuccess()).toBe(false);
    expect(component.errorMessage()).not.toBe('');
  });

  it('offers three jobs as toggle buttons, asking by default', () => {
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.modes button')];
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['ask me something', 'suggest a subtitle', 'anonymous dropbox']);
    expect(buttons.map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(buttons.every(b => b.type === 'button')).toBe(true);
  });

  it('locks the mode while a message is on its way', async () => {
    component.question.set('why?');
    const submit = component.submitForm();
    await fixture.whenStable();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.modes button')];
    expect(buttons.every(b => b.disabled)).toBe(true);
    http.expectOne(SITE_CONFIG.askMorganSubmitUrl).flush({});
    await submit;
  });

  it('switches mode without losing the other drafts', async () => {
    component.question.set('half a question');
    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.modes button')[2].click();
    await fixture.whenStable();
    expect(component.kind()).toBe('message');
    expect(el.querySelector('label[for="contact-message"]')?.textContent).toContain('Your message (anonymous)');
    expect(el.querySelector('.submit-btn')?.textContent?.trim()).toBe('Drop it in');
    component.choose('question');
    expect(component.question()).toBe('half a question');
  });

  it('sends a dropbox note as a message', async () => {
    component.choose('message');
    component.message.set('love the campfire');
    const submit = component.submitForm();
    const req = http.expectOne(SITE_CONFIG.askMorganSubmitUrl);
    expect(req.request.body).toEqual({ question: '📥 Anonymous dropbox\nlove the campfire', kind: 'message', text: 'love the campfire', username_honey: '' });
    req.flush({});
    await submit;
    expect(component.successMessage()).toContain('I won\'t know it was you');
  });

  it('suggests a subtitle with a preview, a 60-character limit and an optional credit', async () => {
    component.choose('subtitle');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#contact-subtitle')?.getAttribute('maxlength')).toBe('60');
    expect(el.querySelector('#contact-credit')?.getAttribute('maxlength')).toBe('24');
    expect(component.canSubmit()).toBe(false);

    component.subtitle.set('  a  certified  night  owl ');
    await fixture.whenStable();
    expect(el.querySelector('.preview-line')?.textContent?.trim()).toBe('a certified night owl');
    expect(component.limit()).toBe(60);

    const submit = component.submitForm();
    const req = http.expectOne(SITE_CONFIG.askMorganSubmitUrl);
    expect(req.request.body.kind).toBe('subtitle');
    expect(req.request.body.subtitle).toBe('a certified night owl');
    expect(req.request.body.credit).toBeNull();
    expect(req.request.body.question).toMatch(/^✨ Subtitle suggestion\n"a certified night owl"\ncredit: anonymous\napprove: \{ text: 'a certified night owl', by: null, added: '\d{4}-\d{2}' \},$/);
    req.flush({});
    await submit;
    expect(component.successMessage()).toContain('front page');
  });

  it('warns near the character limit', () => {
    component.question.set('x'.repeat(420));
    expect(component.counterWarning()).toBe(true);
    component.question.set('x'.repeat(490));
    expect(component.counterDanger()).toBe(true);
  });

  it('reset returns to an empty form in the same mode', () => {
    component.question.set('q');
    component.isSuccess.set(true);
    component.resetForm();
    expect(component.question()).toBe('');
    expect(component.isSuccess()).toBe(false);

    component.choose('subtitle');
    component.subtitle.set('line');
    component.credit.set('sam');
    component.resetForm();
    expect([component.subtitle(), component.credit(), component.kind()]).toEqual(['', '', 'subtitle']);
  });
});
