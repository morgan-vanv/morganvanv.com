import { Component, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
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
];

@Component({
  selector: 'app-social-page',
  imports: [BasePageComponent, UnderConstructionComponent],
  templateUrl: './social-page.component.html',
  styleUrl: './social-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialPageComponent {
  readonly selectedPhoto = signal<PhotoSpot | null>(null);

  readonly photos: PhotoSpot[] = Array.from({ length: 12 }, (_, i) => {
    const submitted = SUBMITTED_PHOTOS[i];
    if (submitted) {
      return { id: i, ...submitted };
    }
    return { id: i, placeholderText: 'Your Photo Here' };
  });

  openFullscreen(photo: PhotoSpot) {
    if (photo.imageUrl) {
      this.selectedPhoto.set(photo);
      setTimeout(() => {
        const closeBtn = document.querySelector<HTMLButtonElement>('.fullscreen-overlay .close-button');
        closeBtn?.focus();
      }, 0);
    }
  }

  closeFullscreen() {
    this.selectedPhoto.set(null);
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
    }
  }
}
