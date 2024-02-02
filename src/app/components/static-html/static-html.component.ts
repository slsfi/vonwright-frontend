import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable, of } from 'rxjs';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';


@Component({
  selector: 'static-html',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './static-html.component.html',
  styleUrl: './static-html.component.scss'
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
    if (this.type === 'collection-toc' && this.prebuiltCollectionMenus) {
      return this.tocService.getStaticTableOfContents(this.id);
    }

    return of('');
  }

}
