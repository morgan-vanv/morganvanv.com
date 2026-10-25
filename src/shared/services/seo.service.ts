import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SITE_CONFIG } from '../config/site.config';
import { SOCIAL_LINKS } from '../constants/social-links.const';

/**
 * Per-route <title>, description, Open Graph tags and canonical link, plus a
 * site-wide JSON-LD Person block. Registered as the router's TitleStrategy so
 * it runs on every navigation, on the server too, which means the prerendered
 * HTML for each route already carries the right tags.
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  constructor() {
    super();
    this.addJsonLd();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const route = this.deepest(snapshot.root);
    const routeTitle = this.buildTitle(snapshot);
    const description = (route.data['description'] as string | undefined) ?? SITE_CONFIG.defaultDescription;
    const path = snapshot.url.split(/[?#]/)[0];
    const canonical = `${SITE_CONFIG.url}${path === '/' ? '' : path}`;
    const fullTitle = routeTitle && path !== '/' ? `${routeTitle} · ${SITE_CONFIG.domain}` : SITE_CONFIG.domain;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.setCanonical(canonical);
  }

  private deepest(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let node = route;
    while (node.firstChild) node = node.firstChild;
    return node;
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private addJsonLd(): void {
    if (this.document.head.querySelector('script[type="application/ld+json"]')) return;
    const person = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      image: `${SITE_CONFIG.url}/profile_picture.webp`,
      jobTitle: 'Software Engineer',
      worksFor: { '@type': 'Organization', name: 'The Home Depot' },
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Ohio University' },
      sameAs: SOCIAL_LINKS.filter(l => l.external).map(l => l.href),
    };
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(person);
    this.document.head.appendChild(script);
  }
}
