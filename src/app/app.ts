import { Component, signal } from '@angular/core';
import {ViewManager} from './view-manager/view-manager';

@Component({
  selector: 'app-root',
  imports: [ViewManager],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('morganvanv.com');
}
