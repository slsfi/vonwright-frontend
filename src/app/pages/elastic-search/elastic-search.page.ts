import { AsyncPipe, NgStyle } from '@angular/common';
import { Component, DestroyRef, ElementRef, LOCALE_ID, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonIcon,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/angular';
import { map, merge, Observable, of, Subject, switchMap } from 'rxjs';

import { DateHistogramComponent } from '@components/date-histogram/date-histogram.component';
import { config } from '@config';
import { AggregationData, AggregationsData, Facet, Facets, TimeRange, YearRange } from '@models/elastic-search.models';
import { CollectionTitlePipe } from '@pipes/collection-title.pipe';
import { ElasticHitPagePathPipe } from '@pipes/elastic-hit-page-path.pipe';
import { ElasticHitQueryparamsPipe } from '@pipes/elastic-hit-queryparams.pipe';
import { LangNamePipe } from '@pipes/lang-name.pipe';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { ElasticSearchService } from '@services/elastic-search.service';
import { MarkdownService } from '@services/markdown.service';
import { PlatformService } from '@services/platform.service';
import { UrlService } from '@services/url.service';
import { isBrowser, isEmptyObject, sortArrayOfObjectsNumerically } from '@utility-functions';


@Component({
  selector: 'page-elastic-search',
  templateUrl: './elastic-search.page.html',
  styleUrls: ['./elastic-search.page.scss'],
  imports: [
    AsyncPipe,
    CollectionTitlePipe,
    DateHistogramComponent,
    ElasticHitPagePathPipe,
    ElasticHitQueryparamsPipe,
    FormsModule,
    IonButton,
    IonCheckbox,
    IonContent,
    IonIcon,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    LangNamePipe,
    NgStyle,
    RouterLink,
    TrustHtmlPipe
  ]
})
export class ElasticSearchPage implements OnInit {
  private destroyRef = inject(DestroyRef);
  private elasticService = inject(ElasticSearchService);
  private elementRef = inject(ElementRef);
  private mdService = inject(MarkdownService);
  private platformService = inject(PlatformService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private urlService = inject(UrlService);
  private activeLocale = inject(LOCALE_ID);

  private queryParamsInitialized = false;
  private lastHandledQueryParams: string | null = null;

  readonly content = viewChild(IonContent);

  readonly enableFilters: boolean = config.page?.elasticSearch?.enableFilters ?? true;
  readonly enableSortOptions: boolean = config.page?.elasticSearch?.enableSortOptions ?? true;
  readonly hitsPerPage: number = config.page?.elasticSearch?.hitsPerPage ?? 20;
  readonly textHighlightFragmentSize: number = config.page?.elasticSearch?.textHighlightFragmentSize ?? 150;
  textHighlightType: string = config.page?.elasticSearch?.textHighlightType ?? 'fvh';
  textTitleHighlightType: string = config.page?.elasticSearch?.textTitleHighlightType ?? 'fvh';

  readonly activeFilters = signal<any[]>([]);
  readonly dateHistogramData = signal<any>(undefined);
  readonly disableFilterCheckboxes = signal(true);
  readonly elasticError = signal(false);
  readonly filterLoadingError = signal(false);
  readonly filterGroups = signal<any[]>([]);
  readonly filtersVisible = signal(!this.platformService.isMobile());
  readonly from = signal(0);
  readonly hits = signal<any[]>([]);
  readonly initializing = signal(true);
  readonly loading = signal(true);
  readonly loadingMoreHits = signal(false);
  readonly mdContent$ = this.mdService.getParsedMdContent(this.activeLocale + '-12-01');
  readonly pages = signal(1);
  readonly query = signal('');
  readonly range = signal<TimeRange | null | undefined>(undefined);
  readonly rangeYears = signal<YearRange | null>(null);
  readonly searchResultsColumnMinHeight = signal<string | null>(null);
  private readonly searchTrigger$ = new Subject<boolean>();
  readonly showAllFor = signal<Record<string, boolean>>({});
  readonly sort = signal('');
  readonly sortSelectOptions: Record<string, any> = {
    header: $localize`:@@ElasticSearch.SortBy:Sortera enligt`,
    cssClass: 'custom-select-alert'
  };
  readonly submittedQuery = signal('');
  readonly total = signal(-1);

  constructor() {
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

  }

  ngOnInit() {
    // Set up search data stream subscriptions
    this.subscribeToSearchDataStreams();

    // Get initial aggregations
    this.getInitialAggregations().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (filters: any) => {
        // Populate initial filters with initial aggregations data
        this.filterGroups.set(filters);

        for (let g = 0; g < filters.length; g++) {
          if (filters[g].name === 'Years') {
            this.dateHistogramData.set(filters[g].filters);
            break;
          }
        }

        this.disableFilterCheckboxes.set(false);
        this.loading.set(false);
        this.initializing.set(false);
        this.filterLoadingError.set(false);

        // Set up URL query params subscriptions in order to trigger new searches
        this.subscribeToQueryParams();
      },
      error: (e: any) => {
        this.handleInitialAggregationsError(e);
      }
    });
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
    this.searchTrigger$.pipe(
      switchMap(() => {
        const activeFilters = this.activeFilters();
        const filterGroups = this.filterGroups();
        const from = this.from();
        const pages = this.pages();
        const query = this.query();
        const range = this.range();
        const searchQuery$: Observable<any> = 
              !(this.submittedQuery() || range || activeFilters.length)
              ? of({ hits: { total: { value: -1 } } })
              : this.elasticService.executeSearchQuery({
                  queries: [query],
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
                  from,
                  size: (from < 1 && pages > 1) ? pages * this.hitsPerPage : this.hitsPerPage,
                  facetGroups: filterGroups,
                  range,
                  sort: this.parseSortForQuery(),
                });

        if (from < 1) {
          // Get aggregations only if NOT loading more hits
          const aggregationsQuery$: Observable<any> = this.elasticService.executeAggregationQuery({
            queries: [query],
            facetGroups: filterGroups,
            range,
          });

          return merge(searchQuery$, aggregationsQuery$);
        } else {
          return searchQuery$;
        }
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: any) => {
        // console.log('data:', data);
        if (data?.aggregations) {
          this.updateFilters(data.aggregations);
          this.disableFilterCheckboxes.set(false);
        } else {
          if (data?.hits === undefined) {
            console.error('Elastic search error, no hits: ', data);
            this.from.set(0);
            this.pages.set(1);
            this.total.set(0);
            this.elasticError.set(true);
          } else if (data.hits?.total?.value > -1) {
            this.total.set(data.hits.total.value);
    
            // Append new hits to this.hits array.
            this.hits.update(hits => [...hits, ...data.hits.hits.map((hit: any) => ({
              type: hit._source.text_type,
              source: hit._source,
              highlight: hit.highlight,
              id: hit._id
            }))]);
    
            if (this.from() < 1 && this.pages() > 1) {
              this.from.set((this.pages() - 1) * this.hitsPerPage);
            }
          }
    
          this.loading.set(false);
          this.loadingMoreHits.set(false);
        }
      },
      error: (e: any) => {
        console.error('Elastic search error: ', e);
        this.from.set(0);
        this.pages.set(1);
        this.total.set(0);
        this.elasticError.set(true);
        this.loading.set(false);
        this.loadingMoreHits.set(false);
        this.disableFilterCheckboxes.set(false);
      }
    });
  }

  /**
   * Subscribe to queryParams, all searches are triggered through them.
   */
  private subscribeToQueryParams() {
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (queryParams: any) => this.handleQueryParams(queryParams)
    );

    this.handleQueryParams(this.route.snapshot.queryParams);
  }

  private handleQueryParams(queryParams: any) {
    queryParams = queryParams ?? {};
    const queryParamsKey = JSON.stringify(queryParams);
    if (queryParamsKey === this.lastHandledQueryParams) {
      return;
    }
    this.lastHandledQueryParams = queryParamsKey;

    const isInitialQueryParams = !this.queryParamsInitialized;
    let triggerSearch = false;
    let directSearch = false;

    // Text query
    if (queryParams['query']) {
      if (queryParams['query'] !== this.submittedQuery()) {
        this.query.set(queryParams['query']);
        triggerSearch = true;
      }
    }

    // Filters
    if (queryParams['filters']) {
      const parsedActiveFilters = this.urlService.parse(queryParams['filters'], true);
      if (this.activeFiltersChanged(parsedActiveFilters)) {
        this.selectFiltersFromActiveFilters(parsedActiveFilters);
        this.activeFilters.set(parsedActiveFilters);
        triggerSearch = true;
      }
    } else if (this.activeFilters().length) {
      // Active filters should be cleared
      this.clearAllActiveFilters();
      triggerSearch = true;
    }

    // Time range
    if (queryParams['from'] && queryParams['to']) {
      const range = {
        from: queryParams['from'],
        to: queryParams['to']
      };

      if (
        range.from !== this.rangeYears()?.from ||
        range.to !== this.rangeYears()?.to
      ) {
        this.rangeYears.set(range);

        const fromYear = Number(range.from);
        const toYear = Number(range.to);

        // Here we store *date strings* used by the ES query
        this.range.set({
          from: `${fromYear}-01-01`,
          // exclusive upper bound: start of (toYear + 1)
          to: `${toYear + 1}-01-01`
        });

        triggerSearch = true;
      }
    } else if (this.range()?.from && this.range()?.to) {
      this.range.set(null);
      this.rangeYears.set(null);
      triggerSearch = true;
    }

    // Sort order
    if (queryParams['sort']) {
      let compareOrder = queryParams['sort'];
      if (queryParams['sort'] === 'relevance') {
        compareOrder = '';
      }
      if (compareOrder !== this.sort()) {
        this.sort.set(compareOrder);
        triggerSearch = true;
      }
    }

    // Number of pages with hits
    if (queryParams['pages']) {
      if (Number(queryParams['pages']) !== this.pages()) {
        if (this.from() < 1) {
          this.hits.set([]);
          this.from.set(0);
          this.total.set(-1);
        } else {
          this.loadingMoreHits.set(true);
        }
        this.pages.set(Number(queryParams['pages']) || 1);
        directSearch = true;
        triggerSearch = true;
      }
    }

    // Trigger new search if the search input field has been cleared, i.e. no "query" parameter
    if (
      !triggerSearch &&
      !queryParams['query'] &&
      this.submittedQuery() &&
      !isInitialQueryParams
    ) {
      triggerSearch = true;
    }

    // Clear all search parameters and trigger new search if no
    // query params and not on the first query-parameter pass.
    if (
      isEmptyObject(queryParams) &&
      !isInitialQueryParams
    ) {
      this.query.set('');
      this.activeFilters.set([]);
      this.range.set(null);
      this.rangeYears.set(null);
      this.sort.set('');
      triggerSearch = true;
    }

    this.queryParamsInitialized = true;

    // Execute new search if trigger criteria have been met
    if (triggerSearch) {
      if (directSearch) {
        this.search();
      } else {
        this.resetAndSearch();
      }
    }
  }

  /**
   * Trigger a new, clean search.
   */
  private resetAndSearch() {
    this.disableFilterCheckboxes.set(true);
    this.reset();
    this.search();
  }

  /**
   * Trigger an immediate search with current parameters. Called directly only
   * to load more search results.
   */
  private search() {
    this.setSearchColumnMinHeight();
    this.elasticError.set(false);
    this.loading.set(true);
    this.submittedQuery.set(this.query());
    this.searchTrigger$.next(true);
  };

  /**
   * Reset search results.
   */
  private reset() {
    this.hits.set([]);
    this.from.set(0);
    this.total.set(-1);
    this.pages.set(1);
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
    this.updateURLQueryParameters({ query: this.query() || null });
  }

  clearSearchQuery() {
    this.query.set('');
    this.updateURLQueryParameters({ query: null });
  }

  clearAllActiveFiltersAndTimeRange() {
    this.updateURLQueryParameters({ filters: null, from: null, to: null });
  }

  /**
   * Trigger a new search with selected years.
   */
  onTimeRangeChange(newRange: YearRange | null) {
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
    this.loadingMoreHits.set(true);
    this.from.update(from => from + this.hitsPerPage);

    this.updateURLQueryParameters({ pages: this.pages() + 1 });
  }

  private getInitialAggregations(): Observable<any> {
    return this.elasticService.executeAggregationQuery({
      queries: [],
      facetGroups: {},
      range: undefined,
    }).pipe(
      map((data: any) => {
        const aggregations = data?.aggregations;
        if (!aggregations || typeof aggregations !== 'object' || Array.isArray(aggregations)) {
          console.error('Elastic search aggregation error, no aggregations: ', data);
          throw new Error('Elastic search aggregation response did not include aggregations.');
        }

        return this.getInitialFilters(aggregations);
      })
    );
  }

  private handleInitialAggregationsError(e: any) {
    console.error('Elastic search filter loading error: ', e);
    this.filterLoadingError.set(true);
    this.initializing.set(false);
    this.loading.set(false);
    this.loadingMoreHits.set(false);
    this.disableFilterCheckboxes.set(true);
    this.from.set(0);
    this.pages.set(1);
    this.total.set(0);
  }

  private parseSortForQuery() {
    const sort = this.sort();
    if (!sort) {
      return;
    }

    const [key, direction] = sort.split('.');
    return [{ [key]: direction }];
  }

  canShowHits() {
    return (!this.loading() || this.loadingMoreHits()) && (
      this.submittedQuery() || this.range() || this.activeFilters().length
    );
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
    const filterGroups = this.filterGroups();
    // Mark the filter as unselected
    for (let g = 0; g < filterGroups.length; g++) {
      if (filterGroups[g].name === filterGroupKey) {
        for (let f = 0; f < filterGroups[g].filters.length; f++) {
          if (String(filterGroups[g].filters[f].key) === filterKey) {
            filterGroups[g].filters[f].selected = false;
            break;
          }
        }
        break;
      }
    }
    this.filterGroups.set([...filterGroups]);

    this.toggleFilter(filterGroupKey, { key: filterKey, selected: false, doc_count: 0 });
  }

  private getNewActiveFilters(filterGroupKey: string, updatedFilter: Facet) {
    const newActiveFilters: any[] = [];
    let filterGroupActive: boolean = false;
    const activeFilters = this.activeFilters();

    for (let a = 0; a < activeFilters.length; a++) {
      // Copy current active filters to new array
      newActiveFilters.push(
        {
          name: activeFilters[a].name,
          keys: [...activeFilters[a].keys]
        }
      );

      if (activeFilters[a].name === filterGroupKey) {
        filterGroupActive = true;

        if (updatedFilter.selected) {
          // Add filter to already active filter group
          newActiveFilters[newActiveFilters.length - 1].keys.push(updatedFilter.key);
        } else {
          // Remove filter from already active filter group
          for (let f = 0; f < newActiveFilters[newActiveFilters.length - 1].keys.length; f++) {
            if (String(newActiveFilters[newActiveFilters.length - 1].keys[f]) === String(updatedFilter.key)) {
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
    const filterGroups = this.filterGroups();
    for (let a = 0; a < activeFilters.length; a++) {
      for (let g = 0; g < filterGroups.length; g++) {
        if (activeFilters[a].name === filterGroups[g].name) {
          for (let i = 0; i < activeFilters[a].keys.length; i++) {
            for (let f = 0; f < filterGroups[g].filters.length; f++) {
              if (String(filterGroups[g].filters[f].key) === String(activeFilters[a].keys[i])) {
                filterGroups[g].filters[f].selected = true;
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
    const activeFilters = this.activeFilters();
    if (compareActiveFilters.length !== activeFilters.length) {
      return true;
    } else {
      for (let a = 0; a < activeFilters.length; a++) {
        let groupFound = false;
        for (let c = 0; c < compareActiveFilters.length; c++) {
          if (activeFilters[a].name === compareActiveFilters[c].name) {
            groupFound = true;

            if (activeFilters[a].keys.length !== compareActiveFilters[c].keys.length) {
              return true;
            }

            for (let k = 0; k < activeFilters[a].keys.length; k++) {
              if (!compareActiveFilters[c].keys.includes(activeFilters[a].keys[k])) {
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
    this.activeFilters.set([]);
    const filterGroups = this.filterGroups();
    for (let g = 0; g < filterGroups.length; g++) {
      for (let f = 0; f < filterGroups[g].filters.length; f++) {
        filterGroups[g].filters[f].selected = false;
      }
    }
    this.filterGroups.set([...filterGroups]);
  }

  /**
   * Updates filter data using the search result's aggregation data.
   */
  private updateFilters(aggregations: AggregationsData) {
    const filterGroups = this.filterGroups();
    // Get aggregation keys that are ordered in config.json.
    this.elasticService.getAggregationKeys().forEach((filterGroupKey: any) => {
      const newFilterGroup = this.convertAggregationsToFilters(aggregations[filterGroupKey]);
      let filterGroupExists = false;
      for (let g = 0; g < filterGroups.length; g++) {
        if (filterGroups[g].name === filterGroupKey) {
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
            for (let f = 0; f < filterGroups[g].filters.length; f++) {
              if (filterGroups[g].filters[f].selected) {
                let found = false;
                for (let w = 0; w < filtersArray.length; w++) {
                  if (filterGroups[g].filters[f].key === filtersArray[w].key) {
                    filtersArray[w].selected = true;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  filtersArray.push({
                    key: filterGroups[g].filters[f].key,
                    doc_count: 0,
                    selected: true
                  });
                }
              }
            }

            filterGroups[g].filters = filtersArray;
          } else {
            // Aggregations are ordered according to key name -->
            // Empty filters should be retained with zero count
            for (let f = 0; f < filterGroups[g].filters.length; f++) {
              const updatedFilter = newFilterGroup[filterGroups[g].filters[f].key];
              if (updatedFilter) {
                filterGroups[g].filters[f].doc_count = updatedFilter.doc_count;
              } else {
                filterGroups[g].filters[f].doc_count = 0;
              }
            }
          }

          // Ensure that all active filters are still selected
          this.selectFiltersFromActiveFilters(this.activeFilters());

          // The reference of date histogram filter arrays needs to be changed in order
          // for change detection to be triggered in the <date-histogram> component
          // when the input changes. This shallow copy action using the spread operator
          // accomplishes this.
          if (config.page?.elasticSearch?.aggregations?.[filterGroupKey]?.date_histogram) {
            filterGroups[g].filters = [...filterGroups[g].filters];
          }

          break;
        }
      }

      if (!filterGroupExists) {
        filterGroups.push(
          {
            name: filterGroupKey,
            filters: this.convertFilterGroupToArray(filterGroupKey, newFilterGroup),
            open: config.page?.elasticSearch?.filterGroupsOpenByDefault?.includes(filterGroupKey) ? true : false,
            type: this.elasticService.isDateHistogramAggregation(filterGroupKey) ? 'date_histogram' : 'terms'
          }
        );
      }
    });
    this.filterGroups.set([...filterGroups]);
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
    const buckets = aggregation?.buckets || aggregation?.filtered?.buckets;

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
    this.filterGroups.update(filterGroups => [...filterGroups]);
  }

  toggleShowAllFor(filterGroupName: string) {
    this.showAllFor.update(showAllFor => ({
      ...showAllFor,
      [filterGroupName]: !showAllFor[filterGroupName]
    }));
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
    this.filtersVisible.update(filtersVisible => !filtersVisible);
  }

  scrollToTop() {
    if (isBrowser()) {
      const searchBarElem: HTMLElement | null = this.elementRef.nativeElement.querySelector('.search-container');
      if (searchBarElem) {
        const topMenuElem: HTMLElement | null = document.querySelector('top-menu');
        if (topMenuElem) {
          this.content()?.scrollByPoint(0, searchBarElem.getBoundingClientRect().top - topMenuElem.offsetHeight, 500);
        }
      }
    }
  }

  private setSearchColumnMinHeight() {
    if (isBrowser()) {
      const elem: HTMLElement | null = this.elementRef.nativeElement.querySelector('.search-result-column');
      const elemRect = elem?.getBoundingClientRect();
      this.searchResultsColumnMinHeight.set(elemRect ? elemRect.bottom - elemRect.top + 'px' : null);
    } else {
      this.searchResultsColumnMinHeight.set(null);
    }
  }

}
