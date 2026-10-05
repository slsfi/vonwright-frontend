import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, LOCALE_ID, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToolbar,
  ModalController
} from '@ionic/angular';
import { combineLatest, forkJoin, map, of, Subscription, switchMap } from 'rxjs';

import { GalleryThumbImageComponent } from '@components/gallery-thumb-image/gallery-thumb-image.component';
import { config } from '@config';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { GalleryItem } from '@models/gallery-item-models';
import { MediaCollection } from '@models/media-collection.models';
import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { DocumentHeadService } from '@services/document-head.service';
import { FacsimileImageService } from '@services/facsimile-image.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { UrlService } from '@services/url.service';
import { isEmptyObject, sortArrayOfObjectsAlphabetically, sortArrayOfObjectsNumerically } from '@utility-functions';


@Component({
  selector: 'page-media-collection',
  templateUrl: './media-collection.page.html',
  styleUrls: ['./media-collection.page.scss'],
  imports: [
    GalleryThumbImageComponent,
    IonButton,
    IonButtons,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonIcon,
    IonRow,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonToolbar,
    NgTemplateOutlet,
    RouterLink,
    TrustHtmlPipe
  ]
})
export class MediaCollectionPage implements OnDestroy, OnInit {
  private destroyRef = inject(DestroyRef);
  private headService = inject(DocumentHeadService);
  private mdService = inject(MarkdownService);
  private mediaCollectionService = inject(MediaCollectionService);
  private modalController = inject(ModalController);
  private facsimileImageService = inject(FacsimileImageService);
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

  readonly activeKeywordFilters = signal<number[]>([]);
  readonly activePersonFilters = signal<number[]>([]);
  readonly activePlaceFilters = signal<number[]>([]);
  private allMediaCollections: GalleryItem[] = [];
  private allMediaConnections: any = {};
  readonly filterOptionsKeywords = signal<any[]>([]);
  readonly filterOptionsPersons = signal<any[]>([]);
  readonly filterOptionsPlaces = signal<any[]>([]);
  private filterOptionsSubscription: Subscription | null = null;
  private galleryThumbObjectURLsByID: Record<string, string | null> = {};
  private galleryThumbResolutionSubscription: Subscription | null = null;
  readonly galleryThumbResolvedURLsByID = signal<Record<string, string>>({});
  readonly filterResultCount = signal(-1);
  private galleryBacksideImageURLs: (string | undefined)[] = [];
  readonly galleryData = signal<GalleryItem[]>([]);
  private galleryDescriptions: (string | undefined)[] = [];
  private galleryImageURLs: (string | undefined)[] = [];
  private galleryTitles: (string | undefined)[] = [];
  readonly loadingGallery = signal(true);
  readonly loadingImageModal = signal(false);
  readonly mdContent = toSignal(
    this.route.params.pipe(
      map(params => params['mediaCollectionID']),
      switchMap(mediaCollectionID => mediaCollectionID === 'entity'
        ? of(null)
        : this.mdService.getParsedMdContent(
            `${this.activeLocale}-11-${mediaCollectionID || 'all'}`
          )
      )
    ),
    { initialValue: null }
  );
  readonly mediaCollectionID = signal<string | undefined>(undefined);
  readonly mediaCollectionDescription = signal('');
  readonly mediaCollectionTitle = signal('');
  readonly namedEntityID = signal('');
  private namedEntityType = '';

  ngOnInit() {
    combineLatest(
      [this.route.params, this.route.queryParams]
    ).pipe(
      map(([params, queryParams]) => ({...params, ...queryParams})),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((routeParams: any) => {
      if (
        (isEmptyObject(routeParams) && this.mediaCollectionID() !== '') ||
        (
          !routeParams.mediaCollectionID &&
          (
            routeParams.filters ||
            !routeParams.filters &&
            (
              this.activePersonFilters().length ||
              this.activePlaceFilters().length ||
              this.activeKeywordFilters().length
            )
          )
        )
      ) {
        // Load all media collections
        this.loadingGallery.set(true);
        const shouldSetFilters = this.mediaCollectionID() !== '';
        this.mediaCollectionID.set('');
        this.namedEntityID.set('');
        this.mediaCollectionTitle.set($localize`:@@MainSideMenu.MediaCollections:Bildbank`);
        this.mediaCollectionDescription.set('');

        if (routeParams.filters) {
          this.setActiveFiltersFromQueryParams(routeParams.filters);
        } else {
          this.activePersonFilters.set([]);
          this.activePlaceFilters.set([]);
          this.activeKeywordFilters.set([]);
        }

        if (this.allMediaCollections.length < 1) {
          this.loadMediaCollections();
        } else {
          this.clearGalleryThumbResolution();
          this.galleryData.set(this.allMediaCollections);
          this.resolveGalleryThumbURLs();
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
          routeParams.mediaCollectionID !== this.mediaCollectionID() ||
          routeParams.filters ||
          !routeParams.filters &&
          (
            this.activePersonFilters().length ||
            this.activePlaceFilters().length ||
            this.activeKeywordFilters().length
          )
        )
      ) {
        // Load single media collection
        if (routeParams.filters) {
          this.setActiveFiltersFromQueryParams(routeParams.filters);
        } else {
          this.activePersonFilters.set([]);
          this.activePlaceFilters.set([]);
          this.activeKeywordFilters.set([]);
        }

        if (routeParams.mediaCollectionID !== this.mediaCollectionID()) {
          this.loadingGallery.set(true);
          this.mediaCollectionID.set(routeParams.mediaCollectionID);
          this.loadSingleMediaCollection(routeParams.mediaCollectionID);
        } else {
          this.mediaCollectionID.set(routeParams.mediaCollectionID);
          this.applyActiveFilters();
        }
        this.namedEntityID.set('');
      } else if (
        routeParams.mediaCollectionID === 'entity' &&
        routeParams.id &&
        routeParams.type
      ) {
        // Load specific images related to a named entity
        this.loadingGallery.set(true);
        this.mediaCollectionID.set('entity');
        this.namedEntityID.set(routeParams.id);
        this.namedEntityType = routeParams.type;
        this.loadNamedEntityGallery(this.namedEntityID(), this.namedEntityType);
      }
    });
  }

  ngOnDestroy() {
    this.filterOptionsSubscription?.unsubscribe();
    this.clearGalleryThumbResolution();
  }

  private loadMediaCollections() {
    this.clearGalleryThumbResolution();
    this.galleryData.set([]);

    this.mediaCollectionService.getMediaCollections(this.activeLocale).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (collections: MediaCollection[]) => {
        this.allMediaCollections = this.getTransformedGalleryData(collections);
        this.galleryData.set(this.allMediaCollections);
        this.resolveGalleryThumbURLs();
        this.setFilterOptionsAndApplyActiveFilters();
      }
    );
  }

  private loadSingleMediaCollection(mediaCollectionID: string) {
    this.clearGalleryThumbResolution();
    this.galleryData.set([]);

    // Get all media collections if not yet loaded, set current collection title and description
    if (this.allMediaCollections.length < 1) {
      this.mediaCollectionService.getMediaCollections(this.activeLocale).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(
        (collections: MediaCollection[]) => {
          for (let i = 0; i < collections.length; i++) {
            if (collections[i].id === Number(mediaCollectionID)) {
              this.mediaCollectionTitle.set(collections[i].title || '');
              this.mediaCollectionDescription.set(collections[i].description || '');
              break;
            }
          }
          this.allMediaCollections = this.getTransformedGalleryData(collections);
        }
      );
    } else {
      for (let i = 0; i < this.allMediaCollections.length; i++) {
        if (this.allMediaCollections[i].collectionID === Number(mediaCollectionID)) {
          this.mediaCollectionTitle.set(this.allMediaCollections[i].title || '');
          this.mediaCollectionDescription.set(this.allMediaCollections[i].description || '');
          break;
        }
      }
    }

    // Get selected media collection data, then filter options and apply any active filters
    this.mediaCollectionService.getSingleMediaCollection(mediaCollectionID, this.activeLocale).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (galleryItems: any[]) => {
        this.galleryData.set(this.getTransformedGalleryData(galleryItems, true));
        this.resolveGalleryThumbURLs();
        this.setFilterOptionsAndApplyActiveFilters();
      }
    );
  }

  private loadNamedEntityGallery(objectID: string, objectType: string) {
    this.clearGalleryThumbResolution();
    this.mediaCollectionService.getNamedEntityOccInMediaColls(objectType, objectID).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (occurrences: any) => {
        this.galleryData.set(this.getTransformedGalleryData(occurrences, true));
        this.resolveGalleryThumbURLs();

        if (objectType === 'person') {
          this.mediaCollectionTitle.set(occurrences[0]['full_name']);
          this.mediaCollectionDescription.set('');
        } else {
          this.mediaCollectionTitle.set(occurrences[0]['name']);
          this.mediaCollectionDescription.set('');
        }

        this.headService.setTitle([this.mediaCollectionTitle(), $localize`:@@MainSideMenu.MediaCollections:Bildbank`]);

        this.loadingGallery.set(false);
        this.setGalleryZoomedImageData();
      }
    );
  }

  private clearGalleryThumbResolution() {
    this.galleryThumbResolutionSubscription?.unsubscribe();
    this.galleryThumbResolutionSubscription = null;

    Object.values(this.galleryThumbObjectURLsByID).forEach((objectURL: string | null) => {
      this.facsimileImageService.revokeObjectURL(objectURL);
    });
    this.galleryThumbObjectURLsByID = {};
    this.galleryThumbResolvedURLsByID.set({});
  }

  private resolveGalleryThumbURLs() {
    // TODO(hydration): Gallery thumbnail components use `ngSkipHydration` on
    // their hosts as a temporary safeguard. In auth-enabled mode, browser rendering
    // may replace URL src with a blob URL after bootstrap. When client hydration
    // is enabled in this app, make initial SSR/client src deterministic and then
    // remove the skip marker.
    // We resolve via FacsimileImageService so authenticated image requests can
    // go through HttpClient + interceptors instead of plain <img src> fetching.
    this.clearGalleryThumbResolution();

    this.galleryThumbResolutionSubscription = new Subscription();
    this.galleryData().forEach((item: GalleryItem) => {
      const subscription = this.facsimileImageService.resolveImageSrc(item.imageURLThumb ?? null).subscribe((resolvedImage) => {
        this.galleryThumbObjectURLsByID[item.id] = resolvedImage.objectURL;
        this.galleryThumbResolvedURLsByID.update(urls => ({
          ...urls,
          [item.id]: resolvedImage.src
        }));
      });
      this.galleryThumbResolutionSubscription?.add(subscription);
    });
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

    this.galleryData().forEach((element: GalleryItem) => {
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
    this.activePersonFilters.set([]);
    this.activePlaceFilters.set([]);
    this.activeKeywordFilters.set([]);

    parsedActiveFilters.forEach((filterGroup: any) => {
      if (filterGroup.person?.length) {
        this.activePersonFilters.set(filterGroup.person);
      }

      if (filterGroup.place?.length) {
        this.activePlaceFilters.set(filterGroup.place);
      }
      
      if (filterGroup.keyword?.length) {
        this.activeKeywordFilters.set(filterGroup.keyword);
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
          'keyword', this.mediaCollectionID()
        ),
        this.mediaCollectionService.getAllNamedEntityOccInMediaCollsByType(
          'person', this.mediaCollectionID()
        ),
        this.mediaCollectionService.getAllNamedEntityOccInMediaCollsByType(
          'place', this.mediaCollectionID()
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
      this.filterOptionsPersons.set(filterOptions);
    } else if (type === 'place') {
      this.filterOptionsPlaces.set(filterOptions);
    } else if (type === 'keyword') {
      this.filterOptionsKeywords.set(filterOptions);
    }
  }

  private applyActiveFilters() {
    let filterResultCount = 0;
    const mediaCollectionID = this.mediaCollectionID();
    const activePersonFilters = this.activePersonFilters();
    const activePlaceFilters = this.activePlaceFilters();
    const activeKeywordFilters = this.activeKeywordFilters();
    const galleryData = this.galleryData();
    const connKey = mediaCollectionID ? 'filenames' : 'mediaCollectionIDs';
    const itemKey = mediaCollectionID ? 'filename' : 'collectionID';

    if (
      activePersonFilters.length ||
      activePlaceFilters.length ||
      activeKeywordFilters.length
    ) {
      // Apply filters
      galleryData.forEach((item: GalleryItem) => {
        let personOk = false;
        let placeOk = false;
        let keywordOk = false;

        if (activePersonFilters.length) {
          for (let f = 0; f < activePersonFilters.length; f++) {
            if (this.allMediaConnections['person']?.[activePersonFilters[f]]?.[connKey]?.includes(item[itemKey])) {
              personOk = true;
              break;
            } else {
              personOk = false;
            }
          }
        } else {
          personOk = true;
        }

        if (activePlaceFilters.length) {
          for (let f = 0; f < activePlaceFilters.length; f++) {
            if (this.allMediaConnections['place']?.[activePlaceFilters[f]]?.[connKey]?.includes(item[itemKey])) {
              placeOk = true;
              break;
            } else {
              placeOk = false;
            }
          }
        } else {
          placeOk = true;
        }

        if (activeKeywordFilters.length) {
          for (let f = 0; f < activeKeywordFilters.length; f++) {
            if (this.allMediaConnections['keyword']?.[activeKeywordFilters[f]]?.[connKey]?.includes(item[itemKey])) {
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
      galleryData.forEach((item: GalleryItem) => {
        item.visible = true;
      });
      filterResultCount = -1;
    }

    this.galleryData.set([...galleryData]);
    this.filterResultCount.set(filterResultCount);
    this.loadingGallery.set(false);

    if (mediaCollectionID) {
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
    const activePersonFilters = this.activePersonFilters();
    const activePlaceFilters = this.activePlaceFilters();
    const activeKeywordFilters = this.activeKeywordFilters();

    if (type === 'person' && event?.detail?.value?.length) {
      filters.push({ person: event?.detail?.value });
    } else if (type !== 'person' && activePersonFilters.length) {
      filters.push({ person: activePersonFilters });
    }

    if (type === 'place' && event?.detail?.value?.length) {
      filters.push({ place: event?.detail?.value });
    } else if (type !== 'place' && activePlaceFilters.length) {
      filters.push({ place: activePlaceFilters });
    }

    if (type === 'keyword' && event?.detail?.value?.length) {
      filters.push({ keyword: event?.detail?.value });
    } else if (type !== 'keyword' && activeKeywordFilters.length) {
      filters.push({ keyword: activeKeywordFilters });
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
    this.loadingImageModal.set(true);
    let index = 0;

    for(let i = 0; i < this.galleryImageURLs.length; i++) {
      if (imageURL === this.galleryImageURLs[i]) {
        index = i;
        break;
      }
    }

    const params = {
      startImageIndex: index,
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
      this.loadingImageModal.set(false);
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
