import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WomBoss } from '../../../../shared/services/wise-old-man.service';
import { formatBossName, formatNumber } from '../osrs-format';

/** Boss kill counts: only bosses with at least one kill, most-killed first (ties alphabetical). */
@Component({
  selector: 'app-osrs-boss-grid',
  templateUrl: './boss-grid.html',
  styleUrl: './boss-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsBossGridComponent {
  readonly bosses = input.required<Record<string, WomBoss>>();

  readonly rows = computed(() =>
    Object.values(this.bosses())
      .filter(boss => boss.kills > 0)
      .map(boss => ({ metric: boss.metric, name: formatBossName(boss.metric), killCount: boss.kills, kills: formatNumber(boss.kills) }))
      .sort((a, b) => b.killCount - a.killCount || a.name.localeCompare(b.name))
  );

  readonly totalKills = computed(() => formatNumber(this.rows().reduce((sum, r) => sum + r.killCount, 0)));
}
