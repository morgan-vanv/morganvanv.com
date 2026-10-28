import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { Project } from '../constants/projects.const';
import { GitHubService } from '../services/github.service';
import { relativeTime } from '../services/relative-time';

/** A project: screenshot, what it is, links, and when it was last worked on (live from GitHub). */
@Component({
  selector: 'app-project-card',
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCardComponent {
  readonly project = input.required<Project>();

  private readonly github = inject(GitHubService);

  /** The screenshot, when the project has one (the card has no other art). */
  readonly image = computed(() => {
    const art = this.project().art;
    return art.kind === 'image' ? art : null;
  });

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
