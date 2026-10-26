import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { COMMUNITY_PHOTOS, photoCountLabel } from '../../constants/community-photos.const';

/** How many photos are on the community wall, and the newest. Static data, so it's prerendered. */
@Component({
  selector: 'app-photo-wall-badge',
  imports: [BadgeComponent],
  templateUrl: './photo-wall-badge.component.html',
  styleUrl: './photo-wall-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoWallBadgeComponent {
  readonly count = COMMUNITY_PHOTOS.length;
  readonly value = photoCountLabel(this.count);
  private readonly newest = COMMUNITY_PHOTOS.at(-1)?.caption;

  readonly popover: BadgePopover = {
    title: 'The community photo wall',
    rows: [
      { label: 'Photos', value: String(this.count) },
      ...(this.newest ? [{ label: 'Newest', value: this.newest }] : []),
    ],
    cta: 'go look →',
  };

  readonly label = `The community photo wall: ${this.value}` +
    (this.newest ? `, newest: ${this.newest}` : '') + '. Goes to the Social page.';
}
