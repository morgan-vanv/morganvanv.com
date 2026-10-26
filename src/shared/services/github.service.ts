import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiCacheService } from './api-cache.service';

export interface GitHubRepo {
  html_url: string;
  /** Last push to any branch, ISO 8601. */
  pushed_at: string;
}

const BASE_URL = 'https://api.github.com';
/** Unauthenticated GitHub API allows 60 requests an hour per visitor; 30 minutes is plenty fresh. */
const REPO_TTL_MS = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class GitHubService {
  private readonly http = inject(ApiCacheService);

  getRepo(owner: string, name: string): Observable<GitHubRepo> {
    return this.http.get<GitHubRepo>(`${BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, REPO_TTL_MS);
  }
}
