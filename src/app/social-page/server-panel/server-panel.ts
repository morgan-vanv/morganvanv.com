import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SITE_CONFIG } from '../../../shared/config/site.config';
import { LabStatusService } from '../../../shared/lab-status/lab-status.service';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import {
  MINECRAFT_EDITIONS, MINECRAFT_MODES, SERVER_ICON_ALT, SERVER_ICON_URL, onlineLine,
} from '../../../shared/minecraft/minecraft';

/**
 * The Server, beside The Discord at the foot of /social (the face-lift canvas, 2026-11-20): Morgan's Minecraft
 * network by its public address with a copy button, how many are on (a count from the status Worker, never a name),
 * the two editions that get in, and the modes. Nothing here waits on a feed: everything but the count is prerendered,
 * and the count's line shows once the Worker has answered. `id="server"` is where the rest of the site links to.
 */
@Component({
  selector: 'app-server-panel',
  imports: [CopyButtonComponent],
  templateUrl: './server-panel.html',
  styleUrl: './server-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerPanelComponent {
  private readonly labStatus = inject(LabStatusService);

  protected readonly address = SITE_CONFIG.minecraftAddress;
  protected readonly icon = SERVER_ICON_URL;
  protected readonly iconAlt = SERVER_ICON_ALT;
  protected readonly editions = MINECRAFT_EDITIONS;
  protected readonly modes = MINECRAFT_MODES;

  /** "3 online" while the server is up and the Worker says so; null before an answer. */
  protected readonly online = () => {
    const count = this.labStatus.minecraftOnline();
    return count === null ? null : onlineLine(count);
  };
  /** Whether the Worker found it down (then the line says so, rather than a count). */
  protected readonly down = () => this.labStatus.stateOf('minecraft') === 'down';
}
