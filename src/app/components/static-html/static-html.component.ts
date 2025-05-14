import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable, of } from 'rxjs';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'static-html',
  templateUrl: './static-html.component.html',
  styleUrl: './static-html.component.scss',
  imports: [AsyncPipe]
})
export class StaticHtmlComponent implements OnChanges {
  @Input() type: string = '';
  @Input() id: string = '';

  prebuiltCollectionMenus: boolean = true;
  staticContent$: Observable<string>;

  constructor(
    private tocService: CollectionTableOfContentsService
  ) {
    this.prebuiltCollectionMenus = config.app?.prebuild?.staticCollectionMenus ?? true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    let inputChanged = false;

    for (const propName in changes) {
      if (changes.hasOwnProperty(propName)) {
        if (
          (
            propName === 'type' &&
            changes.type.previousValue !== changes.type.currentValue
          ) || (
            propName === 'id' &&
            changes.id.previousValue !== changes.id.currentValue
          )
        ) {
          inputChanged = true;
          break;
        }
      }
    }

    if (inputChanged && this.type && this.id) {
      this.staticContent$ = this.getStaticContent();
    }
  }

  private getStaticContent(): Observable<string> {
    // Get the static TOC for the collection if prebuilding of static
    // TOC files is enabled in config and running on the server. In the
    // browser the dynamic TOC is loaded, so no need to first render the
    // static one.
    if (this.type === 'collection-toc' && this.prebuiltCollectionMenus && !isBrowser()) {
      return this.tocService.getStaticTableOfContents(this.id);
    }

    return of('');
  }

}
