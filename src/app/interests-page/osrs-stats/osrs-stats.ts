import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { WiseOldManService, WomPlayer, WomBoss } from '../../../shared/services/wise-old-man.service';
import { RuneProfileService, RpCollectionLogItem, RpActivity, RpActivityType, RpCombatTier } from '../../../shared/services/rune-profile.service';
import { Observable, tap, map, catchError, of } from 'rxjs';

const WOM_USERNAME = 'TipodissDong';
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

// Ordered to match the in-game Skills tab layout (3 columns, top to bottom)
const SKILL_ORDER = [
  'attack',       'hitpoints',    'mining',
  'strength',     'agility',      'smithing',
  'defence',      'herblore',     'fishing',
  'ranged',       'thieving',     'cooking',
  'prayer',       'crafting',     'firemaking',
  'magic',        'fletching',    'woodcutting',
  'runecrafting', 'slayer',       'farming',
  'construction', 'hunter',       'sailing',
] as const;

interface CharacterBadge {
  iconUrl: string;
  alt: string;
  label: string;
  href: string;
}

const CHARACTER_BADGES: CharacterBadge[] = [
  { iconUrl: 'osrs/badges/group_ironman_badge.png', alt: 'Group Ironman', label: 'SeedSlingers', href: 'https://wiseoldman.net/groups/12982' },
  { iconUrl: 'osrs/badges/clan_deputy_owner_icon.png', alt: 'Clan', label: 'Ugandans', href: 'https://wiseoldman.net/groups/7117' },
];

interface PoweredByLink {
  label: string;
  href: string;
}

const POWERED_BY_LINKS: PoweredByLink[] = [
  { label: 'Wise Old Man', href: `https://wiseoldman.net/players/${WOM_USERNAME}` },
  { label: 'RuneProfile', href: `https://www.runeprofile.com/${WOM_USERNAME}` },
  { label: 'TempleOSRS', href: `https://templeosrs.com/player/overview.php?player=${WOM_USERNAME.toLowerCase()}` },
];

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

const DIARY_TIERS = ['Easy', 'Medium', 'Hard', 'Elite'] as const;

@Component({
  selector: 'app-osrs-stats',
  imports: [AsyncPipe],
  templateUrl: './osrs-stats.html',
  styleUrl: './osrs-stats.scss'
})
export class OsrsStatsComponent implements OnInit {
  private wom = inject(WiseOldManService);
  private runeProfile = inject(RuneProfileService);

  player$!: Observable<WomPlayer | null>;
  pets$!: Observable<RpCollectionLogItem[]>;
  drops$!: Observable<RpActivity[]>;
  achievements$!: Observable<RpActivity[]>;
  questSummary$!: Observable<QuestSummary | null>;
  diaryTierTotals$!: Observable<DiaryTierTotal[] | null>;
  combatSummary$!: Observable<CombatSummary | null>;
  collectionLogSummary$!: Observable<CollectionLogSummary | null>;

  bosses: WomBoss[] = [];
  playerLoadFailed = false;
  petsObtained = 0;
  petsTotal = 0;
  petsLoadFailed = false;
  dropsLoadFailed = false;
  achievementsLoadFailed = false;

  readonly characterBadges = CHARACTER_BADGES;
  readonly poweredByLinks = POWERED_BY_LINKS;
  readonly skillOrder = SKILL_ORDER;
  readonly skillIcons: Record<string, string> = Object.fromEntries(
    SKILL_ORDER.map(skill => [skill, `osrs/skills/${skill}_icon.png`])
  );
  readonly womUsername = WOM_USERNAME;

  ngOnInit(): void {
    this.player$ = this.wom.getPlayer(WOM_USERNAME).pipe(
      tap(p => { this.bosses = this.sortBosses(p); }),
      catchError(() => {
        this.playerLoadFailed = true;
        return of(null);
      })
    );
    this.pets$ = this.runeProfile.getCollectionLogTab(WOM_USERNAME, 'Other').pipe(
      map(response => response.pages.find(p => p.name === 'All Pets')),
      tap(petsPage => {
        this.petsObtained = petsPage?.obtained ?? 0;
        this.petsTotal = petsPage?.total ?? 0;
      }),
      map(petsPage => (petsPage?.items ?? []).filter(item => item.quantity > 0)),
      catchError(() => {
        this.petsLoadFailed = true;
        return of([]);
      })
    );
    this.drops$ = this.runeProfile.getActivities(WOM_USERNAME, DROP_ACTIVITY_TYPES).pipe(
      map(response => response.activities.slice(0, DISPLAY_LIMIT)),
      catchError(() => {
        this.dropsLoadFailed = true;
        return of([]);
      })
    );
    this.achievements$ = this.runeProfile.getActivities(WOM_USERNAME, ACHIEVEMENT_ACTIVITY_TYPES).pipe(
      map(response => response.activities.slice(0, DISPLAY_LIMIT)),
      catchError(() => {
        this.achievementsLoadFailed = true;
        return of([]);
      })
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
      catchError(() => of(null))
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
      catchError(() => of(null))
    );
    this.combatSummary$ = this.runeProfile.getCombatAchievements(WOM_USERNAME).pipe(
      map(response => ({
        tiers: response.data,
        totalCompleted: response.data.reduce((sum, t) => sum + t.completed, 0),
        totalTasks: response.data.reduce((sum, t) => sum + t.total, 0),
      })),
      catchError(() => of(null))
    );
    this.collectionLogSummary$ = this.runeProfile.getCollectionLogSummary(WOM_USERNAME).pipe(
      map(({ obtained, total }) => ({ obtained, total })),
      catchError(() => of(null))
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
        activity.type === 'combat_achievement_tier_reached') return 'osrs/icons/combat-achievements-icon.png';
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
