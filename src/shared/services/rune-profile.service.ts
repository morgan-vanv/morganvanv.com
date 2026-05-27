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

export type RpActivityType =
  | 'level_up'
  | 'new_item_obtained'
  | 'valuable_drop'
  | 'quest_completed'
  | 'combat_achievement_tier_completed'
  | 'achievement_diary_tier_completed'
  | 'maxed'
  | 'xp_milestone';

export interface RpActivity {
  type: RpActivityType;
  data: Record<string, number | string>;
  enriched: Record<string, string>;
  createdAt: string;
}

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

  getActivities(username: string, cursor?: string): Observable<RpActivitiesResponse> {
    const params: Record<string, string> = {};
    if (cursor) params['cursor'] = cursor;
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
