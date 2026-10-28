import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SITE_CONFIG } from '../config/site.config';

/**
 * The old-web line under every page: Hotline Webring's ‹ prev / next › and the ring itself. On wide
 * screens it sits in the gap under the page card; on tablets and phones it's the last thing in the
 * page's scroll (base-page places it). The visitor odometer joins it once the campfire is live.
 *
 * No rel="noreferrer" on the hops: the ring learns members from the Referer of the first click through.
 */
@Component({
  selector: 'app-site-strip',
  templateUrl: './site-strip.component.html',
  styleUrl: './site-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteStripComponent {
  protected readonly webring = SITE_CONFIG.webring;
}
