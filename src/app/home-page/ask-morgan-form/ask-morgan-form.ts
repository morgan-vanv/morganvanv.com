import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SITE_CONFIG } from '../../../shared/config/site.config';

export const QUESTION_MAX_LENGTH = 500;
const SUCCESS_MESSAGE = 'Thanks for reaching out! Your message was sent anonymously.';
const ERROR_MESSAGE = 'An error occurred while sending your message. Please try again later.';

@Component({
  selector: 'app-ask-morgan-form',
  imports: [FormsModule],
  templateUrl: './ask-morgan-form.html',
  styleUrl: './ask-morgan-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskMorganFormComponent {
  readonly maxLength = QUESTION_MAX_LENGTH;

  readonly question = signal('');
  readonly usernameHoney = signal('');
  readonly isSubmitting = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly isSuccess = signal(false);

  readonly charCount = computed(() => this.question().length);
  readonly counterWarning = computed(() => this.charCount() >= 400 && this.charCount() < 480);
  readonly counterDanger = computed(() => this.charCount() >= 480);
  readonly canSubmit = computed(() => !this.isSubmitting() && this.question().trim().length > 0);

  private readonly http = inject(HttpClient);

  async submitForm(): Promise<void> {
    const question = this.question().trim();
    if (!question) return;

    // Honeypot short-circuit: fail silently to prevent spam
    if (this.usernameHoney().trim()) {
      this.successMessage.set(SUCCESS_MESSAGE);
      this.isSuccess.set(true);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      await firstValueFrom(
        this.http.post(SITE_CONFIG.askMorganSubmitUrl, { question, username_honey: this.usernameHoney() })
      );
      this.successMessage.set(SUCCESS_MESSAGE);
      this.isSuccess.set(true);
    } catch {
      this.errorMessage.set(ERROR_MESSAGE);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetForm(): void {
    this.isSuccess.set(false);
    this.successMessage.set('');
    this.question.set('');
    this.usernameHoney.set('');
  }
}
