import { Pipe, PipeTransform } from '@angular/core';

import { config } from '@config';
import { UrlService } from '@services/url.service';


/**
 * Generates queryParams for a collection page from an
 * ElasticSearch hit item.
 */
@Pipe({
  name: 'elasticHitCollectionPageQueryparams',
  standalone: true
})
export class ElasticHitCollectionPageQueryparamsPipe implements PipeTransform {
  highlightSearchMatches: boolean = true;
  openReadingTextWithCommentsHit: boolean = false;

  constructor(private urlService: UrlService) {
    this.highlightSearchMatches = config.collections?.highlightSearchMatches ?? true;
    this.openReadingTextWithCommentsHit = config.page?.elasticSearch?.openReadingTextWithComments ?? false;
  }

  transform(elasticHit: any): any {
    let text_type = elasticHit?.source?.text_type ?? '';
    const views: any[] = [];
    const unique_matches: string[] = [];
    let page: string | null = null;

    // Add views to query params if est, com, var or ms text type
    if (
      text_type === 'est' ||
      text_type === 'com' ||
      text_type === 'var' ||
      text_type === 'ms'
    ) {
      let type_id = elasticHit?.source?.type_id ?? null;
      if (type_id) {
        type_id = Number(type_id);
      }

      views.push(
        {
          type: (
            text_type === 'est' ? 'readingtext'
            : text_type === 'com' ? 'comments'
            : text_type === 'var' ? 'variants'
            : 'manuscripts'
          ),
          ...(type_id && { id: type_id })
        }
      );

      if (text_type === 'com' && this.openReadingTextWithCommentsHit) {
        views.push(
          {
            type: 'readingtext'
          }
        );
      }
    } else if (text_type === 'pdf') {
      page = elasticHit.source.text_title || null;
    }

    // Add search match strings to query params
    if (
      elasticHit?.highlight?.text_data?.length &&
      this.highlightSearchMatches
    ) {
      const regexp = /<em>.+?<\/em>/g;

      elasticHit.highlight.text_data.forEach((highlight: any) => {
        const matches = highlight.match(regexp);
        matches?.forEach((match: string) => {
          const clean_match = match.replace('<em>', '').replace('</em>', '').toLowerCase();
          if (!unique_matches.includes(clean_match)) {
            unique_matches.push(clean_match);
          }
        });
      });

    }

    // Construct final query params object
    const params: any = {
      page,
      views: views.length ? this.urlService.stringify(views, true) : null,
      q: unique_matches.length ? unique_matches : null
    }

    return params;
  }
}
