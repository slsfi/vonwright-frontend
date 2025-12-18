import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { config } from '@config';
import { AggregationQuery, Facets, SearchQuery, TimeRange } from '@models/elastic-search.models';


@Injectable({
  providedIn: 'root',
})
export class ElasticSearchService {
  private http = inject(HttpClient);

  private readonly aggregations: any = config.page?.elasticSearch?.aggregations ?? undefined;
  private readonly fixedFilters: object[] = config.page?.elasticSearch?.fixedFilters ?? [];
  private readonly textTypes: string[] = config.page?.elasticSearch?.typeFilterGroupOptions ?? [];

  private searchURL: string = '';
  private source: string[] = [];

  constructor() {
    const apiBaseURL: string = config.app?.backendBaseURL ?? '';
    const projectName: string = config.app?.projectNameDB ?? '';
    const indices: string[] = config.page?.elasticSearch?.indices ?? [];

    this.searchURL = `${apiBaseURL}/${projectName}/search/elastic/${indices.join(',')}`;

    // Add fields that should always be returned in hits
    this.source = [
      'text_type',
      'text_title',
      'text_data',
      'type_id',
      'doc_title',
      'collection_id',
      'publication_id',
      'publication_data',
      'orig_date_year',
      'orig_date_certain',
      'orig_date_sort',
    ];

    // Add additional fields that should be returned in hits from config file
    const configSourceFields = config.page?.elasticSearch?.additionalSourceFields ?? undefined;
    if (configSourceFields?.length > 0) {
      // Append additional fields to this.source if not already present
      for (let i = 0; i < configSourceFields.length; i++) {
        if (!this.source.includes(configSourceFields[i])) {
          this.source.push(configSourceFields[i]);
        }
      }
    }
  }

  /**
   * Returns hits.
   */
  executeSearchQuery(options: any): Observable<any> {
    const payload = this.generateSearchQueryPayload(options);
    return this.http.post(this.searchURL, payload);
  }

  /**
   * Returns aggregations that are used for faceted search.
   */
  executeAggregationQuery(options: any): Observable<any> {
    const payload = this.generateAggregationQueryPayload(options);
    return this.http.post(this.searchURL, payload);
  }

  private generateSearchQueryPayload({
    queries,
    highlight,
    from,
    size,
    range,
    facetGroups,
    sort,
  }: SearchQuery): object {
    const payload: any = {
      from,
      size,
      _source: this.source,
      query: {
        function_score: {
          query: {
            bool: {
              must: [],
            },
          },
          functions: [
            {
              filter: { term: { text_type: 'est' } },
              weight: 10,
            },
            {
              filter: { term: { text_type: 'inl' } },
              weight: 8,
            },
            {
              filter: { term: { text_type: 'com' } },
              weight: 2,
            },
            {
              filter: { term: { text_type: 'ms' } },
              weight: 2,
            },
          ],
          score_mode: 'sum',
        },
      },
      sort,
    };

    // Add free text query. Only matches the text data and publication name.
    queries.forEach((query) => {
      if (query) {
        payload.query.function_score.query.bool.must.push({
          simple_query_string: {
            query,
            fields: ['text_data', 'text_title^5'],
          },
        });
      }
    });

    // Include highlighted text matches to hits if a query is present.
    if (queries.some((query) => !!query)) {
      payload.highlight = highlight;
    }

    // Add date range filter.
    if (range) {
      payload.query.function_score.query.bool.must.push({
        range: {
          orig_date_sort: {
            gte: range.from,
            lt: range.to,
          },
        },
      });
    }

    // Add fixed filters that apply to all queries.
    if (this.fixedFilters) {
      this.fixedFilters.forEach((filter) => {
        payload.query.function_score.query.bool.must.push(filter);
      });
    }

    // Add text type filter that applies to all queries.
    if (
      this.textTypes &&
      Array.isArray(this.textTypes) &&
      this.textTypes.length > 0
    ) {
      payload.query.function_score.query.bool.must.push({
        terms: { text_type: this.textTypes },
      });
    }

    if (facetGroups.length) {
      this.injectFacetsToPayload(payload, facetGroups);
    }

    // console.log('search payload', payload);

    return payload;
  }

  private generateAggregationQueryPayload({
    queries,
    range,
    facetGroups,
  }: AggregationQuery): object {
    const payload: any = {
      from: 0,
      size: 0,
      _source: this.source,
      query: {
        function_score: {
          query: {
            bool: {
              must: [],
            },
          },
          functions: [
            {
              filter: { term: { text_type: 'est' } },
              weight: 6,
            },
            {
              filter: { term: { text_type: 'inl' } },
              weight: 4,
            },
            {
              filter: { term: { text_type: 'com' } },
              weight: 1,
            },
            {
              filter: { term: { text_type: 'ms' } },
              weight: 1,
            },
          ],
          score_mode: 'sum',
        },
      },
    };

    // Add free text query.
    queries.forEach((query) => {
      if (query) {
        payload.query.function_score.query.bool.must.push({
          simple_query_string: {
            query,
            fields: ['text_data', 'text_title^5'],
          },
        });
      }
    });

    // Add fixed filters that apply to all queries.
    if (this.fixedFilters) {
      this.fixedFilters.forEach((filter) => {
        payload.query.function_score.query.bool.must.push(filter);
      });
    }

    // Add text type filter that applies to all queries.
    if (
      this.textTypes &&
      Array.isArray(this.textTypes) &&
      this.textTypes.length > 0
    ) {
      payload.query.function_score.query.bool.must.push({
        terms: { text_type: this.textTypes },
      });
    }

    if (facetGroups || range) {
      this.injectFilteredAggregationsToPayload(payload, facetGroups, range);
    } else {
      this.injectUnfilteredAggregationsToPayload(payload);
    }

    // console.log('aggregation payload', payload);

    return payload;
  }

  private injectFacetsToPayload(payload: any, facetGroups: any[]) {
    facetGroups.forEach(facetGroup => {
      const terms = this.filterSelectedFacetKeys(facetGroup.filters);
      if (terms.length > 0) {
        payload.query.function_score.query.bool.filter =
          payload.query.function_score.query.bool.filter || [];
        if (this.aggregations && facetGroup.name) {
          payload.query.function_score.query.bool.filter.push({
            terms: {
              [this.aggregations[facetGroup.name].terms.field]: terms,
            },
          });
        }
      }
    });
  }

  private filterSelectedFacetKeys(facets: Facets): string[] {
    return Object.values(facets)
      .filter((facet) => facet.selected)
      .map((facet: any) => facet.key);
  }

  private injectUnfilteredAggregationsToPayload(payload: any) {
    payload.aggs = {};
    for (const [key, aggregation] of Object.entries(this.aggregations)) {
      payload.aggs[key] = aggregation;
    }
    return payload;
  }

  /**
   * Inspired by an article that uses an old version of elastic:
   * https://madewithlove.com/faceted-search-using-elasticsearch/
   *
   * Up to date documentation:
   * https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filter-aggregation.html
   */
  private injectFilteredAggregationsToPayload(
    payload: any,
    facetGroups?: any,
    range?: TimeRange
  ) {
    payload.aggs = {};
    for (const [key, aggregation] of Object.entries(this.aggregations)) {
      const filteredAggregation = this.generateFilteredAggregation(
        key,
        aggregation,
        facetGroups,
        range
      );

      // If filtered aggregation doesn't have filters, then use an unfiltered aggregation.
      payload.aggs[key] = filteredAggregation || aggregation;
    }
    return payload;
  }

  private generateFilteredAggregation(
    aggregationKey: string,
    aggregation: any,
    facetGroups?: any,
    range?: TimeRange
  ) {
    const filtered = {
      filter: {
        bool: {
          // Selected facets go here as filters.
          filter: [] as any,
        },
      },
      aggs: {
        // Aggregation goes here.
        filtered: aggregation,
      },
    };

    // Add term filters.
    if (facetGroups.length) {
      facetGroups.forEach((facetGroup: any) => {
        // Don't filter itself.
        if (aggregationKey !== facetGroup.name) {
          const selectedFacetKeys = this.filterSelectedFacetKeys(facetGroup.filters);
          if (selectedFacetKeys.length > 0) {
            filtered.filter.bool.filter.push({
              terms: {
                [this.getAggregationField(facetGroup.name)]: selectedFacetKeys,
              },
            });
          }
        }
      });
    }

    // Add date range filter.
    if (range && !aggregation.date_histogram) {
      filtered.filter.bool.filter.push({
        range: {
          orig_date_sort: {
            gte: range.from,
            lt: range.to,
          },
        },
      });
    }

    if (filtered.filter.bool.filter.length > 0) {
      return filtered;
    } else {
      return null;
    }
  }

  isDateHistogramAggregation(aggregationKey: string): boolean {
    if (this.aggregations[aggregationKey] !== undefined) {
      return !!this.aggregations[aggregationKey]['date_histogram'];
    } else {
      return false;
    }
  }

  getAggregationKeys(): string[] {
    return Object.keys(this.aggregations);
  }

  getAggregationField(key: string): string {
    const agg = this.aggregations[key];
    if (agg.terms || agg.date_histogram) {
      const foo = agg.terms || (agg.date_histogram as any);
      return foo.field;
    }
    return '';
  }

}
