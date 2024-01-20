import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Inject, LOCALE_ID, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { catchError, map, merge, Observable, of, Subject, Subscription, switchMap } from 'rxjs';

import { config } from '@config';
import { AggregationData, AggregationsData, Facet, Facets, TimeRange } from '@models/elastic-search.model';
import { ElasticSearchService } from '@services/elastic-search.service';
import { MarkdownContentService } from '@services/markdown-content.service';
import { PlatformService } from '@services/platform.service';
import { UrlService } from '@services/url.service';
import { isBrowser, isEmptyObject, sortArrayOfObjectsNumerically } from '@utility-functions';


@Component({
  selector: 'page-elastic-search',
  templateUrl: './elastic-search.page.html',
  styleUrls: ['./elastic-search.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ElasticSearchPage implements OnDestroy, OnInit {
  @ViewChild(IonContent) content: IonContent;
  
  activeFilters: any[] = [];
  aggregations: object = {};
  dateHistogramData: any = undefined;
  disableFilterCheckboxes: boolean = true;
  elasticError: boolean = false;
  enableFilters: boolean = true;
  enableSortOptions: boolean = true;
  filterGroups: any[] = [];
  filtersVisible: boolean = true;
  from: number = 0;
  hits: any = [];
  hitsPerPage: number = 10;
  initializing: boolean = true;
  loading: boolean = true;
  loadingMoreHits: boolean = false;
  mdContent$: Observable<SafeHtml>;
  pages: number = 1;
  query: string = ''; // variable bound to the input search field with ngModel
  range?: TimeRange | null = undefined;
  rangeYears?: Record<string, any> = undefined;
  routeQueryParamsSubscription: Subscription | null = null;
  searchDataSubscription: Subscription | null = null;
  searchResultsColumnMinHeight: string | null = null;
  searchTrigger$ = new Subject<boolean>();
  showAllFor: any = {};
  sort: string = '';
  sortSelectOptions: Record<string, any> = {};
  submittedQuery: string = '';
  textHighlightFragmentSize: number = 150;
  textHighlightType: string = 'fvh';
  textTitleHighlightType: string = 'fvh';
  total: number = -1;

  constructor(
    private cf: ChangeDetectorRef,
    private elasticService: ElasticSearchService,
    private elementRef: ElementRef,
    private mdContentService: MarkdownContentService,
    private platformService: PlatformService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private urlService: UrlService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.enableFilters = config.page?.elasticSearch?.enableFilters ?? true;
    this.enableSortOptions = config.page?.elasticSearch?.enableSortOptions ?? true;
    this.hitsPerPage = config.page?.elasticSearch?.hitsPerPage ?? 20;
    this.textHighlightFragmentSize = config.page?.elasticSearch?.textHighlightFragmentSize ?? 150;
    this.textHighlightType = config.page?.elasticSearch?.textHighlightType ?? 'fvh';
    this.textTitleHighlightType = config.page?.elasticSearch?.textTitleHighlightType ?? 'fvh';

    this.filtersVisible = this.platformService.isMobile() ? false : true;
    
    if (
      this.textTitleHighlightType !== 'fvh' &&
      this.textTitleHighlightType !== 'unified' &&
      this.textTitleHighlightType !== 'plain'
    ) {
      this.textTitleHighlightType = 'unified';
    }
    if (
      this.textHighlightType !== 'fvh' &&
      this.textHighlightType !== 'unified' &&
      this.textHighlightType !== 'plain'
    ) {
      this.textHighlightType = 'unified';
    }

    this.sortSelectOptions = {
      header: $localize`:@@ElasticSearch.SortBy:Sortera enligt`,
      cssClass: 'custom-select-alert'
    };
  }

  ngOnInit() {
    this.mdContent$ = this.getMdContent(this.activeLocale + '-12-01');

    // Set up search data stream subscriptions
    this.subscribeToSearchDataStreams();

    // Get initial aggregations
    this.getInitialAggregations().subscribe(
      (filters: any) => {
        // Populate initial filters with initial aggregations data
        this.filterGroups = filters;

        for (let g = 0; g < this.filterGroups.length; g++) {
          if (this.filterGroups[g].name === 'Years') {
            this.dateHistogramData = this.filterGroups[g].filters;
            break;
          }
        }

        this.disableFilterCheckboxes = false;
        this.loading = false;
        this.cf.detectChanges();

        // Set up URL query params subscriptions in order to trigger new searches
        this.subscribeToQueryParams();
      }
    );
  }

  ngOnDestroy() {
    this.routeQueryParamsSubscription?.unsubscribe();
    this.searchDataSubscription?.unsubscribe();
    this.searchTrigger$?.unsubscribe();
  }

  /**
   * Subscribe to search data streams from Elasticsearch:
   * 1. search hits
   * 2. aggregations data
   * Aggregations data is not fetched when we are only loading
   * more search hits using the same search parameters. Otherwise
   * search hits and aggregations are fetched in parallell.
   * The switchMap on searchTrigger$ takes care that when a new
   * search is initiated while the previous search is still
   * processing, the previous search gets cancelled.
   */
  private subscribeToSearchDataStreams() {
    this.searchDataSubscription = this.searchTrigger$.pipe(
      switchMap(() => {
        const searchQuery$: Observable<any> = 
              !(this.submittedQuery || this.range || this.activeFilters.length)
              ? of({ hits: { total: { value: -1 } } })
              : this.elasticService.executeSearchQuery({
                  queries: [this.query],
                  highlight: {
                    fields: {
                      'text_data': {
                        number_of_fragments: 1000,
                        fragment_size: this.textHighlightFragmentSize,
                        type: this.textHighlightType
                      },
                      'text_title': {
                        number_of_fragments: 0,
                        type: this.textTitleHighlightType
                      },
                    },
                  },
                  from: this.from,
                  size: (this.from < 1 && this.pages > 1) ? this.pages * this.hitsPerPage : this.hitsPerPage,
                  facetGroups: this.filterGroups,
                  range: this.range,
                  sort: this.parseSortForQuery(),
                });

        if (this.from < 1) {
          // Get aggregations only if NOT loading more hits
          const aggregationsQuery$: Observable<any> = this.elasticService.executeAggregationQuery({
            queries: [this.query],
            facetGroups: this.filterGroups,
            range: this.range,
          });

          return merge(searchQuery$, aggregationsQuery$);
        } else {
          return searchQuery$;
        }
      })
    ).subscribe({
      next: (data: any) => {
        // console.log('data:', data);
        if (data?.aggregations) {
          this.updateFilters(data.aggregations);
          this.disableFilterCheckboxes = false;
          this.cf.detectChanges();
        } else {
          if (data?.hits === undefined) {
            console.error('Elastic search error, no hits: ', data);
            this.from = 0;
            this.pages = 1;
            this.total = 0;
            this.elasticError = true;
          } else if (data.hits?.total?.value > -1) {
            this.total = data.hits.total.value;
    
            // Append new hits to this.hits array.
            Array.prototype.push.apply(this.hits, data.hits.hits.map((hit: any) => ({
              type: hit._source.text_type,
              source: hit._source,
              highlight: hit.highlight,
              id: hit._id
            })));
    
            if (this.from < 1 && this.pages > 1) {
              this.from = (this.pages - 1) * this.hitsPerPage;
            }
          }
    
          this.loading = false;
          this.loadingMoreHits = false;
          this.cf.detectChanges();
        }
      },
      error: (e: any) => {
        console.error('Elastic search error: ', e);
        this.from = 0;
        this.pages = 1;
        this.total = 0;
        this.elasticError = true;
        this.loading = false;
        this.loadingMoreHits = false;
        this.disableFilterCheckboxes = false;
        this.cf.detectChanges();
      }
    });
  }

  /**
   * Subscribe to queryParams, all searches are triggered through them.
   */
  private subscribeToQueryParams() {
    this.routeQueryParamsSubscription = this.route.queryParams.subscribe(
      (queryParams: any) => {
        let triggerSearch = false;
        let directSearch = false;

        // Text query
        if (queryParams['query']) {
          if (queryParams['query'] !== this.submittedQuery) {
            this.query = queryParams['query'];
            triggerSearch = true;
          }
        }

        // Filters
        if (queryParams['filters']) {
          const parsedActiveFilters = this.urlService.parse(queryParams['filters'], true);
          if (this.activeFiltersChanged(parsedActiveFilters)) {
            this.selectFiltersFromActiveFilters(parsedActiveFilters);
            this.activeFilters = parsedActiveFilters;
            triggerSearch = true;
          }
        } else if (this.activeFilters.length) {
          // Active filters should be cleared
          this.clearAllActiveFilters();
          triggerSearch = true;
        }

        // Time range
        if (queryParams['from'] && queryParams['to']) {
          let range = {
            from: queryParams['from'],
            to: queryParams['to']
          };
          if (
            range.from !== this.rangeYears?.from ||
            range.to !== this.rangeYears?.to
          ) {
            this.rangeYears = range;
            this.range = {
              from: new Date(range.from || '').getTime(),
              to: new Date(`${parseInt(range.to || '') + 1}`).getTime()
            }
            triggerSearch = true;
          }
        } else if (this.range?.from && this.range?.to) {
          this.range = null;
          this.rangeYears = undefined;
          triggerSearch = true;
        }

        // Sort order
        if (queryParams['sort']) {
          let compareOrder = queryParams['sort'];
          if (queryParams['sort'] === 'relevance') {
            compareOrder = '';
          }
          if (compareOrder !== this.sort) {
            this.sort = compareOrder;
            triggerSearch = true;
          }
        }

        // Number of pages with hits
        if (queryParams['pages']) {
          if (Number(queryParams['pages']) !== this.pages) {
            if (this.from < 1) {
              this.hits = [];
              this.from = 0;
              this.total = -1;
            } else {
              this.loadingMoreHits = true;
            }
            this.pages = Number(queryParams['pages']) || 1;
            directSearch = true;
            triggerSearch = true;
          }
        }

        // Trigger new search if the search input field has been cleared, i.e. no "query" parameter
        if (
          !triggerSearch &&
          !queryParams['query'] &&
          this.submittedQuery &&
          !this.initializing
        ) {
          triggerSearch = true;
        }

        // Clear all search parameters and trigger new search if no
        // query params and not initializing page
        if (
          isEmptyObject(queryParams) &&
          !this.initializing
        ) {
          this.query = '';
          this.activeFilters = [];
          this.range = null;
          this.rangeYears = undefined;
          this.sort = '';
          triggerSearch = true;
        }

        this.initializing = false;

        // Execute new search if trigger criteria have been met
        if (triggerSearch) {
          if (directSearch) {
            this.search();
          } else {
            this.resetAndSearch();
          }
        }
      }
    );
  }

  /**
   * Trigger a new, clean search.
   */
  private resetAndSearch() {
    this.disableFilterCheckboxes = true;
    this.reset();
    this.search();
  }

  /**
   * Trigger an immediate search with current parameters. Called directly only
   * to load more search results.
   */
  private search() {
    this.setSearchColumnMinHeight();
    this.elasticError = false;
    this.loading = true;
    this.cf.detectChanges();
    this.submittedQuery = this.query;
    this.searchTrigger$.next(true);
  };

  /**
   * Reset search results.
   */
  private reset() {
    this.hits = [];
    this.from = 0;
    this.total = -1;
    this.pages = 1;
  }

  private updateURLQueryParameters(params: any) {
    if (!params.pages) {
      params.pages = null;
    }

    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: params,
        queryParamsHandling: 'merge',
        replaceUrl: true
      }
    );
  }

  submitSearchQuery() {
    this.updateURLQueryParameters({ query: this.query || null });
  }

  clearSearchQuery() {
    this.query = '';
    this.updateURLQueryParameters({ query: null });
  }

  clearAllActiveFiltersAndTimeRange() {
    this.updateURLQueryParameters({ filters: null, from: null, to: null });
  }

  /**
   * Trigger a new search with selected years.
   */
  onTimeRangeChange(newRange: { from: string | null, to: string | null } | null) {
    let triggerSearch = false;
    let range = null;
    if (newRange?.from && newRange?.to) {
      // Certain date range
      range = newRange;
      triggerSearch = true;  
    } else if (!newRange?.from && !newRange?.to) {
      // All time
      triggerSearch = true;
    }

    if (triggerSearch) {
      this.updateURLQueryParameters(
        {
          from: range?.from ? range.from : null,
          to: range?.to ? range.to : null
        }
      );
    }
  }

  /**
   * Trigger new search with changed sorting.
   */
  onSortByChanged(event: any) {
    this.updateURLQueryParameters({ sort: event?.detail?.value || 'relevance' });
  }

  /**
   * Loads more results with current search parameters.
   */
  loadMore() {
    this.loadingMoreHits = true;
    this.from += this.hitsPerPage;

    this.updateURLQueryParameters({ pages: this.pages + 1 });
  }

  private getMdContent(fileID: string): Observable<SafeHtml> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        return this.sanitizer.bypassSecurityTrustHtml(
          this.mdContentService.getParsedMd(res.content)
        );
      }),
      catchError((e) => {
        return of('');
      })
    );
  }

  private getInitialAggregations(): Observable<any> {
    return this.elasticService.executeAggregationQuery({
      queries: [],
      facetGroups: {},
      range: undefined,
    }).pipe(
      map((data: any) => {
        return this.getInitialFilters(data.aggregations);
      })
    );
  }

  private parseSortForQuery() {
    if (!this.sort) {
      return;
    }

    const [key, direction] = this.sort.split('.');
    return [{ [key]: direction }];
  }

  canShowHits() {
    return (!this.loading || this.loadingMoreHits) && (this.submittedQuery || this.range || this.activeFilters.length);
  }

  toggleFilter(filterGroupKey: string, filter: Facet) {
    // Get updated list of active filters
    const newActiveFilters = this.getNewActiveFilters(filterGroupKey, filter);

    // Update URL query params so a new search is triggered
    this.updateURLQueryParameters(
      {
        filters: newActiveFilters.length ? this.urlService.stringify(newActiveFilters, true) : null
      }
    );
  }

  unselectFilter(filterGroupKey: string, filterKey: string) {
    // Mark the filter as unselected
    for (let g = 0; g < this.filterGroups.length; g++) {
      if (this.filterGroups[g].name === filterGroupKey) {
        for (let f = 0; f < this.filterGroups[g].filters.length; f++) {
          if (String(this.filterGroups[g].filters[f].key) === filterKey) {
            this.filterGroups[g].filters[f].selected = false;
            break;
          }
        }
        break;
      }
    }

    this.toggleFilter(filterGroupKey, { key: filterKey, selected: false, doc_count: 0 });
  }

  private getNewActiveFilters(filterGroupKey: string, updatedFilter: Facet) {
    const newActiveFilters: any[] = [];
    let filterGroupActive: boolean = false;

    for (let a = 0; a < this.activeFilters.length; a++) {
      // Copy current active filters to new array
      newActiveFilters.push(
        {
          name: this.activeFilters[a].name,
          keys: [...this.activeFilters[a].keys]
        }
      );

      if (this.activeFilters[a].name === filterGroupKey) {
        filterGroupActive = true;

        if (updatedFilter.selected) {
          // Add filter to already active filter group
          newActiveFilters[newActiveFilters.length - 1].keys.push(updatedFilter.key);
        } else {
          // Remove filter from already active filter group
          for (let f = 0; f < newActiveFilters[newActiveFilters.length - 1].keys.length; f++) {
            if (newActiveFilters[newActiveFilters.length - 1].keys[f] === updatedFilter.key) {
              newActiveFilters[newActiveFilters.length - 1].keys.splice(f, 1);
              break;
            }
          }
          if (newActiveFilters[newActiveFilters.length - 1].keys.length < 1) {
            // Remove filter group from active filters
            // since there are no active filters from the group
            newActiveFilters.splice(-1, 1);
          }
        }
      }
    }

    if (!filterGroupActive && updatedFilter.selected) {
      // Add filter group and filter to active filters
      newActiveFilters.push(
        {
          name: filterGroupKey,
          keys: [updatedFilter.key]
        }
      );
    }

    return newActiveFilters;
  }

  /**
   * Loops through the array with all filter groups and marks the filters
   * in activeFilters as selected.
   * @param activeFilters Array of active filter objects which should be
   * applied to all filters.
   */
  private selectFiltersFromActiveFilters(activeFilters: any[]) {
    for (let a = 0; a < activeFilters.length; a++) {
      for (let g = 0; g < this.filterGroups.length; g++) {
        if (activeFilters[a].name === this.filterGroups[g].name) {
          for (let i = 0; i < activeFilters[a].keys.length; i++) {
            for (let f = 0; f < this.filterGroups[g].filters.length; f++) {
              if (this.filterGroups[g].filters[f].key === activeFilters[a].keys[i]) {
                this.filterGroups[g].filters[f].selected = true;
                break;
              }
            }
          }
          break;
        }
      }
    }
  }

  /**
   * Checks if the given array of active filter objects is non-identical to this.activeFilters.
   * @param compareActiveFilters Array of active filter objects to compare upon.
   * @returns True if the given filters array differs from this.activeFilters
   */
  private activeFiltersChanged(compareActiveFilters: any[]): boolean {
    if (compareActiveFilters.length !== this.activeFilters.length) {
      return true;
    } else {
      for (let a = 0; a < this.activeFilters.length; a++) {
        let groupFound = false;
        for (let c = 0; c < compareActiveFilters.length; c++) {
          if (this.activeFilters[a].name === compareActiveFilters[c].name) {
            groupFound = true;

            if (this.activeFilters[a].keys.length !== compareActiveFilters[c].keys.length) {
              return true;
            }

            for (let k = 0; k < this.activeFilters[a].keys.length; k++) {
              if (!compareActiveFilters[c].keys.includes(this.activeFilters[a].keys[k])) {
                return true;
              }
            }
            break;
          }
        }

        if (!groupFound) {
          return true;
        }
      }
    }

    return false;
  }

  private clearAllActiveFilters() {
    this.activeFilters = [];
    for (let g = 0; g < this.filterGroups.length; g++) {
      for (let f = 0; f < this.filterGroups[g].filters.length; f++) {
        this.filterGroups[g].filters[f].selected = false;
      }
    }
  }

  /**
   * Updates filter data using the search result's aggregation data.
   */
  private updateFilters(aggregations: AggregationsData) {
    // Get aggregation keys that are ordered in config.json.
    this.elasticService.getAggregationKeys().forEach((filterGroupKey: any) => {
      const newFilterGroup = this.convertAggregationsToFilters(aggregations[filterGroupKey]);
      let filterGroupExists = false;
      for (let g = 0; g < this.filterGroups.length; g++) {
        if (this.filterGroups[g].name === filterGroupKey) {
          filterGroupExists = true;

          if (
            config.page?.elasticSearch?.aggregations?.[filterGroupKey]?.terms &&
            !config.page?.elasticSearch?.aggregations?.[filterGroupKey]?.terms?.order
          ) {
            // Aggregations are ordered desc according to doc_count -->
            // Empty filters should be removed if not selected, so replace filters in the group
            const filtersArray = this.convertFilterGroupToArray(filterGroupKey, newFilterGroup);

            // Retain selected status of filters, i.e. search for all selected filters
            // in the matching filterGroup and apply selected to the new filters.
            // If a selected filter is missing from the new filters, add it to them with
            // a zero doc_count
            for (let f = 0; f < this.filterGroups[g].filters.length; f++) {
              if (this.filterGroups[g].filters[f].selected) {
                let found = false;
                for (let w = 0; w < filtersArray.length; w++) {
                  if (this.filterGroups[g].filters[f].key === filtersArray[w].key) {
                    filtersArray[w].selected = true;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  filtersArray.push({
                    key: this.filterGroups[g].filters[f].key,
                    doc_count: 0,
                    selected: true
                  });
                }
              }
            }

            this.filterGroups[g].filters = filtersArray;
          } else {
            // Aggregations are ordered according to key name -->
            // Empty filters should be retained with zero count
            for (let f = 0; f < this.filterGroups[g].filters.length; f++) {
              const updatedFilter = newFilterGroup[this.filterGroups[g].filters[f].key];
              if (updatedFilter) {
                this.filterGroups[g].filters[f].doc_count = updatedFilter.doc_count;
              } else {
                this.filterGroups[g].filters[f].doc_count = 0;
              }
            }
          }

          // Ensure that all active filters are still selected
          this.selectFiltersFromActiveFilters(this.activeFilters);

          // The reference of date histogram filter arrays needs to be changed in order
          // for change detection to be triggered in the <date-histogram> component
          // when the input changes. This shallow copy action using the spread operator
          // accomplishes this.
          if (config.page?.elasticSearch?.aggregations?.[filterGroupKey]?.date_histogram) {
            this.filterGroups[g].filters = [...this.filterGroups[g].filters];
          }

          break;
        }
      }

      if (!filterGroupExists) {
        this.filterGroups.push(
          {
            name: filterGroupKey,
            filters: this.convertFilterGroupToArray(filterGroupKey, newFilterGroup),
            open: config.page?.elasticSearch?.filterGroupsOpenByDefault?.includes(filterGroupKey) ? true : false,
            type: this.elasticService.isDateHistogramAggregation(filterGroupKey) ? 'date_histogram' : 'terms'
          }
        );
      }
    });
  }

  private getInitialFilters(aggregations: AggregationsData) {
    // Get aggregation keys that are ordered in config.json.
    const filterGroups: any[] = [];
    this.elasticService.getAggregationKeys().forEach((filterGroupKey: any) => {
      const filterGroupObj = this.convertAggregationsToFilters(aggregations[filterGroupKey]);

      filterGroups.push(
        {
          name: filterGroupKey,
          filters: this.convertFilterGroupToArray(filterGroupKey, filterGroupObj),
          open: config.page?.elasticSearch?.filterGroupsOpenByDefault?.includes(filterGroupKey) ? true : false,
          type: this.elasticService.isDateHistogramAggregation(filterGroupKey) ? 'date_histogram' : 'terms'
        }
      );
    });

    return filterGroups;
  }

  /**
   * Convert aggregation data to filters data.
   */
  private convertAggregationsToFilters(aggregation: AggregationData): Facets {
    const filters = {} as any;
    // Get buckets from either unfiltered or filtered aggregation.
    const buckets = aggregation.buckets || aggregation?.filtered?.buckets;

    buckets?.forEach((filter: Facet) => {
      filters[filter.key] = filter;
    });
    return filters;
  }

  private convertFilterGroupToArray(filterGroupKey: string, filterGroupObj: Facets) {
    if (filterGroupObj) {
      if (filterGroupKey !== 'Years') {
        const keys = [];
        const filtersAsArray = [];
        for (const key in filterGroupObj) {
          if (filterGroupObj.hasOwnProperty(key)) {
            keys.push(key);
          }
        }
        for (let i = 0; i < keys.length; i++) {
          filtersAsArray.push(filterGroupObj[keys[i]]);
        }
        if (!config.page?.elasticSearch?.aggregations?.[filterGroupKey]?.terms?.order?._key) {
          sortArrayOfObjectsNumerically(filtersAsArray, 'doc_count');
        }
        return filtersAsArray;
      } else {
        return Object.values(filterGroupObj);
      }
    } else {
      return [];
    }
  }

  private getTextName(source: any) {
    return source?.text_title;
  }

  private getHiglightedTextName(highlight: any) {
    if (highlight['text_title']) {
      return highlight['text_title'][0];
    } else {
      return '';
    }
  }

  getPublicationCollectionName(source: any) {
    return source?.publication_data?.[0]?.collection_name;
  }

  // Returns the title from the xml title element in the teiHeader
  private getTitle(source: any) {
    return (source.doc_title || source.name || '').trim();
  }

  private formatISO8601DateToLocale(date: string) {
    return date && new Date(date).toLocaleDateString('fi-FI');
  }

  hasDate(source: any) {
    const dateData = source?.publication_data?.[0]?.original_publication_date ?? source?.orig_date_certain;
    if (!dateData) {
      if (source?.orig_date_year) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }

  getDate(source: any) {
    let date = source?.publication_data?.[0]?.original_publication_date ?? this.formatISO8601DateToLocale(source?.orig_date_certain);
    if (!date && source?.orig_date_year) {
      date = source.orig_date_year;
    }
    return date;
  }

  getHeading(hit: any) {
    /* If a match is found in the publication name, return it from the highlights. Otherwise from the data. */
    let text_name = '';
    if (hit.highlight) {
      text_name = this.getHiglightedTextName(hit.highlight);
    }
    if (!text_name) {
      text_name = this.getTextName(hit.source);
      if (!text_name) {
        text_name = this.getTitle(hit.source);
      }
    }
    return text_name;
  }

  getEllipsisString(str: any, max = 50) {
    if (!str || str.length <= max) {
      return str;
    } else {
      return str.substring(0, max) + '...';
    }
  }

  toggleFilterGroupOpenState(filterGroup: any) {
    filterGroup.open = !filterGroup.open;
  }

  showAllHitHighlights(event: any) {
    // Find and show all hidden highlights
    let parentElem = event.target.parentElement as any;
    while (parentElem !== null && !parentElem.classList.contains('match-highlights')) {
      parentElem = parentElem.parentElement;
    }

    if (parentElem !== null) {
      const highlightElems = parentElem.querySelectorAll('.hidden-highlight');
      for (let i = 0; i < highlightElems.length; i++) {
        highlightElems[i].classList.remove('hidden-highlight');
      }
    }

    // Hide the button that triggered the event
    if (event.target?.classList.contains('show-all-highlights')) {
      event.target.classList.add('hidden-highlight-button');
    }
  }

  toggleFiltersColumn() {
    this.filtersVisible = !this.filtersVisible;
  }

  scrollToTop() {
    if (isBrowser()) {
      const searchBarElem: HTMLElement | null = this.elementRef.nativeElement.querySelector('.search-container');
      if (searchBarElem) {
        const topMenuElem: HTMLElement | null = document.querySelector('top-menu');
        if (topMenuElem) {
          this.content.scrollByPoint(0, searchBarElem.getBoundingClientRect().top - topMenuElem.offsetHeight, 500);
        }
      }
    }
  }

  private setSearchColumnMinHeight() {
    if (isBrowser()) {
      const elem: HTMLElement | null = this.elementRef.nativeElement.querySelector('.search-result-column');
      const elemRect = elem?.getBoundingClientRect();
      this.searchResultsColumnMinHeight = elemRect ? elemRect.bottom - elemRect.top + 'px' : null;
    } else {
      this.searchResultsColumnMinHeight = null;
    }
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  trackByKey(index: number, item: any) {
    return item.key;
  }

  trackByName(index: number, item: any) {
    return item.name;
  }

}
