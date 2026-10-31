import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Project } from '../constants/projects.const';

/**
 * Makes a project's art a way in: a link laid over the whole picture to the project's live site (or
 * its page here), with a gold `[ label › ]` that rises in while the pointer is on it. Used by the
 * /now card and the /projects poster, so both behave the same. Place it inside the art's box
 * (`position: relative`), after the art and before the ribbon; the host zooms the art with
 * `.art:has(app-project-art-link:hover)`. It's for pointers only: out of the tab order and hidden
 * from screen readers, since the card's own "Play it" link already goes to the same place. Renders
 * nothing for a project with nowhere to go.
 */
@Component({
  selector: 'app-project-art-link',
  imports: [RouterLink],
  templateUrl: './project-art-link.component.html',
  styleUrl: './project-art-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectArtLinkComponent {
  readonly project = input.required<Project>();

  /** Where the picture goes: the live site first (in a new tab), else a page on this site. */
  readonly target = computed(() => {
    const p = this.project();
    if (p.liveUrl) return { href: p.liveUrl, route: null };
    if (p.more) return { href: null, route: p.more.route };
    return null;
  });

  /** The words on the picture: the project's own (`artLabel`), else its link's, lowercase. */
  readonly label = computed(() => {
    const p = this.project();
    return (p.artLabel ?? (p.liveUrl ? p.liveLabel ?? 'open' : p.more?.label) ?? '').toLowerCase();
  });
}
