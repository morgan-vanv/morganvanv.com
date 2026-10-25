import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RpCollectionLogItem } from '../../../../shared/services/rune-profile.service';
import { ResourceState } from '../resource-state';
import { itemImageUrl } from '../osrs-format';

export interface PetsSummary {
  obtained: number;
  total: number;
  pets: RpCollectionLogItem[];
}

@Component({
  selector: 'app-osrs-pets-panel',
  templateUrl: './pets-panel.html',
  styleUrl: './pets-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsPetsPanelComponent {
  readonly pets = input.required<ResourceState<PetsSummary>>();
  readonly itemImageUrl = itemImageUrl;
}
