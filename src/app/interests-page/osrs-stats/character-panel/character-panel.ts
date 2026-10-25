import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal } from '@angular/core';
import { CHARACTER_BADGES, WOM_USERNAME } from '../../../../shared/constants/osrs-stats.const';

/** The 3D character model with its group/clan badges. */
@Component({
  selector: 'app-osrs-character-panel',
  templateUrl: './character-panel.html',
  styleUrl: './character-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class OsrsCharacterPanelComponent implements OnInit {
  readonly username = WOM_USERNAME;
  readonly badges = CHARACTER_BADGES;
  /** Auto-rotation is off when the visitor prefers reduced motion. */
  readonly autoRotate = signal(true);

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    this.autoRotate.set(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!window.customElements?.get('model-viewer')) {
      void import('@google/model-viewer').catch(() => undefined);
    }
  }
}
