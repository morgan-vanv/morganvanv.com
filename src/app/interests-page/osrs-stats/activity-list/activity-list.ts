import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ResourceState } from '../resource-state';

export interface ActivityRow {
  iconUrl: string;
  label: string;
  meta: string;
}

/** A titled feed of icon + label + date rows (recent achievements, recent drops). */
@Component({
  selector: 'app-osrs-activity-list',
  templateUrl: './activity-list.html',
  styleUrl: './activity-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsActivityListComponent {
  readonly title = input.required<string>();
  readonly rows = input.required<ResourceState<ActivityRow[]>>();
  readonly emptyText = input('Nothing yet.');
  readonly errorText = input('Could not load.');
}
