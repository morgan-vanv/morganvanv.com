import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { COMMUNITY_PHOTOS, CommunityPhoto, photoCountLabel } from '../../shared/constants/community-photos.const';
import { CampfireService } from '../../shared/services/campfire.service';
import { MailbagComponent } from './mailbag/mailbag';
import { ShoutboxComponent } from './shoutbox/shoutbox';

/** The wall's open slot: an email with the subject set and a nudge for a caption. Copy approved by Morgan (2026-10-28). */
export function photoMailto(email: string): string {
  const subject = 'A photo for the wall';
  const body = 'Photo attached.\n\nCaption (optional): ';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

@Component({
  selector: 'app-social-page',
  imports: [BasePageComponent, PageHeaderComponent, UnderConstructionComponent, ShoutboxComponent, A11yModule, MailbagComponent],
  templateUrl: './social-page.component.html',
  styleUrl: './social-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class SocialPageComponent {
  readonly siteEmail = SITE_CONFIG.email;
  readonly photoMailto = photoMailto(SITE_CONFIG.email);
  readonly irc = SITE_CONFIG.irc;
  /** The shoutbox lives on the campfire; without one configured it stays under construction. */
  private readonly campfire = inject(CampfireService);
  readonly shoutboxLive = this.campfire.configured;
  /** "3 by the fire", once the campfire has said who's here. */
  readonly hereLabel = computed(() => {
    const here = this.campfire.shoutLog()?.here;
    if (!here) return null;
    return here === 1 ? 'just you by the fire' : `${here} by the fire`;
  });
  readonly selectedPhoto = signal<CommunityPhoto | null>(null);
  private lastFocusedElement: HTMLElement | null = null;

  readonly photoCountLabel = photoCountLabel(COMMUNITY_PHOTOS.length);

  /** The real photos only, oldest first; the wall ends with one open slot rather than a row of empty ones. */
  readonly photos = COMMUNITY_PHOTOS;

  openFullscreen(photo: CommunityPhoto) {
    this.lastFocusedElement = document.activeElement as HTMLElement;
    this.selectedPhoto.set(photo);
    setTimeout(() => {
      const closeBtn = document.querySelector<HTMLButtonElement>('.fullscreen-overlay .close-button');
      closeBtn?.focus();
    }, 0);
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
