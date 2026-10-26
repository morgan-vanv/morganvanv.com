import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { COMMUNITY_PHOTOS } from '../../shared/constants/community-photos.const';

interface PhotoSpot {
  id: number;
  imageUrl?: string;
  placeholderText?: string;
  caption?: string;
}

/** "1 photo", "6 photos": the dim count beside the wall's heading. */
export function photoCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'photo' : 'photos'}`;
}

@Component({
  selector: 'app-social-page',
  imports: [BasePageComponent, PageHeaderComponent, UnderConstructionComponent, A11yModule],
  templateUrl: './social-page.component.html',
  styleUrl: './social-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class SocialPageComponent {
  readonly siteEmail = SITE_CONFIG.email;
  readonly selectedPhoto = signal<PhotoSpot | null>(null);
  private lastFocusedElement: HTMLElement | null = null;

  readonly photoCountLabel = photoCountLabel(COMMUNITY_PHOTOS.length);

  readonly photos: PhotoSpot[] = Array.from({ length: 12 }, (_, i) => {
    const submitted = COMMUNITY_PHOTOS[i];
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

  onEscape(event: Event) {
    if (this.selectedPhoto()) {
      this.closeFullscreen();
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
