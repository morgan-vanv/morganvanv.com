import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SITE_CONFIG } from '../config/site.config';
import { IconComponent } from '../icon/icon.component';
import { SkyService } from './sky.service';
import { makeSuggestion, starTitle, suggestionBody } from './sky-naming';

export const STAR_NAME_MAX_LENGTH = 24;
/** Copy below is a draft for Morgan. */
export const NAMING_FINE_PRINT = 'These come to me first. The good ones go up in the sky for everyone.';
export const NAMING_SENT = 'Sent. If it\'s a good one, it\'ll be up there soon.';
const NAMING_ERROR = 'Something went wrong sending that. Please try again later.';

/**
 * Name a star: the panel shown while looking up. The selected star (picked on
 * the sky, or with ‹ ›) gets a ring; the visitor suggests a name and it goes to
 * Morgan through the Ask Morgan function. Nothing is published from here: a
 * name only appears once Morgan adds it to visitor-names.json.
 */
@Component({
  selector: 'app-star-naming',
  imports: [FormsModule, IconComponent],
  templateUrl: './star-naming.component.html',
  styleUrl: './star-naming.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarNamingComponent {
  protected readonly sky = inject(SkyService);
  private readonly http = inject(HttpClient);
  readonly closed = output<void>();
  readonly back = output<void>();

  protected readonly maxLength = STAR_NAME_MAX_LENGTH;
  protected readonly finePrint = NAMING_FINE_PRINT;
  protected readonly sentMessage = NAMING_SENT;

  readonly name = signal('');
  readonly credit = signal('');
  readonly honey = signal('');
  readonly submitting = signal(false);
  readonly error = signal('');

  protected readonly title = computed(() => {
    const star = this.sky.selected();
    return star ? starTitle(star) : 'no unnamed stars in view';
  });
  protected readonly detail = computed(() => {
    const star = this.sky.selected();
    const left = this.sky.unnamed().length;
    const count = `${left} star${left === 1 ? '' : 's'} up here ${left === 1 ? 'has' : 'have'} no name yet`;
    return star ? `magnitude ${star.mag.toFixed(1)} · ${count}` : 'try another light, or come back when it\'s dark';
  });
  protected readonly canStep = computed(() => this.sky.candidates().length > 1);
  readonly canSubmit = computed(() => !this.submitting() && !!this.sky.selected() && this.name().trim().length > 0);

  async submit(): Promise<void> {
    const star = this.sky.selected();
    const suggestion = star && makeSuggestion(this.name(), this.credit(), star, new Date());
    if (!suggestion || this.submitting()) return;
    // Honeypot filled: a bot. Pretend it worked, send nothing (as the Ask Morgan form does).
    if (this.honey().trim()) {
      this.sky.sent.set(true);
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post(SITE_CONFIG.askMorganSubmitUrl, suggestionBody(suggestion, this.honey())));
      this.sky.sent.set(true);
    } catch {
      this.error.set(NAMING_ERROR);
    } finally {
      this.submitting.set(false);
    }
  }

  /** After sending: the next star along, and an empty form. */
  nameAnother(): void {
    this.name.set('');
    this.credit.set('');
    this.error.set('');
    this.sky.sent.set(false);
    this.sky.step(1);
    queueMicrotask(() => document.querySelector<HTMLElement>('#star-name')?.focus());
  }
}
