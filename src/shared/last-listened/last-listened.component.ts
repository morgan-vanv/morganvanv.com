import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RecentStreamService } from '../services/recent-stream.service';

/** Album art + "Listening now / Last listened" + track, artist and when. Renders nothing until data arrives. */
@Component({
  selector: 'app-last-listened',
  templateUrl: './last-listened.component.html',
  styleUrl: './last-listened.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LastListenedComponent {
  protected readonly stream = inject(RecentStreamService);
}
