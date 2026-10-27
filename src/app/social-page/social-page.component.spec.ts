import { existsSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialPageComponent } from './social-page.component';
import { COMMUNITY_PHOTOS, photoCountLabel } from '../../shared/constants/community-photos.const';

describe('SocialPageComponent', () => {
  let component: SocialPageComponent;
  let fixture: ComponentFixture<SocialPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SocialPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('fills 12 polaroid slots, submitted photos first', () => {
    expect(component.photos.length).toBe(12);
    expect(component.photos[0].imageUrl).toBeDefined();
    expect(component.photos[11].placeholderText).toBe('Your Photo Here');
  });

  it('shows one h1 and the photo count beside the wall heading', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Social');
    const wallHeading = [...el.querySelectorAll('h2')].find(h => h.textContent?.includes('Community Photo Wall'));
    expect(wallHeading?.querySelector('.range-label')?.textContent?.trim()).toBe(photoCountLabel(COMMUNITY_PHOTOS.length));
  });

  it('links the shoutbox panel to the real IRC channel on Libera.Chat', () => {
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.shoutbox');
    expect(panel?.querySelector('h2')?.textContent).toContain('#morganvanv');
    const join = panel?.querySelector<HTMLAnchorElement>('a.irc-join');
    expect(join?.getAttribute('href')).toBe('https://web.libera.chat/gamja/?nick=guest#morganvanv');
    expect(join?.getAttribute('target')).toBe('_blank');
    expect(join?.getAttribute('aria-label')).toContain('Join #morganvanv on Libera.Chat');
    expect(panel?.querySelector('.irc-client')?.textContent).toContain('irc.libera.chat · 6697 (TLS)');
  });

  it('counts photos in words', () => {
    expect(photoCountLabel(1)).toBe('1 photo');
    expect(photoCountLabel(6)).toBe('6 photos');
    expect(photoCountLabel(0)).toBe('0 photos');
  });

  it('opens fullscreen for a photo with an image', () => {
    const photo = { id: 1, imageUrl: 'test.jpg', caption: 'test' };
    component.openFullscreen(photo);
    expect(component.selectedPhoto()).toBe(photo);
  });

  it('does not open fullscreen for an empty slot', () => {
    component.openFullscreen({ id: 1, placeholderText: 'Your Photo Here' });
    expect(component.selectedPhoto()).toBeNull();
  });

  it('closes fullscreen', () => {
    component.openFullscreen({ id: 1, imageUrl: 'test.jpg' });
    component.closeFullscreen();
    expect(component.selectedPhoto()).toBeNull();
  });

  it('closes on Escape only while a photo is open', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    component.onEscape(event);
    expect(event.defaultPrevented).toBe(false);

    component.openFullscreen({ id: 1, imageUrl: 'test.jpg' });
    const second = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    component.onEscape(second);
    expect(component.selectedPhoto()).toBeNull();
    expect(second.defaultPrevented).toBe(true);
  });

  it('closes when the overlay backdrop itself is clicked', () => {
    component.openFullscreen({ id: 1, imageUrl: 'test.jpg' });
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
