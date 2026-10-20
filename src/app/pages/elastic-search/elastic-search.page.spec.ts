import type { MockedObject } from 'vitest';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';

import { ElasticSearchService } from '@services/elastic-search.service';
import { MarkdownService } from '@services/markdown.service';
import { PlatformService } from '@services/platform.service';
import { UrlService } from '@services/url.service';
import { ElasticSearchPage } from './elastic-search.page';

describe('ElasticSearchPage', () => {
  let initialAggregations$: Subject<any>;
  let queryParams$: BehaviorSubject<Params>;
  let searchAggregations$: Subject<any>;
  let searchHits$: Subject<any>;
  let elasticSearchService: MockedObject<Pick<
    ElasticSearchService,
    'executeAggregationQuery'
    | 'executeSearchQuery'
    | 'getAggregationKeys'
    | 'isDateHistogramAggregation'
  >>;
  let router: MockedObject<Pick<Router, 'navigate'>>;
  let urlService: MockedObject<Pick<UrlService, 'parse' | 'stringify'>>;

  const initialAggregationResponse = {
    aggregations: {
      Years: { buckets: [{ key: 1900, key_as_string: '1900', doc_count: 2 }] },
      Type: { buckets: [{ key: 'est', doc_count: 2 }] }
    }
  };

  beforeEach(async () => {
    initialAggregations$ = new Subject<any>();
    queryParams$ = new BehaviorSubject<Params>({ query: 'motiv' });
    searchAggregations$ = new Subject<any>();
    searchHits$ = new Subject<any>();
    elasticSearchService = {
      executeAggregationQuery: vi.fn().mockName('ElasticSearchService.executeAggregationQuery'),
      executeSearchQuery: vi.fn().mockName('ElasticSearchService.executeSearchQuery'),
      getAggregationKeys: vi.fn().mockName('ElasticSearchService.getAggregationKeys'),
      isDateHistogramAggregation: vi.fn().mockName('ElasticSearchService.isDateHistogramAggregation')
    };
    elasticSearchService.executeAggregationQuery
      .mockReset()
      .mockReturnValueOnce(initialAggregations$)
      .mockReturnValueOnce(searchAggregations$);
    elasticSearchService.executeSearchQuery.mockReturnValue(searchHits$);
    elasticSearchService.getAggregationKeys.mockReturnValue(['Years', 'Type']);
    elasticSearchService.isDateHistogramAggregation.mockImplementation(key => key === 'Years');
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);
    urlService = {
      parse: vi.fn().mockName('UrlService.parse'),
      stringify: vi.fn().mockName('UrlService.stringify')
    };
    urlService.parse.mockReturnValue([]);
    urlService.stringify.mockReturnValue('encoded-filters');

    await TestBed.configureTestingModule({
      imports: [ElasticSearchPage],
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$,
            snapshot: { queryParams: { query: 'motiv' } }
          }
        },
        { provide: ElasticSearchService, useValue: elasticSearchService },
        {
          provide: MarkdownService,
          useValue: { getParsedMdContent: () => of('<p>Search information</p>') }
        },
        { provide: PlatformService, useValue: { isMobile: () => false } },
        { provide: Router, useValue: router },
        { provide: UrlService, useValue: urlService }
      ]
    })
      .overrideTemplate(
        ElasticSearchPage,
        `
          @let elasticError = this.elasticError();
          @let filterLoadingError = this.filterLoadingError();
          @let hits = this.hits();
          @let initializing = this.initializing();
          @let loading = this.loading();
          @let loadingMoreHits = this.loadingMoreHits();
          @let query = this.query();
          @let total = this.total();
          <div class="search-result-column"></div>
          <span class="query">{{ query }}</span>
          <span class="status">{{ initializing }}|{{ loading }}|{{ loadingMoreHits }}</span>
          <span class="errors">{{ filterLoadingError }}|{{ elasticError }}</span>
          <span class="results">{{ total }}|{{ hits.length }}|{{ hits[0]?.source?.text_title }}</span>
        `
      )
      .compileComponents();
  });

  it('renders asynchronous initialization and search results without manual change detection', async () => {
    const fixture = TestBed.createComponent(ElasticSearchPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status').textContent).toContain('true|true');

    initialAggregations$.next(initialAggregationResponse);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.query').textContent).toContain('motiv');
    expect(fixture.nativeElement.querySelector('.status').textContent).toContain('false|true');

    searchHits$.next({
      hits: {
        total: { value: 1 },
        hits: [{
          _id: 'hit-1',
          _source: { text_type: 'est', text_title: 'Ett motiv' },
          highlight: { text_data: ['motiv'] }
        }]
      }
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status').textContent).toContain('false|false|false');
    expect(fixture.nativeElement.querySelector('.results').textContent).toContain('1|1|Ett motiv');

    searchAggregations$.next(initialAggregationResponse);
    await fixture.whenStable();
    expect(fixture.componentInstance.disableFilterCheckboxes()).toBe(false);
  });

  it('renders the initial-filter error state', async () => {
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    const fixture = TestBed.createComponent(ElasticSearchPage);
    fixture.detectChanges();

    initialAggregations$.error(new Error('aggregation failed'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.status').textContent).toContain('false|false|false');
    expect(fixture.nativeElement.querySelector('.errors').textContent).toContain('true|false');
    expect(fixture.nativeElement.querySelector('.results').textContent).toContain('0|0');
  });

  it('applies query-parameter filters, range, sorting, and pagination', async () => {
    const secondSearchHits$ = new Subject<any>();
    const secondSearchAggregations$ = new Subject<any>();
    elasticSearchService.executeSearchQuery
      .mockReset()
      .mockReturnValueOnce(searchHits$)
      .mockReturnValueOnce(secondSearchHits$);
    elasticSearchService.executeAggregationQuery
      .mockReset()
      .mockReturnValueOnce(initialAggregations$)
      .mockReturnValueOnce(searchAggregations$)
      .mockReturnValueOnce(secondSearchAggregations$);
    urlService.parse.mockReturnValue([{ name: 'Type', keys: ['est'] }]);

    const fixture = TestBed.createComponent(ElasticSearchPage);
    fixture.detectChanges();
    initialAggregations$.next(initialAggregationResponse);
    await fixture.whenStable();

    queryParams$.next({
      query: 'motiv',
      filters: 'type-filter',
      from: '1900',
      to: '1910',
      sort: 'orig_date_sort.asc',
      pages: '2'
    });
    await fixture.whenStable();

    expect(fixture.componentInstance.activeFilters()).toEqual([{ name: 'Type', keys: ['est'] }]);
    expect(fixture.componentInstance.rangeYears()).toEqual({ from: '1900', to: '1910' });
    expect(fixture.componentInstance.sort()).toBe('orig_date_sort.asc');
    expect(fixture.componentInstance.pages()).toBe(2);
    expect(vi.mocked(elasticSearchService.executeSearchQuery).mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        from: 0,
        size: fixture.componentInstance.hitsPerPage * 2,
        range: { from: '1900-01-01', to: '1911-01-01' },
        sort: [{ orig_date_sort: 'asc' }]
      })
    );

    secondSearchHits$.next({ hits: { total: { value: 40 }, hits: [] } });
    await fixture.whenStable();
    expect(fixture.componentInstance.from()).toBe(fixture.componentInstance.hitsPerPage);

    fixture.componentInstance.loadMore();
    expect(fixture.componentInstance.loadingMoreHits()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { pages: 3 },
      replaceUrl: true
    }));
  });
});
