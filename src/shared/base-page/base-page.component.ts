import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CustomNavbarComponent } from '../custom-navbar/custom-navbar.component';
import { ScrollHintComponent } from '../scroll-hint/scroll-hint.component';
import { ScrollRegionDirective } from '../scroll-region/scroll-region.directive';
import { SiteStripComponent } from '../site-strip/site-strip.component';

@Component({
  selector: 'app-base-page',
  imports: [CustomNavbarComponent, ScrollHintComponent, ScrollRegionDirective, SiteStripComponent],
  templateUrl: './base-page.component.html',
  styleUrl: './base-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BasePageComponent {
  readonly showScrollHint = input(true);
  /** Visually-hidden page heading, so every page has exactly one <h1>. Omit on pages that render their own. */
  readonly pageTitle = input<string>();
}
