import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { WiseOldManService } from '../../../../shared/services/wise-old-man.service';
import { WOM_USERNAME } from '../../../../shared/constants/osrs-stats.const';
import { formatNumber, maxedSkills } from '../osrs-format';

/**
 * The headline numbers on the collapsed OSRS tile. Same Wise Old Man call as
 * the open section (cached), so opening it costs nothing extra. Renders
 * nothing until the data arrives or if it fails.
 */
@Component({
  selector: 'app-osrs-preview',
  template: `
    @if (stats(); as list) {
      <dl class="stats">
        @for (stat of list; track stat.label) {
          <div class="stat"><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd></div>
        }
      </dl>
    }
  `,
  styleUrl: './osrs-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsPreviewComponent {
  private readonly player = toSignal(
    inject(WiseOldManService).getPlayer(WOM_USERNAME).pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  readonly stats = computed(() => {
    const p = this.player();
    const skills = p?.latestSnapshot?.data?.skills;
    if (!p || !skills) return null;
    const { maxed } = maxedSkills(skills);
    return [
      { label: 'Combat', value: String(p.combatLevel) },
      { label: 'Total', value: formatNumber(skills['overall']?.level ?? 0) },
      { label: '99s', value: String(maxed) },
      { label: 'EHP', value: formatNumber(p.ehp) },
    ];
  });
}
