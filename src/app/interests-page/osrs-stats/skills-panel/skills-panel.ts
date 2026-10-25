import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WomSkill } from '../../../../shared/services/wise-old-man.service';
import { SKILL_ORDER } from '../../../../shared/constants/osrs-stats.const';
import { skillIconUrl } from '../osrs-format';

/** The in-game skills tab: 24 skills in 3 columns. */
@Component({
  selector: 'app-osrs-skills-panel',
  templateUrl: './skills-panel.html',
  styleUrl: './skills-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsSkillsPanelComponent {
  readonly skills = input.required<Record<string, WomSkill>>();
  readonly skillOrder = SKILL_ORDER;
  readonly iconUrl = skillIconUrl;

  level(skill: string): number {
    return this.skills()[skill]?.level ?? 1;
  }
}
