import { Component } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

export interface PhotoSpot {
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
})
export class SocialPageComponent {
  readonly photos: PhotoSpot[] = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    placeholderText: 'Your Photo Here',
    caption: undefined
  }));
}
