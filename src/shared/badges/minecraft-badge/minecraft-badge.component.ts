import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { SITE_CONFIG } from '../../config/site.config';
import { LabStatusService } from '../../lab-status/lab-status.service';
import { MODES_LINE, onlineLine } from '../../minecraft/minecraft';
import { COPIED_FOR_MS, copyText } from '../../copy-button/copy-text';

/**
 * The Minecraft server's 88×31, beside the site's own in "this site" (Morgan, 2026-11-20): its address on the face
 * over how many are on, and pressing it copies the address. A count from the status Worker (`LabStatusService`,
 * provided by /now), never a name; "down" while the Worker finds it down; nothing at all before it has answered.
 */
@Component({
  selector: 'app-minecraft-badge',
  imports: [BadgeComponent],
  templateUrl: './minecraft-badge.component.html',
  styleUrl: './minecraft-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftBadgeComponent {
  private readonly labStatus = inject(LabStatusService, { optional: true });
  readonly address = SITE_CONFIG.minecraftAddress;

  /** "copied" or "copy it by hand" for a moment after a press; null otherwise. */
  private readonly said = signal<string | null>(null);
  /** What the polite live region says after a press (the face and popover are hidden from screen readers). */
  readonly announced = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  readonly badge = computed(() => {
    const state = this.labStatus?.stateOf('minecraft') ?? null;
    const count = this.labStatus?.minecraftOnline() ?? null;
    if (state === null || (state === 'up' && count === null)) return null;
    const now = state === 'up' && count !== null ? onlineLine(count) : 'down';
    return {
      value: this.said() ?? now,
      popover: {
        title: this.address,
        rows: [
          { label: 'On right now', value: state === 'up' ? String(count) : 'down' },
          { label: 'Plays on', value: 'Java + Bedrock' },
          { label: 'Modes', value: MODES_LINE },
        ],
        cta: this.said() ?? 'click to copy IP address',
      } satisfies BadgePopover,
      label: `${this.address}: ${state === 'up' ? `${now} right now` : 'down right now'}. Plays on Java and Bedrock. `
        + `Modes: ${MODES_LINE.replaceAll(' · ', ', ')}. Press to copy the server's address.`,
    };
  });

  async copy(): Promise<void> {
    const ok = await copyText(this.address);
    this.said.set(ok ? 'copied!' : 'copy it by hand');
    this.announced.set(ok ? `Copied ${this.address}.` : `Couldn't copy. The address is ${this.address}.`);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.said.set(null);
      this.announced.set('');
    }, COPIED_FOR_MS);
  }
}
