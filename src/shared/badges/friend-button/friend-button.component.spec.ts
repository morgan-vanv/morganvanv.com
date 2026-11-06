import { readFileSync, readdirSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { FriendButtonComponent } from './friend-button.component';
import { FRIENDS, Friend } from '../../constants/friends.const';

/** Width and height from a GIF's logical screen descriptor, or a lossless WebP's VP8L header. */
function imageSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(`public${path}`);
  if (bytes.toString('ascii', 0, 3) === 'GIF') return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (bytes.toString('ascii', 12, 16) === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`${path}: not a GIF or a lossless WebP`);
}

describe('FriendButtonComponent', () => {
  async function render(friend: Friend) {
    TestBed.configureTestingModule({ imports: [FriendButtonComponent] });
    const fixture = TestBed.createComponent(FriendButtonComponent);
    fixture.componentRef.setInput('friend', friend);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('links to the friend in a new tab, named from the words on its face', async () => {
    const el = await render(FRIENDS[0]);
    const link = el.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://nickdeda.com');
    expect(link.getAttribute('target')).toBe('_blank');
    // Referer left on, so they can see who sent them.
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.getAttribute('aria-label')).toBe("Nick Deda, nickdeda.com: a friend's site. Opens in a new tab.");
    expect(link.querySelector('img')?.getAttribute('src')).toBe('/friends/nickdeda.gif');
  });

  it('shows an animated button still under reduced motion, and needs no still for one that isn’t', async () => {
    const nick = await render(FRIENDS[0]);
    const source = nick.querySelector('source')!;
    expect(source.getAttribute('media')).toBe('(prefers-reduced-motion: reduce)');
    expect(source.getAttribute('srcset')).toBe('/friends/nickdeda-still.webp');

    TestBed.resetTestingModule();
    const harry = await render(FRIENDS[1]);
    expect(harry.querySelector('source')).toBeNull();
  });

  it('keeps a real 88×31 for every friend, and nothing else in public/friends', () => {
    const files = FRIENDS.flatMap(f => [f.image, ...(f.still ? [f.still] : [])]);
    for (const file of files) expect(imageSize(file), file).toEqual({ width: 88, height: 31 });
    const committed = readdirSync('public/friends').sort().map(name => `/friends/${name}`);
    expect(committed).toEqual([...files].sort());
  });
});

