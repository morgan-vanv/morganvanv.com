import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The My Photos tile's art while it's under construction: a blank polaroid and the sign. */
@Component({
  selector: 'app-photos-art',
  template: `
    <span class="polaroid" aria-hidden="true"><span></span></span>
    <img class="sign" src="/under-construction.gif" alt="Under construction" width="177" height="175" decoding="async" />
  `,
  styleUrl: './photos-art.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotosArtComponent {}
