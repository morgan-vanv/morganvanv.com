import { existsSync } from 'node:fs';
import { FAVORITE_MEDIA } from '../../../shared/constants/favorite-media.const';
import { fanCovers } from './media-fan';

describe('fanCovers', () => {
  it('fans the first film, show and book, then the second film', () => {
    const kindOf = (cover: string) => FAVORITE_MEDIA.find(pick => pick.cover === cover)?.kind;
    const covers = fanCovers();
    expect(covers.map(kindOf)).toEqual(['film', 'tv', 'book', 'film']);
    for (const cover of covers) expect(existsSync(`public${cover}`)).toBe(true);
  });
});
