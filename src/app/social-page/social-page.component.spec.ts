import { existsSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SocialPageComponent, photoMailto } from './social-page.component';
import { COMMUNITY_PHOTOS, photoCountLabel } from '../../shared/constants/community-photos.const';

describe('SocialPageComponent', () => {
  let component: SocialPageComponent;
  let fixture: ComponentFixture<SocialPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SocialPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('puts the real photos on the wall, then one open slot that emails a photo in', () => {
    const el = fixture.nativeElement as HTMLElement;
    const wall = el.querySelector('.photo-wall')!;
    expect(wall.children.length).toBe(COMMUNITY_PHOTOS.length + 1);
    expect(wall.querySelectorAll('.polaroid.clickable').length).toBe(COMMUNITY_PHOTOS.length);
    const invite = wall.lastElementChild as HTMLAnchorElement;
    expect(invite.matches('a.polaroid.invite')).toBe(true);
    expect(invite.getAttribute('href')).toBe(photoMailto('website@morganvanv.com'));
    expect(invite.getAttribute('aria-label')).toContain('Your photo here');
  });

  it('builds the mailto with the subject and a caption prompt', () => {
    const url = new URL(photoMailto('website@morganvanv.com'));
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('website@morganvanv.com');
    expect(url.searchParams.get('subject')).toBe('A photo for the wall');
    expect(url.searchParams.get('body')).toContain('Caption');
  });

  it('shows one h1 with its line, and the photo count and the address beside the wall heading', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Social');
    expect(el.querySelector('app-page-header .desc')?.textContent?.trim()).toBe('the room where it happens');
    const wallHeading = [...el.querySelectorAll('h2')].find(h => h.textContent?.includes('Community Photo Wall'));
    const qualifier = wallHeading?.querySelector('.range-label');
    expect(qualifier?.textContent).toContain(photoCountLabel(COMMUNITY_PHOTOS.length));
    expect(qualifier?.querySelector('a.pill')?.textContent?.trim()).toBe('website@morganvanv.com');
  });

  it('links the shoutbox panel to the real IRC channel on Libera.Chat', () => {
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.shoutbox');
    const join = panel?.querySelector<HTMLAnchorElement>('a.irc-join');
    expect(join?.getAttribute('href')).toBe('https://web.libera.chat/gamja/?nick=guest#morganvanv');
    expect(join?.getAttribute('target')).toBe('_blank');
    expect(join?.getAttribute('aria-label')).toContain('Join #morganvanv on Libera.Chat');
    expect(panel?.querySelector('.irc-client')?.textContent).toContain('irc.libera.chat · 6697 (TLS)');
  });

  it('leads with the conversation: the mailbag, then the shoutbox, then the wall', () => {
    const el = fixture.nativeElement as HTMLElement;
    const top = el.querySelector('.talk')!;
    expect([...top.children].map(c => c.matches('app-mailbag') ? 'mailbag' : c.matches('.shoutbox') ? 'shoutbox' : '?'))
      .toEqual(['mailbag', 'shoutbox']);
    expect(top.querySelector('app-mailbag h2')?.textContent).toContain('You Asked');
    expect(top.querySelector('.shoutbox h2')?.textContent).toContain('Shoutbox');
    // The wall comes after, outside the top row.
    expect(top.nextElementSibling?.matches('.wall-panel')).toBe(true);
  });

  it('puts the live shoutbox in its panel, above the way into IRC', () => {
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.shoutbox');
    expect(panel?.querySelector('app-shoutbox')).not.toBeNull();
    expect(panel?.querySelector('app-under-construction')).toBeNull();
  });

  it('counts photos in words', () => {
    expect(photoCountLabel(1)).toBe('1 photo');
    expect(photoCountLabel(6)).toBe('6 photos');
    expect(photoCountLabel(0)).toBe('0 photos');
  });

  it('opens fullscreen for a photo', () => {
    const photo = { imageUrl: 'test.jpg', thumbUrl: 'thumb.jpg', caption: 'test' };
    component.openFullscreen(photo);
    expect(component.selectedPhoto()).toBe(photo);
  });

  it('closes fullscreen', () => {
    component.openFullscreen({ imageUrl: 'test.jpg', thumbUrl: 'thumb.jpg' });
    component.closeFullscreen();
    expect(component.selectedPhoto()).toBeNull();
  });

  it('closes on Escape only while a photo is open', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    component.onEscape(event);
    expect(event.defaultPrevented).toBe(false);

    component.openFullscreen({ imageUrl: 'test.jpg', thumbUrl: 'thumb.jpg' });
    const second = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    component.onEscape(second);
    expect(component.selectedPhoto()).toBeNull();
    expect(second.defaultPrevented).toBe(true);
  });

  it('closes when the overlay backdrop itself is clicked', () => {
    component.openFullscreen({ imageUrl: 'test.jpg', thumbUrl: 'thumb.jpg' });
    const overlay = document.createElement('div');
    const event = { target: overlay, currentTarget: overlay } as unknown as MouseEvent;
    component.onOverlayClick(event);
    expect(component.selectedPhoto()).toBeNull();
  });

  it('has the full photo and its wall thumbnail on disk for every community photo', () => {
    for (const photo of COMMUNITY_PHOTOS) {
      expect(existsSync(`public/${photo.imageUrl}`), photo.imageUrl).toBe(true);
      expect(existsSync(`public/${photo.thumbUrl}`), photo.thumbUrl).toBe(true);
    }
  });

  it('shows thumbnails on the wall and the full photo fullscreen', async () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.polaroid-image')?.getAttribute('src')).toBe(COMMUNITY_PHOTOS[0].thumbUrl);
    component.openFullscreen(component.photos[0]);
    await fixture.whenStable();
    expect(el.querySelector('.fullscreen-image')?.getAttribute('src')).toBe(COMMUNITY_PHOTOS[0].imageUrl);
  });
});
