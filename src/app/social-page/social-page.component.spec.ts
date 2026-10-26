import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialPageComponent, photoCountLabel } from './social-page.component';
import { COMMUNITY_PHOTOS } from '../../shared/constants/community-photos.const';

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
});
