import { ChangeDetectionStrategy, Component, input } from '@angular/core';


// This is intentionally an attribute-selector component hosted on <img>, not a
// custom element. The parent template places the thumbnail inside <figure>,
// optionally followed by <figcaption>, so we must keep a direct image child to
// preserve the expected HTML structure. Hosting the component on <img> also
// makes `ngSkipHydration` valid, because it is applied to an Angular component
// host rather than to a plain HTML element.
@Component({
  selector: 'img[gallery-thumb-image]',
  template: '',
  styleUrls: ['./gallery-thumb-image.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    ngSkipHydration: 'true',
    loading: 'lazy',
    '[attr.src]': 'src()',
    '[attr.alt]': 'alt()',
  },
})
export class GalleryThumbImageComponent {
  readonly alt = input('');
  readonly src = input.required<string>();
}
