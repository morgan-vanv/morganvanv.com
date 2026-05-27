import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RpCollectionLogItem {
  id: number;
  name: string;
  quantity: number;
}

export interface RpCollectionLogPage {
  name: string;
  obtained: number;
  total: number;
  items: RpCollectionLogItem[];
}

export interface RpCollectionLogTabResponse {
  name: string;
  obtained: number;
  total: number;
  pages: RpCollectionLogPage[];
}

export interface RpCollectionLogSummary {
  obtained: number;
  total: number;
}

export interface RpQuest {
  id: number;
  name: string;
  points: number;
  type: 'free' | 'members' | 'mini';
  state: 'not_started' | 'in_progress' | 'finished';
}

export interface RpDiaryTier {
  tier: string;
  completed: number;
  total: number;
}

export interface RpDiaryArea {
  areaId: number;
  area: string;
  tiers: RpDiaryTier[];
}

export interface RpCombatTier {
  id: number;
  name: string;
  completed: number;
  total: number;
}

interface RpActivityBase {
  createdAt: string;
}

export interface RpValuableDropActivity extends RpActivityBase {
  type: 'valuable_drop';
  data: { itemId: number; value: number };
  enriched: { itemName: string };
}

export interface RpNewItemActivity extends RpActivityBase {
  type: 'new_item_obtained';
  data: { itemId: number };
  enriched: { itemName: string };
}

export interface RpQuestActivity extends RpActivityBase {
  type: 'quest_completed';
  data: { questId: number };
  enriched: { questName: string };
}

export interface RpCombatAchievementTierActivity extends RpActivityBase {
  type: 'combat_achievement_tier_completed';
  data: Record<string, unknown>;
  enriched: { tierName: string };
}

export interface RpCombatAchievementTierReachedActivity extends RpActivityBase {
  type: 'combat_achievement_tier_reached';
  data: Record<string, unknown>;
  enriched: { tierName: string };
}

export interface RpDiaryTierActivity extends RpActivityBase {
  type: 'achievement_diary_tier_completed';
  data: { tier: number; areaId?: number };
  enriched: { tierName?: string; areaName: string };
}

export interface RpMaxedActivity extends RpActivityBase {
  type: 'maxed';
  data: Record<string, unknown>;
  enriched: Record<string, unknown>;
}

export interface RpXpMilestoneActivity extends RpActivityBase {
  type: 'xp_milestone';
  data: { name: string; xp: number };
  enriched: Record<string, unknown>;
}

export interface RpLevelUpActivity extends RpActivityBase {
  type: 'level_up';
  data: { name: string; level: number };
  enriched: Record<string, unknown>;
}

export type RpActivity =
  | RpValuableDropActivity
  | RpNewItemActivity
  | RpQuestActivity
  | RpCombatAchievementTierActivity
  | RpCombatAchievementTierReachedActivity
  | RpDiaryTierActivity
  | RpMaxedActivity
  | RpXpMilestoneActivity
  | RpLevelUpActivity;

export type RpActivityType = RpActivity['type'];

export interface RpActivitiesResponse {
  activities: RpActivity[];
  nextCursor: string | null;
  hasMore: boolean;
}

const BASE_URL = 'https://api.runeprofile.com/v1';

@Injectable({ providedIn: 'root' })
export class RuneProfileService {
  private http = inject(HttpClient);

  getCollectionLogTab(username: string, tab: string): Observable<RpCollectionLogTabResponse> {
    return this.http.get<RpCollectionLogTabResponse>(
      `${BASE_URL}/accounts/${encodeURIComponent(username)}/collection-log/${encodeURIComponent(tab)}`
    );
  }

  getActivities(username: string, activityTypes?: RpActivityType[], cursor?: string): Observable<RpActivitiesResponse> {
    const params: Record<string, string> = {};
    if (cursor) params['cursor'] = cursor;
    if (activityTypes?.length) params['activityTypes'] = activityTypes.join(',');
    return this.http.get<RpActivitiesResponse>(
      `${BASE_URL}/accounts/${encodeURIComponent(username)}/activities`,
      { params }
    );
  }

  getQuests(username: string): Observable<{ data: RpQuest[] }> {
    return this.http.get<{ data: RpQuest[] }>(
      `${BASE_URL}/accounts/${encodeURIComponent(username)}/quests`
    );
  }

  getAchievementDiaries(username: string): Observable<{ data: RpDiaryArea[] }> {
    return this.http.get<{ data: RpDiaryArea[] }>(
      `${BASE_URL}/accounts/${encodeURIComponent(username)}/achievement-diaries`
    );
  }

  getCombatAchievements(username: string): Observable<{ data: RpCombatTier[] }> {
    return this.http.get<{ data: RpCombatTier[] }>(
      `${BASE_URL}/accounts/${encodeURIComponent(username)}/combat-achievements`
    );
  }

  getCollectionLogSummary(username: string): Observable<RpCollectionLogSummary> {
    return this.http.get<RpCollectionLogSummary>(
      `${BASE_URL}/accounts/${encodeURIComponent(username)}/collection-log`
    );
  }
}
