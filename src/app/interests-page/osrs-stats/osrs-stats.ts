import { Component, inject, OnInit, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { WiseOldManService, WomPlayer, WomBoss } from '../../../shared/services/wise-old-man.service';
import { RuneProfileService, RpCollectionLogItem, RpActivity, RpActivityType, RpCombatTier } from '../../../shared/services/rune-profile.service';
import { Observable, tap, map, catchError, of, startWith } from 'rxjs';
import { WOM_USERNAME, CHARACTER_BADGES, POWERED_BY_LINKS, SKILL_ORDER, DIARY_TIERS, CLUE_TIERS } from '../../../shared/constants/osrs-stats.const';

const DISPLAY_LIMIT = 20;

const DROP_ACTIVITY_TYPES: RpActivityType[] = ['valuable_drop', 'new_item_obtained'];

const ACHIEVEMENT_ACTIVITY_TYPES: RpActivityType[] = [
  'level_up',
  'quest_completed',
  'achievement_diary_tier_completed',
  'combat_achievement_tier_completed',
  'combat_achievement_tier_reached',
  'xp_milestone',
];

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

function toResourceState<T>(): (source: Observable<T>) => Observable<ResourceState<T>> {
  return source => source.pipe(
    map(data => ({ data, loading: false, error: false })),
    catchError(() => of({ data: null, loading: false, error: true })),
    startWith({ data: null, loading: true, error: false })
  );
}

interface QuestSummary {
  completed: number;
  total: number;
  earnedQp: number;
  totalQp: number;
}

interface DiaryTierTotal {
  tier: string;
  completed: number;
  total: number;
}

interface CombatSummary {
  tiers: RpCombatTier[];
  totalCompleted: number;
  totalTasks: number;
}

interface CollectionLogSummary {
  obtained: number;
  total: number;
}

@Component({
  selector: 'app-osrs-stats',
  imports: [AsyncPipe],
  templateUrl: './osrs-stats.html',
  styleUrl: './osrs-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OsrsStatsComponent implements OnInit {
  private wom = inject(WiseOldManService);
  private runeProfile = inject(RuneProfileService);

  player$!: Observable<ResourceState<WomPlayer>>;
  pets$!: Observable<ResourceState<RpCollectionLogItem[]>>;
  drops$!: Observable<ResourceState<RpActivity[]>>;
  achievements$!: Observable<ResourceState<RpActivity[]>>;
  questSummary$!: Observable<ResourceState<QuestSummary>>;
  diaryTierTotals$!: Observable<ResourceState<DiaryTierTotal[]>>;
  combatSummary$!: Observable<ResourceState<CombatSummary>>;
  collectionLogSummary$!: Observable<ResourceState<CollectionLogSummary>>;

  bosses: WomBoss[] = [];
  petsObtained = 0;
  petsTotal = 0;

  readonly characterBadges = CHARACTER_BADGES;
  readonly poweredByLinks = POWERED_BY_LINKS;
  readonly skillOrder = SKILL_ORDER;
  readonly skillIcons: Record<string, string> = Object.fromEntries(
    SKILL_ORDER.map(skill => [skill, `osrs/skills/${skill}_icon.png`])
  );
  readonly womUsername = WOM_USERNAME;
  readonly clueTiers = CLUE_TIERS;

  ngOnInit(): void {
    import('@google/model-viewer');
    this.player$ = this.wom.getPlayer(WOM_USERNAME).pipe(
      tap(p => { this.bosses = this.sortBosses(p); }),
      toResourceState()
    );

    this.pets$ = this.runeProfile.getCollectionLogTab(WOM_USERNAME, 'Other').pipe(
      map(response => response.pages.find(p => p.name === 'All Pets')),
      tap(petsPage => {
        this.petsObtained = petsPage?.obtained ?? 0;
        this.petsTotal = petsPage?.total ?? 0;
      }),
      map(petsPage => (petsPage?.items ?? []).filter(item => item.quantity > 0)),
      toResourceState()
    );

    this.drops$ = this.runeProfile.getActivities(WOM_USERNAME, DROP_ACTIVITY_TYPES).pipe(
      map(response => response.activities.slice(0, DISPLAY_LIMIT)),
      toResourceState()
    );

    this.achievements$ = this.runeProfile.getActivities(WOM_USERNAME, ACHIEVEMENT_ACTIVITY_TYPES).pipe(
      map(response => response.activities.slice(0, DISPLAY_LIMIT)),
      toResourceState()
    );

    this.questSummary$ = this.runeProfile.getQuests(WOM_USERNAME).pipe(
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
    );

    this.diaryTierTotals$ = this.runeProfile.getAchievementDiaries(WOM_USERNAME).pipe(
      map(response =>
        DIARY_TIERS.map(tier => ({
          tier,
          completed: response.data.reduce((sum, area) =>
            sum + (area.tiers.find(t => t.tier === tier)?.completed ?? 0), 0),
          total: response.data.reduce((sum, area) =>
            sum + (area.tiers.find(t => t.tier === tier)?.total ?? 0), 0),
        }))
      ),
      toResourceState()
    );

    this.combatSummary$ = this.runeProfile.getCombatAchievements(WOM_USERNAME).pipe(
      map(response => ({
        tiers: response.data,
        totalCompleted: response.data.reduce((sum, t) => sum + t.completed, 0),
        totalTasks: response.data.reduce((sum, t) => sum + t.total, 0),
      })),
      toResourceState()
    );

    this.collectionLogSummary$ = this.runeProfile.getCollectionLogSummary(WOM_USERNAME).pipe(
      map(({ obtained, total }) => ({ obtained, total })),
      toResourceState()
    );
  }

  formatBossName(metric: string): string {
    return metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  formatNumber(n: number): string {
    return Math.round(n).toLocaleString();
  }

  itemImageUrl(itemId: number): string {
    return `https://static.runelite.net/cache/item/icon/${itemId}.png`;
  }

  formatGp(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B gp`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M gp`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}K gp`;
    return `${value} gp`;
  }

  sumDiaryTotals(tiers: DiaryTierTotal[]): { completed: number; total: number } {
    return tiers.reduce(
      (acc, t) => ({ completed: acc.completed + t.completed, total: acc.total + t.total }),
      { completed: 0, total: 0 },
    );
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  achievementActivityIcon(activity: RpActivity): string {
    if (activity.type === 'level_up') {
      return `osrs/skills/${this.normalizeSkillName(activity.data.name)}_icon.png`;
    }
    if (activity.type === 'quest_completed') return 'osrs/icons/quests-icon.png';
    if (activity.type === 'achievement_diary_tier_completed') return 'osrs/icons/diary-icon.png';
    if (activity.type === 'combat_achievement_tier_completed' ||
        activity.type === 'combat_achievement_tier_reached') return 'osrs/icons/combat-achievements-icon.webp';
    if (activity.type === 'xp_milestone') return 'osrs/icons/skills-icon.png';
    return 'osrs/icons/skills-icon.png';
  }

  formatAchievementLabel(activity: RpActivity): string {
    if (activity.type === 'level_up') return `${activity.data.name} ${activity.data.level}`;
    if (activity.type === 'quest_completed') return activity.enriched.questName;
    if (activity.type === 'achievement_diary_tier_completed') {
      return `${activity.enriched.areaName} ${activity.enriched.tierName ?? ''} Diary`.trim();
    }
    if (activity.type === 'combat_achievement_tier_completed' ||
        activity.type === 'combat_achievement_tier_reached') {
      return `${activity.enriched.tierName} Combat Achievements`;
    }
    if (activity.type === 'xp_milestone') {
      return `${activity.data.name} ${this.formatXp(activity.data.xp)} XP`;
    }
    return 'Achievement';
  }

  private normalizeSkillName(name: string): string {
    const lower = name.toLowerCase();
    return lower === 'runecraft' ? 'runecrafting' : lower;
  }

  private formatXp(xp: number): string {
    if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}B`;
    if (xp >= 1_000_000) return `${Math.floor(xp / 1_000_000)}M`;
    if (xp >= 1_000) return `${Math.floor(xp / 1_000)}K`;
    return `${xp}`;
  }

  dropIcon(activity: RpActivity): number {
    if (activity.type === 'valuable_drop' || activity.type === 'new_item_obtained') {
      return activity.data.itemId;
    }
    return 0;
  }

  formatDropLabel(activity: RpActivity): string {
    if (activity.type === 'valuable_drop') {
      return `${activity.enriched.itemName ?? 'Unknown'} — ${this.formatGp(activity.data.value)}`;
    }
    if (activity.type === 'new_item_obtained') {
      return activity.enriched.itemName ?? 'New collection log entry';
    }
    return 'Unknown drop';
  }

  private sortBosses(player: WomPlayer): WomBoss[] {
    return Object.values(player.latestSnapshot.data.bosses)
      .sort((a, b) => this.formatBossName(a.metric).localeCompare(this.formatBossName(b.metric)));
  }

  getBossIconUrl(metric: string): string {
    return `osrs/bosses/${metric}.png`;
  }
}
