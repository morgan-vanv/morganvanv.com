import { Component, ChangeDetectionStrategy, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { SOCIAL_LINKS } from '../../shared/constants/social-links.const';
import { AskMorganFormComponent } from './ask-morgan-form/ask-morgan-form';
import { AvatarSaysComponent } from './avatar-says/avatar-says';
import { HomePorchComponent } from './porch/porch';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';

export interface HomeStop {
  path: string;
  name: string;
  line: string;
  /** Wears the under-construction capsule. */
  wip?: boolean;
}

/** Every page, in the nav's order with the Lab after its parent, each with Morgan's line for it (2026-11-09). */
export const HOME_STOPS: readonly HomeStop[] = [
  { path: '/now', name: 'Now', line: 'what I\'m up to lately, updated live' },
  { path: '/background', name: 'Background', line: 'professional notes, plus info about me' },
  { path: '/social', name: 'Social', line: 'a place for everyone to gather, come kick it' },
  { path: '/interests', name: 'Interests', line: 'the stuff I\'m into, check out my taste in music and media' },
  { path: '/projects', name: 'Projects', line: 'what I\'ve been working on these days' },
  { path: '/lab', name: 'Lab', line: 'the machines in my office rack and closet' },
  { path: '/blog', name: 'Blog', line: 'writing, eventually.', wip: isUnderConstruction('blog') },
];

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  imports: [BasePageComponent, RouterLink, AskMorganFormComponent, AvatarSaysComponent, HomePorchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly socialLinks = SOCIAL_LINKS;
  readonly stops = HOME_STOPS;

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
