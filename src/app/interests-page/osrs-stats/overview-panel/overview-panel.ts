import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WomPlayer } from '../../../../shared/services/wise-old-man.service';
import { CLUE_TIERS } from '../../../../shared/constants/osrs-stats.const';
import { ResourceState } from '../resource-state';
import { formatNumber } from '../osrs-format';

export interface QuestSummary {
  completed: number;
  total: number;
  earnedQp: number;
  totalQp: number;
}

export interface DiaryTierTotal {
  tier: string;
  completed: number;
  total: number;
}

export interface CombatSummary {
  totalCompleted: number;
  totalTasks: number;
}

export interface CollectionLogSummary {
  obtained: number;
  total: number;
}

/** Combat/total level, quests, diaries, clues, combat achievements, collection log, EHP/EHB. */
@Component({
  selector: 'app-osrs-overview-panel',
  templateUrl: './overview-panel.html',
  styleUrl: './overview-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsOverviewPanelComponent {
  readonly player = input.required<WomPlayer>();
  readonly quests = input.required<ResourceState<QuestSummary>>();
  readonly diaries = input.required<ResourceState<DiaryTierTotal[]>>();
  readonly combat = input.required<ResourceState<CombatSummary>>();
  readonly collectionLog = input.required<ResourceState<CollectionLogSummary>>();

  readonly clueTiers = CLUE_TIERS;
  readonly formatNumber = formatNumber;

  readonly totalLevel = computed(() => this.player().latestSnapshot.data.skills['overall']?.level ?? 0);
  readonly totalClues = computed(() => this.player().latestSnapshot.data.activities['clue_scrolls_all']?.score ?? 0);
  readonly diaryTotals = computed(() => {
    const tiers = this.diaries().data ?? [];
    return tiers.reduce(
      (acc, t) => ({ completed: acc.completed + t.completed, total: acc.total + t.total }),
      { completed: 0, total: 0 },
    );
  });

  clueScore(key: string): number {
    return this.player().latestSnapshot.data.activities[key]?.score ?? 0;
  }

  clueTitle(key: string, label: string): string {
    const activity = this.player().latestSnapshot.data.activities[key];
    const score = activity?.score ?? 0;
    const rank = activity && activity.rank > 0 ? ` (Rank ${formatNumber(activity.rank)})` : '';
    return `${label}: ${formatNumber(score)}${rank}`;
  }
}
