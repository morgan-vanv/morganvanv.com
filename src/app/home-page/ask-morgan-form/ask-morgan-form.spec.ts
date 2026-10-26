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
    expect(req.request.body).toEqual({ question: 'why?', username_honey: '' });
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

  it('warns near the character limit', () => {
    component.question.set('x'.repeat(420));
    expect(component.counterWarning()).toBe(true);
    component.question.set('x'.repeat(490));
    expect(component.counterDanger()).toBe(true);
  });

  it('reset returns to an empty form', () => {
    component.question.set('q');
    component.isSuccess.set(true);
    component.resetForm();
    expect(component.question()).toBe('');
    expect(component.isSuccess()).toBe(false);
  });
});
