import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { COPIED_FOR_MS, copyText } from './copy-text';

/**
 * A small pill button that copies `value` (the Minecraft server's address, so far). It says `text` at rest, "copied"
 * for a moment after, or "copy it by hand" if the browser wouldn't; a polite live region says the same for screen
 * readers. `label` is its accessible name ("Copy the address mc.morganvanv.com"); `size="small"` makes it compact
 * where a mouse is the pointer on a wide screen, and keeps the 44px target everywhere else.
 */
@Component({
  selector: 'app-copy-button',
  template: `
    <button type="button" class="copy" [class.small]="size() === 'small'" [class.done]="said() !== null" [attr.aria-label]="label()" (click)="copy()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
      <span aria-hidden="true">{{ said() ?? text() }}</span>
    </button>
    <span class="visually-hidden" role="status">{{ announced() }}</span>
  `,
  styleUrl: './copy-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyButtonComponent {
  readonly value = input.required<string>();
  readonly text = input('copy');
  readonly label = input.required<string>();
  /** 'small' sits beside an address set in running-text size (the Homelab): compact for a mouse, still 44px to touch. */
  readonly size = input<'normal' | 'small'>('normal');

  protected readonly said = signal<string | null>(null);
  protected readonly announced = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(): Promise<void> {
    const ok = await copyText(this.value());
    this.said.set(ok ? 'copied' : 'copy it by hand');
    this.announced.set(ok ? `Copied ${this.value()}.` : `Couldn't copy. The address is ${this.value()}.`);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.said.set(null);
      this.announced.set('');
    }, COPIED_FOR_MS);
  }
}
