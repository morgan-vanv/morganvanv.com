import { ChangeDetectionStrategy, Component, VERSION } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { SITE_CONFIG } from '../../config/site.config';

/** "Made with Angular 22": the version comes from Angular itself, so `ng update` keeps it honest. */
@Component({
  selector: 'app-angular-badge',
  imports: [BadgeComponent],
  templateUrl: './angular-badge.component.html',
  styleUrl: './angular-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AngularBadgeComponent {
  readonly href = SITE_CONFIG.repoUrl;
  readonly value = `Angular ${VERSION.major}`;

  readonly popover: BadgePopover = {
    title: 'Made with',
    rows: [
      { label: 'Angular', value: VERSION.full },
      { label: 'Rendering', value: 'prerendered, zoneless' },
    ],
    note: 'and a mild amount of spite',
    cta: 'view source ↗',
  };

  readonly label = `Made with Angular ${VERSION.full}, prerendered and zoneless. Opens the source on GitHub in a new tab.`;
}
