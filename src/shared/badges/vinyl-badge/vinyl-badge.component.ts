import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { ApiCacheService } from '../../services/api-cache.service';
import { SITE_CONFIG } from '../../config/site.config';

const USER = SITE_CONFIG.handles.discogs;
/** One request answers both: the newest addition, and (in `pagination.items`) how many there are in all. */
export const VINYL_URL = `${SITE_CONFIG.discogsApiUrl}/users/${USER}/collection/folders/0/releases?sort=added&sort_order=desc&per_page=1`;
const VINYL_TTL_MS = 6 * 60 * 60 * 1000;

interface DiscogsCollectionPage {
  pagination?: { items?: number };
  releases?: { basic_information?: { title?: string; artists?: { name?: string }[] } }[];
}

export interface VinylShelf {
  count: number;
  newest: string | null;
}

/** The count and the newest record from Discogs' answer; null if it isn't one. */
export function toShelf(page: DiscogsCollectionPage | null): VinylShelf | null {
  const count = page?.pagination?.items;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
  const info = page?.releases?.[0]?.basic_information;
  // Discogs tells same-named artists apart with a number: "Low (2)".
  const artist = info?.artists?.[0]?.name?.replace(/\s\(\d+\)$/, '');
  const newest = info?.title ? (artist ? `${info.title} — ${artist}` : info.title) : null;
  return { count, newest };
}

/**
 * How many records are in the collection, per Discogs, and the newest one. Needs the collection to be
 * public; if Discogs says no (or doesn't answer), the badge just doesn't show.
 */
@Component({
  selector: 'app-vinyl-badge',
  imports: [BadgeComponent],
  templateUrl: './vinyl-badge.component.html',
  styleUrl: './vinyl-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VinylBadgeComponent {
  private readonly api = inject(ApiCacheService);
  readonly href = `https://www.discogs.com/user/${USER}/collection`;

  private readonly shelf = toSignal(
    this.api.get<DiscogsCollectionPage>(VINYL_URL, VINYL_TTL_MS).pipe(
      map(toShelf),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );

  readonly vinyl = computed(() => {
    const shelf = this.shelf();
    if (!shelf) return null;
    const records = `${shelf.count} ${shelf.count === 1 ? 'record' : 'records'}`;
    return {
      value: records,
      popover: {
        title: 'On the shelf',
        rows: [
          { label: 'Records', value: String(shelf.count) },
          ...(shelf.newest ? [{ label: 'Newest', value: shelf.newest }] : []),
        ],
        note: 'via Discogs',
        cta: 'flip through ↗',
      } satisfies BadgePopover,
      label: `Vinyl Collection: ${records}` + (shelf.newest ? `, newest: ${shelf.newest}` : '') +
        '. Opens it on Discogs in a new tab.',
    };
  });
}
