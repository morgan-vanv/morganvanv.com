import { Observable, catchError, map, of, startWith } from 'rxjs';

/** Loading / error / data triple for a live panel. */
export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

export const LOADING: ResourceState<never> = { data: null, loading: true, error: false };

export function toResourceState<T>(): (source: Observable<T>) => Observable<ResourceState<T>> {
  return source => source.pipe(
    map(data => ({ data, loading: false, error: false })),
    catchError(() => of({ data: null, loading: false, error: true })),
    startWith(LOADING)
  );
}
