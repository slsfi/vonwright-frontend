import { LOCALE_ID, inject, Service } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { config } from '@config';
import { CollectionCover } from '@models/collection.models';
import { MarkdownService } from '@services/markdown.service';
import { collectionCovers } from 'src/project/data/collection-covers';


@Service()
export class CollectionCoverService {
  private mdService = inject(MarkdownService);
  private activeLocale = inject(LOCALE_ID);

  private readonly useStaticCoverData: boolean = config.collections?.useStaticCoverData ?? false;

  getCoverData(collectionID: number | string): Observable<Partial<CollectionCover>> {
    if (this.useStaticCoverData) {
      // Missing entries stay local: do not fetch backend data or another locale.
      return of(collectionCovers[collectionID]?.[this.activeLocale] ?? {
        imageAltText: 'Collection cover image',
        imageURL: 'assets/images/collection-cover-placeholder.jpg'
      });
    }

    return this.mdService.getMdContent(`${this.activeLocale}-08-${collectionID}`).pipe(
      map((md: string) => {
        const match = md.match(/!\[(.*?)\]\((.*?)\)/);
        // Leave absent fields undefined so each view retains its existing fallbacks.
        return {
          imageAltText: match?.[1] || undefined,
          imageURL: match?.[2] || undefined
        };
      })
    );
  }
}
