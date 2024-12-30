import { Component, Inject, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ModalController } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';

import { config } from '@config';
import { IndexFilterModal } from '@modals/index-filter/index-filter.modal';
import { NamedEntityModal } from '@modals/named-entity/named-entity.modal';
import { MarkdownService } from '@services/markdown.service';
import { NamedEntityService } from '@services/named-entity.service';
import { TooltipService } from '@services/tooltip.service';
import { sortArrayOfObjectsAlphabetically } from '@utility-functions';


/**
 * TODO: Add filters and search term to queryParams; refactor index for works
 */
@Component({
    selector: 'page-index',
    templateUrl: './index.page.html',
    styleUrls: ['./index.page.scss'],
    standalone: false
})
export class IndexPage implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  agg_after_key: Record<string, any> = {};
  alphabet: string[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', 'Å', 'Ä', 'Ö'
  ];
  cachedData: any[] = [];
  data: any[] = [];
  filters: any = {};
  indexDatabase: string = 'elastic';
  indexType: string = '';
  itemType: string = '';
  lastFetchSize: number = 0;
  maxFetchSize: number = 500;
  mdContent$: Observable<string | null>;
  routeParamsSubscription: Subscription | null = null;
  routeQueryParamsSubscription: Subscription | null = null;
  searchText: string = '';
  showFilter: boolean = false;
  showLoading: boolean = true;

  constructor(
    private mdService: MarkdownService,
    private modalCtrl: ModalController,
    private namedEntityService: NamedEntityService,
    public route: ActivatedRoute,
    private router: Router,
    private tooltipService: TooltipService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.routeParamsSubscription = this.route.params.subscribe(params => {
      this.data = [];
      this.cachedData = [];
      this.filters = {};
      this.searchText = '';
      this.agg_after_key = {};
      this.indexType = params['type'] ?? '';
      let indexTypeMdNodeID = '';

      if (this.indexType === 'persons') {
        this.itemType = 'person';
        indexTypeMdNodeID = '12-02';
        this.indexDatabase = config.page?.index?.persons?.database ?? 'elastic';
        this.showFilter = config.page?.index?.persons?.showFilter ?? false;
        this.maxFetchSize = config.page?.index?.persons?.maxFetchSize ?? 500;

      } else if (this.indexType === 'places') {
        this.itemType = 'place';
        indexTypeMdNodeID = '12-03';
        this.showFilter = config.page?.index?.places?.showFilter ?? false;
        this.maxFetchSize = config.page?.index?.persons?.maxFetchSize ?? 500;

      } else if (this.indexType === 'keywords') {
        this.itemType = 'keyword';
        indexTypeMdNodeID = '12-04';
        this.showFilter = config.page?.index?.keywords?.showFilter ?? false;
        this.maxFetchSize = config.page?.index?.keywords?.maxFetchSize ?? 500;

      } else if (this.indexType === 'works') {
        this.itemType = 'work';
        indexTypeMdNodeID = '12-05';
        this.showFilter = false;
        this.maxFetchSize = 500;
      }

      if (this.maxFetchSize > 10000) {
        this.maxFetchSize = 10000;
      }

      if (indexTypeMdNodeID) {
        this.mdContent$ = this.mdService.getParsedMdContent(
          this.activeLocale + '-' + indexTypeMdNodeID
        );
      }

      if (this.indexType) {
        this.getIndexData();
      }
    });

    this.routeQueryParamsSubscription = this.route.queryParams.subscribe(queryParams => {
      if (queryParams['id'] && this.itemType) {
        this.openSemanticDataObjectModal(queryParams['id'], this.itemType);
      }
    });
  }

  ngOnDestroy() {
    this.routeParamsSubscription?.unsubscribe();
    this.routeQueryParamsSubscription?.unsubscribe();
  }

  private getIndexData() {
    this.showLoading = true;
    if (this.indexType === 'persons') {
      this.getPersonsData();
    } else if (this.indexType === 'places') {
      this.getPlacesData();
    } else if (this.indexType === 'keywords') {
      this.getKeywordsData();
    } else if (this.indexType === 'works') {
      this.getWorksData();
    } else {
      this.showLoading = false;
    }
  }

  private getPersonsData() {
    if (this.indexDatabase !== 'elastic') {
      this.getPersonsDataSimple();
    } else {
      this.getPersonsDataElastic();
    }
  }

  private getPersonsDataSimple() {
    this.namedEntityService.getPersons(this.activeLocale).subscribe({
      next: (persons) => {
        this.data = persons;
        this.cachedData = persons;
        this.showLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.showLoading = false;
      }
    });
  }

  private getPersonsDataElastic() {
    this.namedEntityService.getPersonsFromElastic(
      this.agg_after_key, this.searchText, this.filters, this.maxFetchSize
    ).subscribe({
      next: (persons: any) => {
        if (persons.error !== undefined) {
          console.error('Elastic search error getting persons: ', persons);
        }

        if (persons?.aggregations?.unique_subjects?.buckets?.length > 0) {
          this.agg_after_key = persons.aggregations.unique_subjects.after_key;
          this.lastFetchSize = persons.aggregations.unique_subjects.buckets.length;
          persons = persons.aggregations.unique_subjects.buckets;

          persons.forEach((personObj: any) => {
            personObj = this.processDataObject(personObj, this.indexType);
            this.data.push(personObj);
          });

          this.sortListAlphabeticallyAndGroup(this.data);
        } else {
          this.agg_after_key = {};
          this.lastFetchSize = 0;
        }

        this.showLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.showLoading = false;
        this.agg_after_key = {};
        this.lastFetchSize = 0;
      }
    });
  }

  private getPlacesData() {
    this.namedEntityService.getPlacesFromElastic(
      this.agg_after_key, this.searchText, this.filters, this.maxFetchSize
    ).subscribe({
      next: (places) => {
        if (places.error !== undefined) {
          console.error('Elastic search error getting places: ', places);
        }
        if (places.aggregations?.unique_places?.buckets?.length > 0) {
          this.agg_after_key = places.aggregations.unique_places.after_key;
          this.lastFetchSize = places.aggregations.unique_places.buckets.length;
          places = places.aggregations.unique_places.buckets;

          places.forEach((placeObj: any) => {
            placeObj = this.processDataObject(placeObj, this.indexType);
            this.data.push(placeObj);
          });

          this.sortListAlphabeticallyAndGroup(this.data);
        } else {
          this.agg_after_key = {};
          this.lastFetchSize = 0;
        }

        this.showLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.showLoading = false;
        this.agg_after_key = {};
        this.lastFetchSize = 0;
      }
    });
  }

  private getKeywordsData() {
    this.namedEntityService.getKeywordsFromElastic(
      this.agg_after_key, this.searchText, this.filters, this.maxFetchSize
    ).subscribe({
      next: (keywords) => {
        if (keywords.error !== undefined) {
          console.error('Elastic search error getting keywords: ', keywords);
        }
        if (
          keywords?.aggregations?.unique_tags?.buckets?.length > 0
        ) {
          this.agg_after_key = keywords.aggregations.unique_tags.after_key;
          this.lastFetchSize = keywords.aggregations.unique_tags.buckets.length;
          keywords = keywords.aggregations.unique_tags.buckets;

          keywords.forEach((keywordObj: any) => {
            keywordObj = this.processDataObject(keywordObj, this.indexType);
            this.data.push(keywordObj);
          });

          this.sortListAlphabeticallyAndGroup(this.data);
        } else {
          this.agg_after_key = {};
          this.lastFetchSize = 0;
        }

        this.showLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.showLoading = false;
        this.agg_after_key = {};
        this.lastFetchSize = 0;
      }
    });
  }

  /**
   * TODO: Recreate the elastic index for works according to persons, places and keywords and refactor here.
   */
  private getWorksData() {
    this.namedEntityService.getWorksFromElastic(
      0, this.searchText, this.maxFetchSize
    ).subscribe({
      next: (works) => {
        works = works?.hits?.hits ?? [];
        this.lastFetchSize = works.length;

        works.forEach((element: any) => {
          element = element['_source'];
          element['id'] = element['man_id'];
          element['sortBy'] = String(element['title']).trim().replace('ʽ', '');

          // remove any empty author_data
          if (element['author_data'][0]['id'] === undefined) {
            element['author_data'] = [];
          }

          if (element['author_data'].length > 0) {
            element['sortBy'] = String(element['author_data'][0]['first_name']).trim().replace('ʽ', '');
          }

          // prefer sorting by last_name
          if (
            element['author_data'].length > 0 &&
            String(element['author_data'][0]['last_name']).trim().length > 0
          ) {
            element['sortBy'] = String(element['author_data'][0]['last_name']).trim().replace('ʽ', '');
          }

          const ltr = element['sortBy'].charAt(0);
          if (!(ltr.length === 1 && ltr.match(/[a-zåäö]/i) !== null)) {
            element['sortBy'] = element['sortBy'].normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(',', '');
          }

          let found = false;
          for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].id === element.id) {
              found = true;
              break;
            }
          }
          if (!found) {
            this.data.push(element);
          }
        });

        this.sortListAlphabeticallyAndGroup(this.data, 'sortBy');
        this.showLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.showLoading = false;
      }
    });
  }

  private processDataObject(object: any, indexType: string) {
    object = object['key'];

    let sortByName = (indexType === 'persons') ? String(object['full_name']) : String(object['name']);
    if (object['sort_by_name']) {
      sortByName = String(object['sort_by_name']);
    }
    sortByName = sortByName.replace('ʽ', '').trim();
    if (indexType === 'persons') {
      sortByName = sortByName.replace(
        /^(?:de la |de |von der |van der |von |van |der |af |d’ |d’|di |du |des |zu |auf |del |do |dos |da |das |e )/, ''
      );
    }
    sortByName = sortByName.toLowerCase();
    const ltr = sortByName.charAt(0);
    if (ltr.length === 1 && ltr.match(/[a-zåäö]/i)) {
      object['sort_by_name'] = sortByName;
    } else {
      object['sort_by_name'] = sortByName.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(',', '');
    }

    if (indexType === 'persons') {
      object['year_born_deceased'] = this.tooltipService.constructYearBornDeceasedString(
        object['date_born'], object['date_deceased']
      );
    }
    
    return object;
  }

  reset() {
    this.filters = {};
    this.searchText = '';
    this.searchData();
    this.scrollToTop();
  }

  filterByInitialLetter(letter: string) {
    this.searchText = letter;
    this.searchData(true);
    this.scrollToTop();
  }

  searchData(filterByInitialLetter: boolean = false) {
    if (this.indexDatabase !== 'elastic') {
      if (!this.searchText) {
        this.data = this.cachedData;
      } else {
        if (this.indexType === 'persons') {
          if (filterByInitialLetter) {
            this.data = this.cachedData.filter(
              item => item.sort_by && (item.sort_by as string).startsWith(this.searchText)
            );
          } else {
            this.data = this.cachedData.filter(
              item => (
                (item.name_for_list && (item.name_for_list as string).toLowerCase().includes(this.searchText.toLowerCase())) ||
                (item.full_name && (item.full_name as string).toLowerCase().includes(this.searchText.toLowerCase()))
              )
            );
          }
        }
      }
    } else {
      this.agg_after_key = {};
      this.data = [];
      this.getIndexData();
    }
  }

  loadMore(e: any) {
    this.getIndexData();
  }

  hasMore() {
    return this.lastFetchSize > this.maxFetchSize - 1;
  }

  scrollToTop() {
    this.content.scrollToTop(500);
  }

  clearFilters() {
    this.filters = {};
    this.searchData();
  }

  async openFilterModal() {
    const filterModal = await this.modalCtrl.create({
      component: IndexFilterModal,
      componentProps: {
        searchType: this.indexType,
        activeFilters: this.filters
      }
    });

    filterModal.present();

    const { data, role } = await filterModal.onWillDismiss();

    if (role === 'apply' && data) {
      this.data = [];
      this.agg_after_key = {};
      this.filters = data;
      this.getIndexData();
    }
  }

  async openSemanticDataObjectModal(id: string | number, type: string) {
    const modal = await this.modalCtrl.create({
      component: NamedEntityModal,
      componentProps: {
        id: String(id),
        type
      }
    });

    modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'backdrop' || role === 'close') {
      this.updateQueryParams('id', null);
    }
  }

  private updateQueryParams(property: string, id: string | null) {
    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: { [property]: id },
        queryParamsHandling: 'merge',
        replaceUrl: true
      }
    );
  }

  private sortListAlphabeticallyAndGroup(list: any[], sortableKey: string = 'sort_by_name') {
    const data = list;

    // Sort alphabetically
    sortArrayOfObjectsAlphabetically(data, sortableKey);

    // Check when first character changes in order to divide names into alphabetical groups
    for (let i = 0; i < data.length ; i++) {
      if (data[i] && data[i - 1]) {
        if (data[i][sortableKey] && data[i - 1][sortableKey]) {
          if (data[i][sortableKey].length > 1 && data[i - 1][sortableKey].length > 1) {
            if (data[i][sortableKey].charAt(0) !== data[i - 1][sortableKey].charAt(0)) {
              const ltr = data[i][sortableKey].charAt(0);
              if (ltr.length === 1 && ltr.match(/[a-zåäö]/i)) {
                data[i]['firstOfItsKind'] = data[i][sortableKey].charAt(0);
              }
            }
          }
        }
      }
    }

    for (let j = 0; j < data.length; j++) {
      if (data[j][sortableKey].length > 1) {
        data[j]['firstOfItsKind'] = data[j][sortableKey].charAt(0);
        break;
      }
    }

    return data;
  }

  trackData(index: number, dataItem: any) {
    return dataItem ? dataItem.id : undefined;
  }

}
