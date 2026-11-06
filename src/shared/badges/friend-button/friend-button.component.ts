import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Friend } from '../../constants/friends.const';

/**
 * A friend's real 88×31, linking to their site: the image itself, at the same 1.5× as the drawn
 * badges beside it (pixelated, so it stays crisp), with the badges' gold border on hover/focus.
 * Not an `app-badge`: the face is theirs, not ours, so there's no glyph cell and no popover.
 */
@Component({
  selector: 'app-friend-button',
  templateUrl: './friend-button.component.html',
  styleUrl: './friend-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendButtonComponent {
  readonly friend = input.required<Friend>();

  protected readonly label = computed(() => {
    const { name, domain } = this.friend();
    return `${name}, ${domain}: a friend's site. Opens in a new tab.`;
  });
}
