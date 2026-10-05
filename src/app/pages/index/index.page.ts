import { Component, DestroyRef, LOCALE_ID, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFabButton,
  IonIcon,
  IonSearchbar,
  IonSpinner,
  ModalController
} from '@ionic/angular';
import { map, of, switchMap } from 'rxjs';

import { config } from '@config';
import { IndexFilterModal } from '@modals/index-filter/index-filter.modal';
import { NamedEntityModal } from '@modals/named-entity/named-entity.modal';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { MarkdownService } from '@services/markdown.service';
import { NamedEntityService } from '@services/named-entity.service';
import { TooltipService } from '@services/tooltip.service';
import { isBrowser, sortArrayOfObjectsAlphabetically } from '@utility-functions';


/**
 * TODO: Add filters and search term to queryParams; refactor index for works
 */
@Component({
  selector: 'page-index',
  templateUrl: './index.page.html',
  styleUrls: ['./index.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonContent,
    IonFabButton,
    IonIcon,
    IonSearchbar,
    IonSpinner,
    RouterLink,
    TrustHtmlPipe
  ]
})
export class IndexPage implements OnInit {
  private destroyRef = inject(DestroyRef);
  private mdService = inject(MarkdownService);
  private modalCtrl = inject(ModalController);
  private namedEntityService = inject(NamedEntityService);
  route = inject(ActivatedRoute);
  private router = inject(Router);
  private tooltipService = inject(TooltipService);
  private activeLocale = inject(LOCALE_ID);

  readonly content = viewChild(IonContent);

  private agg_after_key: Record<string, any> = {};
  readonly alphabet: string[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', 'Å', 'Ä', 'Ö'
  ];
  private cachedData: any[] = [];
  readonly data = signal<any[]>([]);
  readonly filters = signal<any>({});
  readonly indexDatabase = signal('elastic');
  readonly indexType = signal('');
  private itemType = '';
  private lastFetchSize = 0;
  private maxFetchSize = 500;
  readonly mdContent = toSignal(
    this.route.params.pipe(
      map(params => this.getMdNodeId(params['type'] ?? '')),
      switchMap(mdNodeId => mdNodeId
        ? this.mdService.getParsedMdContent(this.activeLocale + '-' + mdNodeId)
        : of(null)
      )
    ),
    { initialValue: null }
  );
  readonly searchText = signal('');
  readonly showFilter = signal(false);
  readonly showLoading = signal(true);

  ngOnInit() {
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      this.indexType.set(params['type'] ?? '');
      this.setUpIndexConfig();

      // Check if queryParams includes 'id' before deciding to load list:
      // 1. In a browser, the list is always loaded.
      // 2. On the server, the list is only loaded if no modal is open.
      //    This reduces CPU load.
      const id = this.route.snapshot.queryParams?.id;
      if (this.indexType() && (isBrowser() || !id)) {
        this.getIndexData();
      }
    });

    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(queryParams => {
      // Load modal with named entity data only in browser
      if (queryParams['id'] && this.itemType && isBrowser()) {
        this.openNamedEntityModal(queryParams['id'], this.itemType);
      }
    });
  }

  private setUpIndexConfig() {
    this.data.set([]);
    this.cachedData = [];
    this.filters.set({});
    this.searchText.set('');
    this.agg_after_key = {};

    if (this.indexType() === 'persons') {
      this.itemType = 'person';
      this.indexDatabase.set(config.page?.index?.persons?.database ?? 'elastic');
      this.showFilter.set(config.page?.index?.persons?.showFilter ?? false);
      this.maxFetchSize = config.page?.index?.persons?.maxFetchSize ?? 500;

    } else if (this.indexType() === 'places') {
      this.itemType = 'place';
      this.indexDatabase.set('elastic');
      this.showFilter.set(config.page?.index?.places?.showFilter ?? false);
      this.maxFetchSize = config.page?.index?.places?.maxFetchSize ?? 500;

    } else if (this.indexType() === 'keywords') {
      this.itemType = 'keyword';
      this.indexDatabase.set('elastic');
      this.showFilter.set(config.page?.index?.keywords?.showFilter ?? false);
      this.maxFetchSize = config.page?.index?.keywords?.maxFetchSize ?? 500;

    } else if (this.indexType() === 'works') {
      this.itemType = 'work';
      this.indexDatabase.set('elastic');
      this.showFilter.set(false);
      this.maxFetchSize = 500;
    } else {
      this.itemType = '';
      this.indexDatabase.set('elastic');
      this.showFilter.set(false);
      this.maxFetchSize = 500;
    }

    if (this.maxFetchSize > 10000) {
      this.maxFetchSize = 10000;
    }
  }

  private getMdNodeId(indexType: string): string {
    switch (indexType) {
      case 'persons': return '12-02';
      case 'places': return '12-03';
      case 'keywords': return '12-04';
      case 'works': return '12-05';
      default: return '';
    }
  }

  private getIndexData() {
    this.showLoading.set(true);
    if (this.indexType() === 'persons') {
      this.getPersonsData();
    } else if (this.indexType() === 'places') {
      this.getPlacesData();
    } else if (this.indexType() === 'keywords') {
      this.getKeywordsData();
    } else if (this.indexType() === 'works') {
      this.getWorksData();
    } else {
      this.showLoading.set(false);
    }
  }

  private getPersonsData() {
    if (this.indexDatabase() !== 'elastic') {
      this.getPersonsDataSimple();
    } else {
      this.getPersonsDataElastic();
    }
  }

  private getPersonsDataSimple() {
    this.namedEntityService.getPersons(this.activeLocale).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (persons) => {
        this.data.set(persons);
        this.cachedData = persons;
        this.showLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showLoading.set(false);
      }
    });
  }

  private getPersonsDataElastic() {
    this.namedEntityService.getPersonsFromElastic(
      this.agg_after_key, this.searchText(), this.filters(), this.maxFetchSize
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (persons: any) => {
        if (persons.error !== undefined) {
          console.error('Elastic search error getting persons: ', persons);
        }

        if (persons?.aggregations?.unique_subjects?.buckets?.length > 0) {
          this.agg_after_key = persons.aggregations.unique_subjects.after_key;
          this.lastFetchSize = persons.aggregations.unique_subjects.buckets.length;
          persons = persons.aggregations.unique_subjects.buckets;

          const data = [...this.data()];
          persons.forEach((personObj: any) => {
            data.push(this.processDataObject(personObj, this.indexType()));
          });

          this.data.set(this.sortListAlphabeticallyAndGroup(data));
        } else {
          this.agg_after_key = {};
          this.lastFetchSize = 0;
        }

        this.showLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showLoading.set(false);
        this.agg_after_key = {};
        this.lastFetchSize = 0;
      }
    });
  }

  private getPlacesData() {
    this.namedEntityService.getPlacesFromElastic(
      this.agg_after_key, this.searchText(), this.filters(), this.maxFetchSize
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (places) => {
        if (places.error !== undefined) {
          console.error('Elastic search error getting places: ', places);
        }
        if (places.aggregations?.unique_places?.buckets?.length > 0) {
          this.agg_after_key = places.aggregations.unique_places.after_key;
          this.lastFetchSize = places.aggregations.unique_places.buckets.length;
          places = places.aggregations.unique_places.buckets;

          const data = [...this.data()];
          places.forEach((placeObj: any) => {
            data.push(this.processDataObject(placeObj, this.indexType()));
          });

          this.data.set(this.sortListAlphabeticallyAndGroup(data));
        } else {
          this.agg_after_key = {};
          this.lastFetchSize = 0;
        }

        this.showLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showLoading.set(false);
        this.agg_after_key = {};
        this.lastFetchSize = 0;
      }
    });
  }

  private getKeywordsData() {
    this.namedEntityService.getKeywordsFromElastic(
      this.agg_after_key, this.searchText(), this.filters(), this.maxFetchSize
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
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

          const data = [...this.data()];
          keywords.forEach((keywordObj: any) => {
            data.push(this.processDataObject(keywordObj, this.indexType()));
          });

          this.data.set(this.sortListAlphabeticallyAndGroup(data));
        } else {
          this.agg_after_key = {};
          this.lastFetchSize = 0;
        }

        this.showLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showLoading.set(false);
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
      0, this.searchText(), this.maxFetchSize
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (works) => {
        works = works?.hits?.hits ?? [];
        this.lastFetchSize = works.length;
        const data = [...this.data()];

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
          for (let i = 0; i < data.length; i++) {
            if (data[i].id === element.id) {
              found = true;
              break;
            }
          }
          if (!found) {
            data.push(element);
          }
        });

        this.data.set(this.sortListAlphabeticallyAndGroup(data, 'sortBy'));
        this.showLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showLoading.set(false);
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
    this.filters.set({});
    this.searchText.set('');
    this.searchData();
    this.scrollToTop();
  }

  filterByInitialLetter(letter: string) {
    this.searchText.set(letter);
    this.searchData(true);
    this.scrollToTop();
  }

  searchData(filterByInitialLetter: boolean = false) {
    const searchText = this.searchText();
    if (this.indexDatabase() !== 'elastic') {
      if (!searchText) {
        this.data.set(this.cachedData);
      } else {
        if (this.indexType() === 'persons') {
          if (filterByInitialLetter) {
            this.data.set(this.cachedData.filter(
              item => item.sort_by && (item.sort_by as string).startsWith(searchText)
            ));
          } else {
            this.data.set(this.cachedData.filter(
              item => (
                (item.name_for_list && (item.name_for_list as string).toLowerCase().includes(searchText.toLowerCase())) ||
                (item.full_name && (item.full_name as string).toLowerCase().includes(searchText.toLowerCase()))
              )
            ));
          }
        }
      }
    } else {
      this.agg_after_key = {};
      this.data.set([]);
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
    this.content()?.scrollToTop(500);
  }

  clearFilters() {
    this.filters.set({});
    this.searchData();
  }

  async openFilterModal() {
    const filterModal = await this.modalCtrl.create({
      component: IndexFilterModal,
      componentProps: {
        searchType: this.indexType(),
        activeFilters: this.filters()
      }
    });

    filterModal.present();

    const { data, role } = await filterModal.onWillDismiss();

    if (role === 'apply' && data) {
      this.data.set([]);
      this.agg_after_key = {};
      this.filters.set(data);
      this.getIndexData();
    }
  }

  async openNamedEntityModal(id: string | number, type: string) {
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

}
