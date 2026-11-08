import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SKILL_ORDER } from '../../../shared/constants/osrs-stats.const';
import { skillIconUrl } from '../osrs-stats/osrs-format';

/** The OSRS tile's art: my character, standing in front of a faint wall of every skill's icon. */
@Component({
  selector: 'app-osrs-art',
  template: `
    <span class="wall" aria-hidden="true">
      @for (icon of icons; track icon) {
        <img [src]="icon" alt="" width="25" height="25" decoding="async" />
      }
    </span>
    <img class="character" src="/osrs-character.webp" alt="" width="171" height="329" decoding="async" />
  `,
  styleUrl: './osrs-art.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsrsArtComponent {
  readonly icons = SKILL_ORDER.map(skill => `/${skillIconUrl(skill)}`);
}
