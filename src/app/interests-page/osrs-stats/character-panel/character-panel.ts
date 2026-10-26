import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, computed, input, signal } from '@angular/core';
import { CHARACTER_BADGES, WOM_USERNAME } from '../../../../shared/constants/osrs-stats.const';
import { WomPlayer } from '../../../../shared/services/wise-old-man.service';
import { formatNumber, maxedSkills } from '../osrs-format';

interface HeadlineStat {
  label: string;
  value: string;
  title: string;
}

/** The character band: 3D model, name, group/clan badges, progress to max and the headline numbers. */
@Component({
  selector: 'app-osrs-character-panel',
  templateUrl: './character-panel.html',
  styleUrl: './character-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class OsrsCharacterPanelComponent implements OnInit {
  readonly player = input.required<WomPlayer>();

  readonly username = WOM_USERNAME;
  readonly badges = CHARACTER_BADGES;
  /** Auto-rotation is off when the visitor prefers reduced motion. */
  readonly autoRotate = signal(true);

  readonly headline = computed<HeadlineStat[]>(() => {
    const p = this.player();
    return [
      { label: 'Combat', value: String(p.combatLevel), title: 'Combat level' },
      { label: 'Total', value: formatNumber(p.latestSnapshot.data.skills['overall']?.level ?? 0), title: 'Total level' },
      { label: 'EHP', value: formatNumber(p.ehp), title: 'Efficient hours played' },
      { label: 'EHB', value: formatNumber(p.ehb), title: 'Efficient hours bossed' },
    ];
  });

  /** Skills at 99 out of all skills. */
  readonly maxed = computed(() => maxedSkills(this.player().latestSnapshot.data.skills));
  readonly maxedPercent = computed(() => {
    const { maxed, total } = this.maxed();
    return total ? (maxed / total) * 100 : 0;
  });
  /** Wise Old Man's efficient hours to max, rounded; null when maxed or unknown. */
  readonly hoursToMax = computed(() => {
    const ttm = this.player().ttm;
    return ttm && ttm > 0 ? formatNumber(ttm) : null;
  });

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    this.autoRotate.set(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!window.customElements?.get('model-viewer')) {
      void import('@google/model-viewer').catch(() => undefined);
    }
  }
}
