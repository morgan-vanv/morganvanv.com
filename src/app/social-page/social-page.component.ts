import { Component, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

interface PhotoSpot {
  id: number;
  imageUrl?: string;
  placeholderText?: string;
  caption?: string;
}

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
    if (i === 0) {
      return { id: i, imageUrl: 'images/community-wall/img-8938.webp', caption: 'a beast or demon of some sort' };
    } else if (i === 1) {
      return { id: i, imageUrl: 'images/community-wall/img-20250303.webp', caption: 'Richard & Bernie <3' };
    }
    return { id: i, placeholderText: 'Your Photo Here' };
  });

  openFullscreen(photo: PhotoSpot) {
    if (photo.imageUrl) {
      this.selectedPhoto.set(photo);
    }
  }

  closeFullscreen() {
    this.selectedPhoto.set(null);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event) {
    if (this.selectedPhoto()) {
      this.closeFullscreen();
      event.preventDefault();
    }
  }
}
