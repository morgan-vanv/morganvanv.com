import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SITE_CONFIG } from '../config/site.config';
import { CampfireService } from '../services/campfire.service';

/** The odometer shows at least this many digits, zero-padded like the old counters. */
export const ODOMETER_DIGITS = 6;

/** "004213": the count as odometer wheels. */
export function odometer(count: number, digits = ODOMETER_DIGITS): string[] {
  return [...String(count).padStart(digits, '0')];
}

/**
 * The old-web line under every page: Hotline Webring's ‹ prev / next › and the ring itself, then "you
 * are visitor 004213" once the campfire has the count. On wide screens it sits in the gap under the page
 * card; on tablets and phones it's the last thing in the page's scroll (base-page places it).
 *
 * No rel="noreferrer" on the hops: the ring learns members from the Referer of the first click through.
 * The counter is honestly kept: each visit to the real site counts once per tab session (and an address
 * once per half hour), and the campfire stores nothing but the number, hence "give or take".
 */
@Component({
  selector: 'app-site-strip',
  templateUrl: './site-strip.component.html',
  styleUrl: './site-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteStripComponent {
  private readonly campfire = inject(CampfireService);
  protected readonly webring = SITE_CONFIG.webring;
  /** Whether a counter is coming at all (a campfire is configured), so phones keep its line free. */
  protected readonly counted = this.campfire.configured;

  protected readonly visitor = computed(() => {
    const count = this.campfire.visitors();
    return count === null ? null : { digits: odometer(count), spoken: `You are visitor ${count.toLocaleString('en-US')}, give or take.` };
  });
}
