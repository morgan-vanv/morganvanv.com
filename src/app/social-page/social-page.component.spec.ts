import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SocialPageComponent } from './social-page.component';

describe('SocialPageComponent', () => {
  let component: SocialPageComponent;
  let fixture: ComponentFixture<SocialPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialPageComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SocialPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open fullscreen if photo has imageUrl', fakeAsync(() => {
    const photo = { id: 1, imageUrl: 'test.jpg', caption: 'test' };
    component.openFullscreen(photo);
    expect(component.selectedPhoto()).toBe(photo);
    tick();
  }));

  it('should not open fullscreen if photo has no imageUrl', () => {
    const photo = { id: 1, placeholderText: 'Your Photo Here' };
    component.openFullscreen(photo);
    expect(component.selectedPhoto()).toBeNull();
  });

  it('should close fullscreen', fakeAsync(() => {
    const photo = { id: 1, imageUrl: 'test.jpg' };
    component.openFullscreen(photo);
    tick();
    component.closeFullscreen();
    expect(component.selectedPhoto()).toBeNull();
  }));

  it('should handle Escape key to close fullscreen', fakeAsync(() => {
    const photo = { id: 1, imageUrl: 'test.jpg' };
    component.openFullscreen(photo);
    tick();
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    spyOn(event, 'preventDefault');
    
    component.onEscape(event);
    
    expect(component.selectedPhoto()).toBeNull();
    expect(event.preventDefault).toHaveBeenCalled();
  }));

  it('should not prevent default on Escape if not fullscreen', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    spyOn(event, 'preventDefault');
    
    component.onEscape(event);
    
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
