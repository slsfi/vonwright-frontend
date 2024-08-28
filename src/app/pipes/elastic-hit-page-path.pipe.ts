import { Pipe, PipeTransform } from '@angular/core';

import { config } from '@config';


/**
 * Generates a routerLink path for a collection page from an
 * ElasticSearch hit item.
 */
@Pipe({
  name: 'elasticHitPagePath',
  standalone: true
})
export class ElasticHitPagePathPipe implements PipeTransform {
  ebooks: any[] = [];

  constructor() {
    this.ebooks = config.ebooks ?? [];
  }

  transform(elasticHit: any): string {
    let path = '/';

    if (elasticHit.source.text_type === 'tit') {
      path = `/collection/${elasticHit.source.collection_id}/title`;
    } else if (elasticHit.source.text_type === 'fore') {
      path = `/collection/${elasticHit.source.collection_id}/foreword`;
    } else if (elasticHit.source.text_type === 'inl') {
      path = `/collection/${elasticHit.source.collection_id}/introduction`;
    } else if (
      elasticHit.source.text_type === 'est' ||
      elasticHit.source.text_type === 'com' ||
      elasticHit.source.text_type === 'var' ||
      elasticHit.source.text_type === 'ms'
    ) {
      path = `/collection/${elasticHit.source.collection_id}`
            + `/text/${elasticHit.source.publication_id}`;
    } else if (elasticHit.source.text_type === 'pdf') {
      const ebook = this.ebooks.find(
        (e: any) => String(e.collectionId) === String(elasticHit.source.collection_id)
      );

      if (ebook?.filename) {
        path = `/ebook/${ebook.filename}`;
      }
    }

    return path;
  }
}
