import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialPageComponent } from './social-page.component';

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
