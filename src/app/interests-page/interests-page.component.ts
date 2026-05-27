import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { ScrollHintComponent } from '../../shared/scroll-hint/scroll-hint.component';
import { StatsFmService, StatsFmTopArtist, StatsFmTopAlbum, StatsFmTopTrack } from '../../shared/services/stats-fm.service';
import { WiseOldManService, WomPlayer, WomBoss } from '../../shared/services/wise-old-man.service';
import { RuneProfileService, RpCollectionLogItem, RpActivity, RpActivityType, RpCombatTier } from '../../shared/services/rune-profile.service';
import { Observable, tap, map, catchError, of } from 'rxjs';

const STATSFM_USERNAME = 'morgan.vanv';
const WOM_USERNAME = 'TipodissDong';
const STATS_DISPLAY_LIMIT = 8;
const ACTIVITIES_DISPLAY_LIMIT = 20;
const XP_MILESTONE_THRESHOLD = 100_000_000;

const NOTABLE_ACTIVITY_TYPES: RpActivityType[] = [
  'valuable_drop',
  'new_item_obtained',
  'quest_completed',
  'combat_achievement_tier_completed',
  'achievement_diary_tier_completed',
  'maxed',
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
}

const CHARACTER_BADGES: CharacterBadge[] = [
  { iconUrl: 'osrs/badges/group_ironman_badge.png', alt: 'Group Ironman', label: 'SeedSlingers' },
  { iconUrl: 'osrs/badges/clan_deputy_owner_icon.png', alt: 'Clan', label: 'Ugandans' },
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
  selector: 'app-interests-page',
  imports: [BasePageComponent, AsyncPipe, ScrollHintComponent],
  templateUrl: './interests-page.component.html',
  styleUrl: './interests-page.component.scss'
})
export class InterestsPageComponent implements OnInit {
  private statsFm = inject(StatsFmService);
  private wom = inject(WiseOldManService);
  private runeProfile = inject(RuneProfileService);

  topTracks$!: Observable<StatsFmTopTrack[]>;
  topAlbums$!: Observable<StatsFmTopAlbum[]>;
  topArtists$!: Observable<StatsFmTopArtist[]>;
  player$!: Observable<WomPlayer | null>;
  pets$!: Observable<RpCollectionLogItem[]>;
  activities$!: Observable<RpActivity[]>;
  questSummary$!: Observable<QuestSummary | null>;
  diaryTierTotals$!: Observable<DiaryTierTotal[]>;
  combatSummary$!: Observable<CombatSummary | null>;
  collectionLogSummary$!: Observable<CollectionLogSummary | null>;

  topBosses: WomBoss[] = [];
  playerLoadFailed = false;
  petsObtained = 0;
  petsTotal = 0;
  petsLoadFailed = false;
  activitiesLoadFailed = false;

  readonly characterBadges = CHARACTER_BADGES;
  readonly skillOrder = SKILL_ORDER;
  readonly skillIcons: Record<string, string> = Object.fromEntries(
    SKILL_ORDER.map(skill => [skill, `osrs/skills/${skill}_icon.png`])
  );
  readonly womUsername = WOM_USERNAME;
  readonly womProfileUrl = `https://wiseoldman.net/players/${WOM_USERNAME.toLowerCase()}`;
  readonly runeprofileUrl = `https://www.runeprofile.com/${WOM_USERNAME}`;

  ngOnInit(): void {
    this.topTracks$ = this.statsFm.getTopTracks(STATSFM_USERNAME, 'weeks').pipe(
      map(items => items.slice(0, STATS_DISPLAY_LIMIT)),
      catchError(() => of([]))
    );
    this.topAlbums$ = this.statsFm.getTopAlbums(STATSFM_USERNAME, 'months').pipe(
      map(items => items.slice(0, STATS_DISPLAY_LIMIT)),
      catchError(() => of([]))
    );
    this.topArtists$ = this.statsFm.getTopArtists(STATSFM_USERNAME, 'lifetime').pipe(
      map(items => items.slice(0, STATS_DISPLAY_LIMIT)),
      catchError(() => of([]))
    );
    this.player$ = this.wom.getPlayer(WOM_USERNAME).pipe(
      tap(p => { this.topBosses = this.sortBosses(p); }),
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
      map(petsPage => petsPage?.items ?? []),
      catchError(() => {
        this.petsLoadFailed = true;
        return of([]);
      })
    );
    this.activities$ = this.runeProfile.getActivities(WOM_USERNAME).pipe(
      map(response => response.activities
        .filter(a =>
          NOTABLE_ACTIVITY_TYPES.includes(a.type) &&
          (a.type !== 'xp_milestone' || (a.data['xp'] as number) >= XP_MILESTONE_THRESHOLD)
        )
        .slice(0, ACTIVITIES_DISPLAY_LIMIT)
      ),
      catchError(() => {
        this.activitiesLoadFailed = true;
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
      catchError(() => of([]))
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

  formatPlaytime(ms: number): string {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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

  formatXp(xp: number): string {
    if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}B`;
    if (xp >= 1_000_000) return `${Math.floor(xp / 1_000_000)}M`;
    if (xp >= 1_000) return `${Math.round(xp / 1_000)}K`;
    return `${xp}`;
  }

  sumDiaryTotals(tiers: DiaryTierTotal[]): { completed: number; total: number } {
    return tiers.reduce(
      (acc, t) => ({ completed: acc.completed + t.completed, total: acc.total + t.total }),
      { completed: 0, total: 0 },
    );
  }

  formatRelativeDate(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
    return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
  }

  activityIcon(activity: RpActivity): { type: 'item'; id: number } | { type: 'emoji'; value: string } {
    if (activity.type === 'valuable_drop' || activity.type === 'new_item_obtained') {
      return { type: 'item', id: activity.data['itemId'] as number };
    }
    const emojiMap: Partial<Record<RpActivityType, string>> = {
      quest_completed: '📜',
      combat_achievement_tier_completed: '⚔️',
      achievement_diary_tier_completed: '📋',
      maxed: '🏆',
      xp_milestone: '⭐',
    };
    return { type: 'emoji', value: emojiMap[activity.type] ?? '🎯' };
  }

  formatActivityLabel(activity: RpActivity): string {
    const e = activity.enriched;
    const d = activity.data;
    switch (activity.type) {
      case 'valuable_drop':
        return `${e['itemName'] ?? 'Unknown'} — ${this.formatGp(d['value'] as number)}`;
      case 'new_item_obtained':
        return e['itemName'] ?? 'New collection log entry';
      case 'quest_completed':
        return e['questName'] ?? 'Quest completed';
      case 'combat_achievement_tier_completed':
        return `${e['tierName'] ?? 'Unknown'} Combat Achievements`;
      case 'achievement_diary_tier_completed': {
        const tierLabels = ['Easy', 'Medium', 'Hard', 'Elite'];
        const tier = tierLabels[d['tier'] as number] ?? e['tierName'] ?? 'Unknown';
        return `${e['areaName'] ?? 'Unknown'} ${tier} Diary`;
      }
      case 'maxed':
        return 'Achieved max total level!';
      case 'xp_milestone': {
        const skill = (d['name'] as string);
        const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
        return `${skillName} — ${this.formatXp(d['xp'] as number)} XP`;
      }
      default:
        return 'Unknown activity';
    }
  }

  private sortBosses(player: WomPlayer): WomBoss[] {
    return Object.values(player.latestSnapshot.data.bosses)
      .filter(b => b.kills > 0)
      .sort((a, b) => b.kills - a.kills);
  }
}

