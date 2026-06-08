import { Component, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

interface PhotoSpot {
  id: number;
  imageUrl?: string;
  placeholderText?: string;
  caption?: string;
}

const SUBMITTED_PHOTOS: Omit<PhotoSpot, 'id'>[] = [
  { imageUrl: 'images/community-wall/img-8938.webp', caption: 'a beast or demon of some sort' },
  { imageUrl: 'images/community-wall/img-20250303.webp', caption: 'Richard & Bernie <3' },
  { imageUrl: 'images/community-wall/gup.webp', caption: 'gup' },
  { imageUrl: 'images/community-wall/dirty_dan.webp', caption: 'Dirty Dan' },
];

@Component({
  selector: 'app-social-page',
  imports: [BasePageComponent, UnderConstructionComponent, A11yModule],
  templateUrl: './social-page.component.html',
  styleUrl: './social-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialPageComponent {
  readonly selectedPhoto = signal<PhotoSpot | null>(null);
  private lastFocusedElement: HTMLElement | null = null;

  readonly photos: PhotoSpot[] = Array.from({ length: 12 }, (_, i) => {
    const submitted = SUBMITTED_PHOTOS[i];
    if (submitted) {
      return { id: i, ...submitted };
    }
    return { id: i, placeholderText: 'Your Photo Here' };
  });

  openFullscreen(photo: PhotoSpot) {
    if (photo.imageUrl) {
      this.lastFocusedElement = document.activeElement as HTMLElement;
      this.selectedPhoto.set(photo);
      setTimeout(() => {
        const closeBtn = document.querySelector<HTMLButtonElement>('.fullscreen-overlay .close-button');
        closeBtn?.focus();
      }, 0);
    }
  }

  closeFullscreen() {
    this.selectedPhoto.set(null);
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeFullscreen();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event) {
    if (this.selectedPhoto()) {
      this.closeFullscreen();
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
