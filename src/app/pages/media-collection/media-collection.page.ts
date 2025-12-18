import { ChangeDetectionStrategy, ChangeDetectorRef, Component, LOCALE_ID, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { combineLatest, forkJoin, map, Observable, Subscription } from 'rxjs';

import { config } from '@config';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { GalleryItem } from '@models/gallery-item-models';
import { MediaCollection } from '@models/media-collection.models';
import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { DocumentHeadService } from '@services/document-head.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { UrlService } from '@services/url.service';
import { isEmptyObject, sortArrayOfObjectsAlphabetically, sortArrayOfObjectsNumerically } from '@utility-functions';


@Component({
  selector: 'page-media-collection',
  templateUrl: './media-collection.page.html',
  styleUrls: ['./media-collection.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MediaCollectionPage implements OnDestroy, OnInit {
  private cdRef = inject(ChangeDetectorRef);
  private headService = inject(DocumentHeadService);
  private mdService = inject(MarkdownService);
  private mediaCollectionService = inject(MediaCollectionService);
  private modalController = inject(ModalController);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private urlService = inject(UrlService);
  private activeLocale = inject(LOCALE_ID);

  readonly apiEndPoint: string = config.app?.backendBaseURL ?? '';
  readonly filterSelectOptions: Record<string, any> = {
    person: {
      header: $localize`:@@MediaCollection.FilterPerson:Avgränsa enligt person`,
      cssClass: 'custom-select-alert'
    },
    place: {
      header: $localize`:@@MediaCollection.FilterPlace:Avgränsa enligt plats`,
      cssClass: 'custom-select-alert'
    },
    keyword: {
      header: $localize`:@@MediaCollection.FilterKeyword:Avgränsa enligt ämnesord`,
      cssClass: 'custom-select-alert'
    }
  };
  readonly projectName: string = config.app?.projectNameDB ?? '';
  readonly showURNButton: boolean = config.page?.mediaCollection?.showURNButton ?? false;

  activeKeywordFilters: number[] = [];
  activePersonFilters: number[] = [];
  activePlaceFilters: number[] = [];
  allMediaCollections: GalleryItem[] = [];
  allMediaConnections: any = {};
  filterOptionsKeywords: any[] = [];
  filterOptionsPersons: any[] = [];
  filterOptionsPlaces: any[] = [];
  filterOptionsSubscription: Subscription | null = null;
  filterResultCount: number = -1;
  galleryBacksideImageURLs: (string | undefined)[] = [];
  galleryData: GalleryItem[] = [];
  galleryDescriptions: (string | undefined)[] = [];
  galleryImageURLs: (string | undefined)[] = [];
  galleryTitles: (string | undefined)[] = [];
  loadingGallery: boolean = true;
  loadingImageModal: boolean = false;
  mdContent$: Observable<string | null>;
  mediaCollectionID: string | undefined = undefined;
  mediaCollectionDescription: string = '';
  mediaCollectionTitle: string = '';
  namedEntityID: string = '';
  namedEntityType: string = '';
  urlParametersSubscription: Subscription | null = null;

  ngOnInit() {
    this.urlParametersSubscription = combineLatest(
      [this.route.params, this.route.queryParams]
    ).pipe(
      map(([params, queryParams]) => ({...params, ...queryParams}))
    ).subscribe((routeParams: any) => {
      if (
        (isEmptyObject(routeParams) && this.mediaCollectionID !== '') ||
        (
          !routeParams.mediaCollectionID &&
          (
            routeParams.filters ||
            !routeParams.filters &&
            (
              this.activePersonFilters.length ||
              this.activePlaceFilters.length ||
              this.activeKeywordFilters.length
            )
          )
        )
      ) {
        // Load all media collections
        this.loadingGallery = true;
        const shouldSetFilters = this.mediaCollectionID !== '' ? true : false;
        this.mediaCollectionID = '';
        this.namedEntityID = '';
        this.mediaCollectionTitle = $localize`:@@MainSideMenu.MediaCollections:Bildbank`;
        this.cdRef.detectChanges();
        this.mdContent$ = this.mdService.getParsedMdContent(
          this.activeLocale + '-11-all'
        );

        if (routeParams.filters) {
          this.setActiveFiltersFromQueryParams(routeParams.filters);
        } else {
          this.activePersonFilters = [];
          this.activePlaceFilters = [];
          this.activeKeywordFilters = [];
        }

        if (this.allMediaCollections.length < 1) {
          this.loadMediaCollections();
        } else {
          this.galleryData = this.allMediaCollections;
          if (shouldSetFilters) {
            this.setFilterOptionsAndApplyActiveFilters();
          } else {
            this.applyActiveFilters();
          }
        }
      } else if (
        routeParams.mediaCollectionID &&
        routeParams.mediaCollectionID !== 'entity' &&
        (
          routeParams.mediaCollectionID !== this.mediaCollectionID ||
          routeParams.filters ||
          !routeParams.filters &&
          (
            this.activePersonFilters.length ||
            this.activePlaceFilters.length ||
            this.activeKeywordFilters.length
          )
        )
      ) {
        // Load single media collection
        if (routeParams.filters) {
          this.setActiveFiltersFromQueryParams(routeParams.filters);
        } else {
          this.activePersonFilters = [];
          this.activePlaceFilters = [];
          this.activeKeywordFilters = [];
        }

        if (routeParams.mediaCollectionID !== this.mediaCollectionID) {
          this.loadingGallery = true;
          this.mediaCollectionID = routeParams.mediaCollectionID;
          this.loadSingleMediaCollection(routeParams.mediaCollectionID);
        } else {
          this.mediaCollectionID = routeParams.mediaCollectionID;
          this.applyActiveFilters();
        }
        this.namedEntityID = '';
      } else if (
        routeParams.mediaCollectionID === 'entity' &&
        routeParams.id &&
        routeParams.type
      ) {
        // Load specific images related to a named entity
        this.loadingGallery = true;
        this.mediaCollectionID = 'entity';
        this.namedEntityID = routeParams.id;
        this.namedEntityType = routeParams.type;
        this.loadNamedEntityGallery(this.namedEntityID, this.namedEntityType);
      }
    });
  }

  ngOnDestroy() {
    this.filterOptionsSubscription?.unsubscribe();
    this.urlParametersSubscription?.unsubscribe();
  }

  private loadMediaCollections() {
    this.galleryData = [];

    this.mediaCollectionService.getMediaCollections(this.activeLocale).subscribe(
      (collections: MediaCollection[]) => {
        this.allMediaCollections = this.getTransformedGalleryData(collections);
        this.galleryData = this.allMediaCollections;
        this.setFilterOptionsAndApplyActiveFilters();
      }
    );
  }

  private loadSingleMediaCollection(mediaCollectionID: string) {
    this.galleryData = [];

    // Get all media collections if not yet loaded, set current collection title and description
    if (this.allMediaCollections.length < 1) {
      this.mediaCollectionService.getMediaCollections(this.activeLocale).subscribe(
        (collections: MediaCollection[]) => {
          for (let i = 0; i < collections.length; i++) {
            if (collections[i].id === Number(mediaCollectionID)) {
              this.mediaCollectionTitle = collections[i].title || '';
              this.mediaCollectionDescription = collections[i].description || '';
              this.cdRef.detectChanges();
              break;
            }
          }
          this.allMediaCollections = this.getTransformedGalleryData(collections);
        }
      );
    } else {
      for (let i = 0; i < this.allMediaCollections.length; i++) {
        if (this.allMediaCollections[i].collectionID === Number(mediaCollectionID)) {
          this.mediaCollectionTitle = this.allMediaCollections[i].title || '';
          this.mediaCollectionDescription = this.allMediaCollections[i].description || '';
          this.cdRef.detectChanges();
          break;
        }
      }
    }

    this.mdContent$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-11-' + mediaCollectionID
    );

    // Get selected media collection data, then filter options and apply any active filters
    this.mediaCollectionService.getSingleMediaCollection(mediaCollectionID, this.activeLocale).subscribe(
      (galleryItems: any[]) => {
        this.galleryData = this.getTransformedGalleryData(galleryItems, true);
        this.setFilterOptionsAndApplyActiveFilters();
      }
    );
  }

  private loadNamedEntityGallery(objectID: string, objectType: string) {
    this.mediaCollectionService.getNamedEntityOccInMediaColls(objectType, objectID).subscribe(
      (occurrences: any) => {
        this.galleryData = this.getTransformedGalleryData(occurrences, true);

        if (objectType === 'person') {
          this.mediaCollectionTitle = occurrences[0]['full_name'];
          this.mediaCollectionDescription = '';
        } else {
          this.mediaCollectionTitle = occurrences[0]['name'];
          this.mediaCollectionDescription = '';
        }

        this.headService.setTitle([this.mediaCollectionTitle, $localize`:@@MainSideMenu.MediaCollections:Bildbank`]);

        this.loadingGallery = false;
        this.cdRef.detectChanges();
        this.setGalleryZoomedImageData();
      }
    );
  }

  private getTransformedGalleryData(galleryItems: MediaCollection[], singleGallery = false): GalleryItem[] {
    const galleryItemsList: GalleryItem[] = [];
    if (galleryItems?.length) {
      galleryItems.forEach((gallery: MediaCollection) => {
        const galleryItem = new GalleryItem(gallery);
        const urlStart = `${this.apiEndPoint}/${this.projectName}/gallery/get/${galleryItem.collectionID}/`;

        if (singleGallery) {
          const lastIndex = galleryItem.imageURL?.lastIndexOf('.') ?? -1;
          if (lastIndex > -1) {
            galleryItem.imageURLThumb = galleryItem.imageURL.substring(0, lastIndex) + '_thumb' + galleryItem.imageURL.substring(lastIndex);
          }
          galleryItem.imageURL = urlStart + `${galleryItem.imageURL}`;
          galleryItem.imageURLThumb = urlStart + `${galleryItem.imageURLThumb}`;
          galleryItem.imageURLBack = galleryItem.imageURLBack ? urlStart + `${galleryItem.imageURLBack}` : undefined;
        } else {
          galleryItem.imageURL = urlStart + `gallery_thumb.jpg`;
          galleryItem.imageURLThumb = galleryItem.imageURL;
        }

        if (!galleryItem.imageAltText) {
          galleryItem.imageAltText = $localize`:@@MediaCollection.GenericAltText:Galleribild`;
        }

        galleryItemsList.push(galleryItem);
      });

      !singleGallery && sortArrayOfObjectsAlphabetically(galleryItemsList, 'title');
      sortArrayOfObjectsNumerically(galleryItemsList, 'sortOrder');
    }
    return galleryItemsList;
  }

  private setGalleryZoomedImageData() {
    this.galleryImageURLs = [];
    this.galleryBacksideImageURLs = [];
    this.galleryDescriptions = [];
    this.galleryTitles = [];

    this.galleryData.forEach((element: GalleryItem) => {
      if (element.visible) {
        this.galleryImageURLs.push(element.imageURL);
        this.galleryBacksideImageURLs.push(element.imageURLBack);
        this.galleryDescriptions.push(element.description);
        this.galleryTitles.push(element.title);
      }
    });
  }

  private setActiveFiltersFromQueryParams(urlFilters: string) {
    const parsedActiveFilters = this.urlService.parse(urlFilters, true) || [];

    // Clear the current active filters before setting them from queryparams
    this.activePersonFilters = [];
    this.activePlaceFilters = [];
    this.activeKeywordFilters = [];

    parsedActiveFilters.forEach((filterGroup: any) => {
      if (filterGroup.person?.length) {
        this.activePersonFilters = filterGroup.person;
      }

      if (filterGroup.place?.length) {
        this.activePlaceFilters = filterGroup.place;
      }
      
      if (filterGroup.keyword?.length) {
        this.activeKeywordFilters = filterGroup.keyword;
      }
    });
  }

  /**
   * Sets filter options for media collection and applies any
   * active filters. this.galleryData must be set before
   * calling this function.
   */
  private setFilterOptionsAndApplyActiveFilters() {
    this.filterOptionsSubscription?.unsubscribe();
    this.filterOptionsSubscription = forkJoin(
      [
        this.mediaCollectionService.getAllNamedEntityOccInMediaCollsByType(
          'keyword', this.mediaCollectionID
        ),
        this.mediaCollectionService.getAllNamedEntityOccInMediaCollsByType(
          'person', this.mediaCollectionID
        ),
        this.mediaCollectionService.getAllNamedEntityOccInMediaCollsByType(
          'place', this.mediaCollectionID
        )
      ]
    ).pipe(
      map((res: any[]) => {
        const entityOccs = [
          {
            type: 'keyword',
            data: res[0] || []
          },
          {
            type: 'person',
            data: res[1] || []
          },
          {
            type: 'place',
            data: res[2] || []
          },
        ];
        return entityOccs;
      })
    ).subscribe(
      (filterGroups: any[]) => {
        filterGroups.forEach((group: any) => {
          this.setFilterOptionsByType(group.type, group.data);
        });

        this.applyActiveFilters();
      }
    );
  }

  private setFilterOptionsByType(type: string, entities: any[]) {
    const filterOptions: any[] = [];
    const addedIDs: number[] = [];
    this.allMediaConnections[type] = {};
    
    entities.forEach((entity: any) => {
      if (!addedIDs.includes(entity.id)) {
        filterOptions.push(
          {
            id: entity.id,
            name: entity.name
          }
        );
        addedIDs.push(entity.id);
      }
      if (!this.allMediaConnections[type][entity.id]) {
        this.allMediaConnections[type][entity.id] = {
          filenames: [],
          mediaCollectionIDs: []
        };
      }
      if (!this.allMediaConnections[type][entity.id]['filenames'].includes(entity.filename)) {
        this.allMediaConnections[type][entity.id]['filenames'].push(entity.filename);
      }
      if (!this.allMediaConnections[type][entity.id]['mediaCollectionIDs'].includes(entity.media_collection_id)) {
        this.allMediaConnections[type][entity.id]['mediaCollectionIDs'].push(entity.media_collection_id);
      }
    });
    
    sortArrayOfObjectsAlphabetically(filterOptions, 'name');
    if (type === 'person') {
      this.filterOptionsPersons = filterOptions;
    } else if (type === 'place') {
      this.filterOptionsPlaces = filterOptions;
    } else if (type === 'keyword') {
      this.filterOptionsKeywords = filterOptions;
    }
  }

  private applyActiveFilters() {
    let filterResultCount = 0;
    const connKey = this.mediaCollectionID ? 'filenames' : 'mediaCollectionIDs';
    const itemKey = this.mediaCollectionID ? 'filename' : 'collectionID';

    if (
      this.activePersonFilters.length ||
      this.activePlaceFilters.length ||
      this.activeKeywordFilters.length
    ) {
      // Apply filters
      this.galleryData.forEach((item: GalleryItem) => {
        let personOk = false;
        let placeOk = false;
        let keywordOk = false;

        if (this.activePersonFilters.length) {
          for (let f = 0; f < this.activePersonFilters.length; f++) {
            if (this.allMediaConnections['person']?.[this.activePersonFilters[f]]?.[connKey]?.includes(item[itemKey])) {
              personOk = true;
              break;
            } else {
              personOk = false;
            }
          }
        } else {
          personOk = true;
        }

        if (this.activePlaceFilters.length) {
          for (let f = 0; f < this.activePlaceFilters.length; f++) {
            if (this.allMediaConnections['place']?.[this.activePlaceFilters[f]]?.[connKey]?.includes(item[itemKey])) {
              placeOk = true;
              break;
            } else {
              placeOk = false;
            }
          }
        } else {
          placeOk = true;
        }

        if (this.activeKeywordFilters.length) {
          for (let f = 0; f < this.activeKeywordFilters.length; f++) {
            if (this.allMediaConnections['keyword']?.[this.activeKeywordFilters[f]]?.[connKey]?.includes(item[itemKey])) {
              keywordOk = true;
              break;
            } else {
              keywordOk = false;
            }
          }
        } else {
          keywordOk = true;
        }
        
        item.visible = personOk && placeOk && keywordOk;
        if (item.visible) {
          filterResultCount++;
        }
      });
    } else {
      // Clear all filters --> show all collection items
      this.galleryData.forEach((item: GalleryItem) => {
        item.visible = true;
      });
      filterResultCount = -1;
    }

    this.filterResultCount = filterResultCount;
    this.loadingGallery = false;
    this.cdRef.detectChanges();

    if (this.mediaCollectionID) {
      this.setGalleryZoomedImageData();
    }
  }

  private updateURLQueryParameters(params: any) {
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

  onFilterChanged(type: string, event: any) {
    const filters: any[] = [];

    if (type === 'person' && event?.detail?.value?.length) {
      filters.push({ person: event?.detail?.value });
    } else if (type !== 'person' && this.activePersonFilters.length) {
      filters.push({ person: this.activePersonFilters });
    }

    if (type === 'place' && event?.detail?.value?.length) {
      filters.push({ place: event?.detail?.value });
    } else if (type !== 'place' && this.activePlaceFilters.length) {
      filters.push({ place: this.activePlaceFilters });
    }

    if (type === 'keyword' && event?.detail?.value?.length) {
      filters.push({ keyword: event?.detail?.value });
    } else if (type !== 'keyword' && this.activeKeywordFilters.length) {
      filters.push({ keyword: this.activeKeywordFilters });
    }

    this.updateURLQueryParameters(
      {
        filters: filters.length ? this.urlService.stringify(filters, true) : null
      }
    );
  }

  clearActiveFilters() {
    this.updateURLQueryParameters(
      {
        filters: null
      }
    );
  }

  async openImage(imageURL: string) {
    this.loadingImageModal = true;
    this.cdRef.detectChanges();
    let index = 0;

    for(let i = 0; i < this.galleryImageURLs.length; i++) {
      if (imageURL === this.galleryImageURLs[i]) {
        index = i;
        break;
      }
    }

    const params = {
      activeImageIndex: index,
      backsides: this.galleryBacksideImageURLs,
      imageDescriptions: this.galleryDescriptions,
      imageTitles: this.galleryTitles,
      imageURLs: this.galleryImageURLs
    };

    const modal = await this.modalController.create({
      component: FullscreenImageViewerModal,
      componentProps: params,
      cssClass: 'fullscreen-image-viewer-modal',
    });
    
    modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role) {
      this.loadingImageModal = false;
      this.cdRef.detectChanges();
    }
  }

  async showReference() {
    // Get URL of Page and then the URI
    const modal = await this.modalController.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'media-collection' }
    });

    modal.present();
  }

}
