import { Component, ChangeDetectionStrategy, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { SOCIAL_LINKS } from '../../shared/constants/social-links.const';
import { AskMorganFormComponent } from './ask-morgan-form/ask-morgan-form';
import { AvatarSaysComponent } from './avatar-says/avatar-says';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  imports: [BasePageComponent, AskMorganFormComponent, AvatarSaysComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly socialLinks = SOCIAL_LINKS;

  constructor() {
    // A link here with a fragment (Projects' "suggest one ›" goes to #home-contact) brings its panel
    // into view. The router's anchor scrolling moves the window, but the page scrolls inside the card.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    if (fragment) {
      afterNextRender(() => {
        const target = document.getElementById(fragment);
        (target?.closest('section') ?? target)?.scrollIntoView?.({ block: 'start' });
      });
    }
  }
}
