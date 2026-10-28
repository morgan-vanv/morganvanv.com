import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CampfireService, Shout } from '../../../shared/services/campfire.service';
import { ScrollRegionDirective } from '../../../shared/scroll-region/scroll-region.directive';

export const SHOUT_MAX_LENGTH = 200;
export const NICK_MAX_LENGTH = 16;
/** How many colours nicks are spread across, as IRC clients do. */
const NICK_COLOURS = 5;

/** A nick's colour, stable for that nick: 0 … NICK_COLOURS - 1. */
export function nickColour(nick: string): number {
  let hash = 0;
  for (const char of nick.toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % NICK_COLOURS;
}

/** "23:41", in the visitor's own time. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

interface ShoutLine extends Shout {
  readonly time: string;
  readonly colour: number;
}

/**
 * The shoutbox: an IRC-style log of what visitors said, and a line to say something. Lives on the campfire
 * (CampfireService); polls while it's on screen. Messages burn down after a month (the newest 20 stay), so
 * there's nothing to archive. Morgan, as the host, can delete a message and bank the fire: while it's
 * banked, guests can read but not post.
 */
@Component({
  selector: 'app-shoutbox',
  imports: [FormsModule, ScrollRegionDirective],
  templateUrl: './shoutbox.html',
  styleUrl: './shoutbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoutboxComponent {
  protected readonly campfire = inject(CampfireService);
  readonly nickMaxLength = NICK_MAX_LENGTH;
  readonly maxLength = SHOUT_MAX_LENGTH;

  readonly nick = signal('');
  readonly text = signal('');
  readonly website = signal('');
  readonly sending = signal(false);
  readonly error = signal('');

  readonly lines = computed<ShoutLine[]>(() =>
    (this.campfire.shoutLog()?.shouts ?? []).map(shout => ({ ...shout, time: clockTime(shout.at), colour: nickColour(shout.nick) })));
  readonly loaded = computed(() => this.campfire.shoutLog() !== null);
  /** False while the fire's banked. */
  readonly open = computed(() => this.campfire.shoutLog()?.open ?? true);
  /** Guests can post only while the fire's lit; the host always can. */
  readonly canPost = computed(() => this.open() || this.campfire.isHost());
  readonly canSay = computed(() => this.canPost() && !this.sending() && this.nick().trim().length > 0 && this.text().trim().length > 0);
  readonly banking = signal(false);
  readonly clearing = signal(false);
  /** A quiet note after the host clears up (how many went). */
  readonly notice = signal('');
  /** ↑/↓ scroll the log only while it has focus; otherwise they scroll the page as everywhere else. */
  readonly logFocused = signal(false);

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  /** Follow new messages unless the visitor has scrolled up to read. */
  private following = true;

  constructor() {
    inject(DestroyRef).onDestroy(this.campfire.watchShouts());
    afterNextRender(() => {
      this.nick.set(this.campfire.savedNick());
      void this.campfire.captureHostKey();
    });
    afterRenderEffect(() => {
      this.lines();
      const el = this.log()?.nativeElement;
      if (el && this.following) el.scrollTop = el.scrollHeight;
    });
  }

  onScroll(el: HTMLElement): void {
    this.following = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }

  async say(): Promise<void> {
    if (!this.canSay()) return;
    this.sending.set(true);
    this.error.set('');
    const problem = await this.campfire.say(this.nick().trim(), this.text().trim(), this.website());
    this.sending.set(false);
    if (problem) {
      this.error.set(problem);
    } else {
      this.text.set('');
      this.following = true;
    }
  }

  /** Host only: banks the fire, or lights it again. */
  async toggleFire(): Promise<void> {
    if (this.banking()) return;
    this.banking.set(true);
    this.error.set('');
    const problem = await this.campfire.setOpen(!this.open());
    this.banking.set(false);
    if (problem) this.error.set(problem);
  }

  /** Host only: takes down every guest message from the last hour, after a confirm. */
  async clearHour(): Promise<void> {
    if (this.clearing() || !confirm('Take down every guest message from the last hour? Yours stay.')) return;
    this.clearing.set(true);
    this.error.set('');
    this.notice.set('');
    const result = await this.campfire.clearRecent(60);
    this.clearing.set(false);
    if ('error' in result) this.error.set(result.error);
    else this.notice.set(result.removed === 1 ? 'Took down 1 message.' : `Took down ${result.removed} messages.`);
  }

  async remove(line: ShoutLine): Promise<void> {
    if (!confirm(`Delete ${line.nick}'s message?`)) return;
    const problem = await this.campfire.remove(line.id);
    if (problem) this.error.set(problem);
  }
}
