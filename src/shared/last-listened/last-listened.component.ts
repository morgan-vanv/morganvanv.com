import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RecentStreamService } from '../services/recent-stream.service';

/**
 * Album art + "Listening now / Last listened" + track, artist and when.
 * Renders nothing until data arrives. `preview` is the small, non-link version
 * shown on the Interests tile (the tile itself is the control there).
 */
@Component({
  selector: 'app-last-listened',
  imports: [NgTemplateOutlet],
  templateUrl: './last-listened.component.html',
  styleUrl: './last-listened.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.preview]': 'preview()',
  },
})
export class LastListenedComponent {
  protected readonly stream = inject(RecentStreamService);
  readonly preview = input(false);
}
