import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SITE_CONFIG } from '../../../shared/config/site.config';
import { CREDIT_MAX_LENGTH, SUBTITLE_MAX_LENGTH } from '../../../shared/constants/subtitles.const';
import {
  ContactKind,
  ContactSubmission,
  dropboxSubmission,
  oneLine,
  questionSubmission,
  subtitleSubmission,
} from './contact-submission';

export const QUESTION_MAX_LENGTH = 500;
const ERROR_MESSAGE = 'An error occurred while sending your message. Please try again later.';

/** One of the form's three jobs, and the words that change with it. Draft copy, Morgan's to edit. */
interface ContactMode {
  readonly id: ContactKind;
  readonly label: string;
  readonly fieldLabel: string;
  readonly placeholder: string;
  readonly note: string;
  readonly submit: string;
  readonly success: string;
  readonly again: string;
}

export const CONTACT_MODES: readonly ContactMode[] = [
  {
    id: 'question',
    label: 'ask me something',
    fieldLabel: 'Your question (anonymous)',
    placeholder: 'What do you want to know?',
    note: 'Anonymous, so I can\'t write back. Email me if you\'d like an answer.',
    submit: 'Ask',
    success: 'Thanks! Your question was sent anonymously.',
    again: 'Ask another question',
  },
  {
    id: 'subtitle',
    label: 'suggest a subtitle',
    fieldLabel: 'Your subtitle, for under my name on the front page',
    placeholder: 'a line that sounds like me',
    note: 'The ones I like join the rotation on the front page. The rest stay between us.',
    submit: 'Send it',
    success: 'Sent. If I like it, it\'ll turn up on the front page.',
    again: 'Suggest another',
  },
  {
    id: 'message',
    label: 'anonymous dropbox',
    fieldLabel: 'Your message (anonymous)',
    placeholder: 'Feedback, a bug, a confession…',
    note: 'No name attached. I won\'t know who sent it.',
    submit: 'Drop it in',
    success: 'Dropped in. I won\'t know it was you.',
    again: 'Leave another',
  },
];

@Component({
  selector: 'app-ask-morgan-form',
  imports: [FormsModule],
  templateUrl: './ask-morgan-form.html',
  styleUrl: './ask-morgan-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskMorganFormComponent {
  readonly maxLength = QUESTION_MAX_LENGTH;
  readonly subtitleMaxLength = SUBTITLE_MAX_LENGTH;
  readonly creditMaxLength = CREDIT_MAX_LENGTH;
  readonly modes = CONTACT_MODES;
  readonly ownerName = SITE_CONFIG.name;

  /** Which job the form is doing. Each keeps its own draft, so switching loses nothing. */
  readonly kind = signal<ContactKind>('question');
  readonly mode = computed(() => CONTACT_MODES.find(m => m.id === this.kind())!);

  readonly question = signal('');
  readonly message = signal('');
  readonly subtitle = signal('');
  readonly credit = signal('');
  readonly usernameHoney = signal('');
  readonly isSubmitting = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly isSuccess = signal(false);

  /** The text being counted and required in the current mode. */
  private readonly text = computed(() => {
    switch (this.kind()) {
      case 'subtitle': return this.subtitle();
      case 'message': return this.message();
      default: return this.question();
    }
  });
  readonly limit = computed(() => this.kind() === 'subtitle' ? SUBTITLE_MAX_LENGTH : QUESTION_MAX_LENGTH);
  readonly charCount = computed(() => this.text().length);
  readonly counterWarning = computed(() => this.charCount() >= this.limit() * 0.8 && this.charCount() < this.limit() * 0.96);
  readonly counterDanger = computed(() => this.charCount() >= this.limit() * 0.96);
  readonly canSubmit = computed(() => !this.isSubmitting() && this.text().trim().length > 0);
  /** How a suggested subtitle would read under the name. */
  readonly preview = computed(() => oneLine(this.subtitle()));

  private readonly http = inject(HttpClient);

  choose(kind: ContactKind): void {
    this.kind.set(kind);
    this.errorMessage.set('');
  }

  async submitForm(): Promise<void> {
    if (!this.text().trim()) return;
    const mode = this.mode();

    // Honeypot short-circuit: fail silently to prevent spam
    if (this.usernameHoney().trim()) {
      this.successMessage.set(mode.success);
      this.isSuccess.set(true);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      await firstValueFrom(this.http.post(SITE_CONFIG.askMorganSubmitUrl, { ...this.submission(), username_honey: this.usernameHoney() }));
      this.successMessage.set(mode.success);
      this.isSuccess.set(true);
    } catch {
      this.errorMessage.set(ERROR_MESSAGE);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Back to an empty form in the same mode. */
  resetForm(): void {
    this.isSuccess.set(false);
    this.successMessage.set('');
    this.usernameHoney.set('');
    switch (this.kind()) {
      case 'subtitle':
        this.subtitle.set('');
        this.credit.set('');
        break;
      case 'message':
        this.message.set('');
        break;
      default:
        this.question.set('');
    }
  }

  private submission(): ContactSubmission {
    switch (this.kind()) {
      case 'subtitle': return subtitleSubmission(this.subtitle(), this.credit(), new Date());
      case 'message': return dropboxSubmission(this.message());
      default: return questionSubmission(this.question());
    }
  }
}
