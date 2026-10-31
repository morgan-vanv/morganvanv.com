import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { Project } from '../constants/projects.const';
import { ProjectArtLinkComponent } from '../project-art-link/project-art-link.component';
import { ProjectRibbonComponent } from '../project-ribbon/project-ribbon.component';
import { GitHubService } from '../services/github.service';
import { relativeTime } from '../services/relative-time';

/**
 * A project as a poster on the Projects page: the art on top with a status in its corner, a bevelled
 * title plate in the 88×31 language sitting on the art's bottom edge, then what it is, the stack, the
 * links and when it was last pushed to (live from GitHub). One surface per project (pillar 9): the art
 * is a real screenshot, a chat log drawn in CSS, or a miniature of this site.
 */
@Component({
  selector: 'app-project-poster',
  imports: [RouterLink, ProjectArtLinkComponent, ProjectRibbonComponent],
  templateUrl: './project-poster.component.html',
  styleUrl: './project-poster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPosterComponent {
  readonly project = input.required<Project>();

  private readonly github = inject(GitHubService);

  /** The art, narrowed by kind so the template can read its fields. */
  readonly image = computed(() => { const art = this.project().art; return art.kind === 'image' ? art : null; });
  readonly chat = computed(() => { const art = this.project().art; return art.kind === 'chat' ? art : null; });
  readonly site = computed(() => { const art = this.project().art; return art.kind === 'site' ? art : null; });

  /** The GitHub link, for a project with a repo. */
  readonly sourceUrl = computed(() => {
    const repo = this.project().repo;
    return repo ? `https://github.com/${repo.owner}/${repo.name}` : null;
  });

  /** "updated 3 hours ago", or '' until GitHub answers (or if it doesn't, or there's no repo to ask about). */
  readonly updated = toSignal(
    toObservable(this.project).pipe(
      switchMap(p => p.repo ? this.github.getRepo(p.repo.owner, p.repo.name).pipe(
        map(repo => relativeTime(Date.parse(repo.pushed_at))),
        catchError(() => of('')),
      ) : of('')),
    ),
    { initialValue: '' },
  );
}
