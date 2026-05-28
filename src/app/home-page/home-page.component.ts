import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { ScrollHintComponent } from '../../shared/scroll-hint/scroll-hint.component';
import { SOCIAL_LINKS } from '../../shared/constants/social-links.const';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  imports: [BasePageComponent, ScrollHintComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly socialLinks = SOCIAL_LINKS;
}

