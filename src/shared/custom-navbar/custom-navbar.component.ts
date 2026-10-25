import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, IconName } from '../icon/icon.component';
import { GREETING_ROUTE, MAIN_ROUTES } from '../main-routes';

interface NavLink {
  route: string;
  label?: string;
  icon?: IconName;
  ariaLabel?: string;
  exact?: boolean;
}

/** Greeting link, then every main route in MAIN_ROUTES order. */
export const NAV_LINKS: readonly NavLink[] = [
  { route: GREETING_ROUTE, icon: 'exit', ariaLabel: 'Greeting', exact: true },
  ...MAIN_ROUTES.map(({ path, title }) => ({ route: `/${path}`, label: title })),
];

@Component({
  selector: 'app-custom-navbar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './custom-navbar.component.html',
  styleUrl: './custom-navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomNavbarComponent {
  readonly navLinks = NAV_LINKS;
}
