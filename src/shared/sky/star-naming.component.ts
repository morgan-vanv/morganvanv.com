import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, output, signal, untracked, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SITE_CONFIG } from '../config/site.config';
import { IconComponent } from '../icon/icon.component';
import { SkyService } from './sky.service';
import { MAX_NAME, makeSuggestion, starTitle, suggestionBody, unnamedCountText, unnamedInSky } from './sky-naming';

export const STAR_NAME_MAX_LENGTH = MAX_NAME;
/** Copy below is a draft for Morgan. */
export const NAMING_FINE_PRINT = 'These come to me first. The good ones go up in the sky for everyone.';
export const NAMING_SENT = 'Sent. If it\'s a good one, it\'ll be up there soon.';
export const NAMING_ERROR = 'Something went wrong sending that. Please try again later.';

/**
 * Name a star: the panel shown while looking up. The selected star (picked on
 * the sky, or with ‹ ›) gets a ring; the visitor suggests a name and it goes to
 * Morgan through the Ask Morgan Worker. Nothing is published from here: a
 * name only appears once Morgan merges its file into content/stars/.
 *
 * No FormsModule (it would land in the initial bundle, as the panel is part of
 * App): plain inputs bound to signals. One live region, always there, carries
 * the sent and error messages, so screen readers hear them change.
 */
@Component({
  selector: 'app-star-naming',
  imports: [IconComponent],
  templateUrl: './star-naming.component.html',
  styleUrl: './star-naming.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarNamingComponent {
  protected readonly sky = inject(SkyService);
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  readonly closed = output<void>();
  readonly back = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly anotherButton = viewChild<ElementRef<HTMLButtonElement>>('anotherButton');

  protected readonly maxLength = STAR_NAME_MAX_LENGTH;
  protected readonly finePrint = NAMING_FINE_PRINT;

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
    const count = unnamedCountText(unnamedInSky(this.sky.unnamed(), this.sky.location().lat), this.sky.location().mine);
    return star ? `magnitude ${star.mag.toFixed(1)} · ${count}` : 'try another light, or come back when it\'s dark';
  });
  /** What the live region says: the sent message, an error, or nothing. */
  protected readonly status = computed(() => (this.sky.sent() ? NAMING_SENT : this.error()));
  /** ‹ › go round every unnamed star that's up, turning the sky to each. */
  protected readonly canStep = computed(() => this.sky.around().length > 1);
  readonly canSubmit = computed(() => !this.submitting() && !!this.sky.selected() && this.name().trim().length > 0);

  constructor() {
    // Once a name has gone, the form never comes back with it filled in (for whichever star is next).
    let wasSent = this.sky.sent();
    effect(() => {
      const sent = this.sky.sent();
      if (wasSent && !sent) untracked(() => this.clearForm());
      wasSent = sent;
    });
    // Opened: focus comes into the panel (and on to the name field, below, once a star is selected).
    afterNextRender(() => {
      this.panel().nativeElement.focus();
      // Now the sky can see what the panel covers (the first time, it arrives after naming started).
      this.sky.namingPanelShown.update(count => count + 1);
    });
    // A star is selected while the panel itself has focus (it just opened): on to the name field.
    // Not on touch screens, where the keyboard would cover the sky before anything's been picked.
    effect(() => {
      if (!this.sky.selected()) return;
      untracked(() => afterNextRender(() => {
        const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        if (!touch && document.activeElement === this.panel().nativeElement) this.nameInput()?.nativeElement.focus();
      }, { injector: this.injector }));
    });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  async submit(): Promise<void> {
    const star = this.sky.selected();
    const suggestion = star && makeSuggestion(this.name(), this.credit(), star);
    if (!suggestion || this.submitting()) return;
    // Honeypot filled: a bot. Pretend it worked, send nothing (as the Ask Morgan form does).
    if (this.honey().trim()) {
      this.markSent();
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post(SITE_CONFIG.askMorganSubmitUrl, suggestionBody(suggestion, this.honey())));
      this.markSent();
    } catch {
      this.error.set(NAMING_ERROR);
    } finally {
      this.submitting.set(false);
    }
  }

  /** After sending: the next star along, an empty form, and the name field ready. */
  nameAnother(): void {
    this.sky.step(1);
    this.sky.sent.set(false);
    this.clearForm();
    afterNextRender(() => this.nameInput()?.nativeElement.focus(), { injector: this.injector });
  }

  /** The submit button goes with the form, so focus moves to "name another" rather than falling to the page. */
  private markSent(): void {
    this.sky.sent.set(true);
    afterNextRender(() => this.anotherButton()?.nativeElement.focus(), { injector: this.injector });
  }

  private clearForm(): void {
    this.name.set('');
    this.credit.set('');
    this.honey.set('');
    this.error.set('');
  }
}
