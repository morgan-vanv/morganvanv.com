import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { WiseOldManService } from '../../../shared/services/wise-old-man.service';
import { RuneProfileService, RpActivity } from '../../../shared/services/rune-profile.service';
import { WOM_USERNAME, DIARY_TIERS, ACHIEVEMENT_ACTIVITY_TYPES, DROP_ACTIVITY_TYPES } from '../../../shared/constants/osrs-stats.const';
import { LOADING, toResourceState } from './resource-state';
import { OsrsCharacterPanelComponent } from './character-panel/character-panel';
import { OsrsSkillsPanelComponent } from './skills-panel/skills-panel';
import { OsrsOverviewPanelComponent } from './overview-panel/overview-panel';
import { OsrsPetsPanelComponent, PetsSummary } from './pets-panel/pets-panel';
import { OsrsActivityListComponent, ActivityRow } from './activity-list/activity-list';
import { OsrsBossGridComponent } from './boss-grid/boss-grid';
import { achievementIcon, achievementLabel, dropIcon, dropLabel, formatDate } from './osrs-format';

const DISPLAY_LIMIT = 20;


/**
 * Live OSRS character stats. This component only fetches and shapes the
 * data; each panel renders one slice of it.
 */
@Component({
  selector: 'app-osrs-stats',
  imports: [
    OsrsCharacterPanelComponent,
    OsrsSkillsPanelComponent,
    OsrsOverviewPanelComponent,
    OsrsPetsPanelComponent,
    OsrsActivityListComponent,
    OsrsBossGridComponent,
  ],
  templateUrl: './osrs-stats.html',
  styleUrl: './osrs-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsStatsComponent {
  private readonly wom = inject(WiseOldManService);
  private readonly runeProfile = inject(RuneProfileService);

  readonly player = toSignal(
    this.wom.getPlayer(WOM_USERNAME).pipe(
      map(player => {
        // A malformed payload should land in the error state, not throw while rendering.
        if (!player?.latestSnapshot?.data?.skills) throw new Error('Unexpected Wise Old Man response');
        return player;
      }),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly pets = toSignal(
    this.runeProfile.getCollectionLogTab(WOM_USERNAME, 'Other').pipe(
      map((response): PetsSummary => {
        const page = response.pages.find(p => p.name === 'All Pets');
        return {
          obtained: page?.obtained ?? 0,
          total: page?.total ?? 0,
          pets: (page?.items ?? []).filter(item => item.quantity > 0),
        };
      }),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly achievements = toSignal(
    this.runeProfile.getActivities(WOM_USERNAME, ACHIEVEMENT_ACTIVITY_TYPES).pipe(
      map(response => response.activities.slice(0, DISPLAY_LIMIT).map(toAchievementRow)),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly drops = toSignal(
    this.runeProfile.getActivities(WOM_USERNAME, DROP_ACTIVITY_TYPES).pipe(
      map(response => response.activities.slice(0, DISPLAY_LIMIT).map(toDropRow)),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly quests = toSignal(
    this.runeProfile.getQuests(WOM_USERNAME).pipe(
      map(response => {
        const finished = response.data.filter(q => q.state === 'finished');
        return {
          completed: finished.length,
          total: response.data.length,
          earnedQp: finished.reduce((sum, q) => sum + q.points, 0),
          totalQp: response.data.reduce((sum, q) => sum + q.points, 0),
        };
      }),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly diaries = toSignal(
    this.runeProfile.getAchievementDiaries(WOM_USERNAME).pipe(
      map(response =>
        DIARY_TIERS.map(tier => ({
          tier,
          completed: response.data.reduce((sum, area) => sum + (area.tiers.find(t => t.tier === tier)?.completed ?? 0), 0),
          total: response.data.reduce((sum, area) => sum + (area.tiers.find(t => t.tier === tier)?.total ?? 0), 0),
        }))
      ),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly combat = toSignal(
    this.runeProfile.getCombatAchievements(WOM_USERNAME).pipe(
      map(response => ({
        totalCompleted: response.data.reduce((sum, t) => sum + t.completed, 0),
        totalTasks: response.data.reduce((sum, t) => sum + t.total, 0),
      })),
      toResourceState()
    ),
    { initialValue: LOADING }
  );

  readonly collectionLog = toSignal(
    this.runeProfile.getCollectionLogSummary(WOM_USERNAME).pipe(
      map(({ obtained, total }) => ({ obtained, total })),
      toResourceState()
    ),
    { initialValue: LOADING }
  );
}

function toAchievementRow(activity: RpActivity): ActivityRow {
  return { iconUrl: achievementIcon(activity), label: achievementLabel(activity), meta: formatDate(activity.createdAt) };
}

function toDropRow(activity: RpActivity): ActivityRow {
  return { iconUrl: dropIcon(activity), label: dropLabel(activity), meta: formatDate(activity.createdAt) };
}
