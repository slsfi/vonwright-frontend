import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'static-html',
  templateUrl: './static-html.component.html',
  styleUrl: './static-html.component.scss',
  imports: [TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StaticHtmlComponent {
  private tocService = inject(CollectionTableOfContentsService);

  readonly type = input<string>('');
  readonly id = input<string>('');

  readonly prebuiltCollectionMenus: boolean = config.app?.prebuild?.staticCollectionMenus ?? true;

  readonly staticContent = signal<string>('');

  private _effect = effect((onCleanup) => {
    const type = this.type();
    const id = this.id();

    // reset if invalid
    if (!type || !id) {
      this.staticContent.set('');
      return;
    }

    if (type === 'collection-toc' && this.prebuiltCollectionMenus && !isBrowser()) {
      const sub = this.tocService.getStaticTableOfContents(id).subscribe(
        html => this.staticContent.set(html ?? '')
      );

      // Cancels in-flight request on next change AND on component destroy
      onCleanup(() => sub.unsubscribe());
    } else {
      this.staticContent.set('');
    }
  });

}
