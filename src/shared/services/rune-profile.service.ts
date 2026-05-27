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
}
