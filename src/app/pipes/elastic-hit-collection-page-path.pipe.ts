import { Pipe, PipeTransform } from '@angular/core';


/**
 * Generates a routerLink path for a collection page from an
 * ElasticSearch hit item.
 */
@Pipe({
  name: 'elasticHitCollectionPagePath',
  standalone: true
})
export class ElasticHitCollectionPagePathPipe implements PipeTransform {
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
      path = `/collection/${elasticHit.source.collection_id}/text/${elasticHit.source.publication_id}`;
    }

    return path;
  }
}
