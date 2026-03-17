import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, LOCALE_ID, NgZone, OnInit, Renderer2, afterNextRender, inject, signal, viewChild, viewChildren } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { IonFabButton, IonFabList, IonPopover, ModalController, PopoverController } from '@ionic/angular';
import { distinctUntilChanged, Observable } from 'rxjs';

import { config } from '@config';
import { TextKey, ViewState, ViewType, ViewUid } from '@models/collection.models';
import { Illustration } from '@models/illustration.models';
import { CollectionContentService } from '@services/collection-content.service';
import { CollectionsService } from '@services/collections.service';
import { DocumentHeadService } from '@services/document-head.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { TooltipService } from '@services/tooltip.service';
import { UrlService } from '@services/url.service';
import { ViewOptionsService } from '@services/view-options.service';
import { CollectionTextViewsQueryParamSyncService } from '@services/collection-text-views-query-param-sync.service';
import { RouteStateSourceService } from '@services/route-state-source.service';
import { enableFrontMatterPageOrTextViewType, isBrowser, moveArrayItem } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'page-text',
  templateUrl: './collection-text.page.html',
  styleUrls: ['./collection-text.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionTextPage implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private collectionContentService = inject(CollectionContentService);
  private collectionsService = inject(CollectionsService);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);
  private headService = inject(DocumentHeadService);
  private injector = inject(Injector);
  private modalCtrl = inject(ModalController);
  private ngZone = inject(NgZone);
  private parserService = inject(HtmlParserService);
  private platformService = inject(PlatformService);
  private popoverCtrl = inject(PopoverController);
  private renderer2 = inject(Renderer2);
  private route = inject(ActivatedRoute);
  private routeStateSource = inject(RouteStateSourceService);
  private scrollService = inject(ScrollService);
  private tooltipService = inject(TooltipService);
  private urlService = inject(UrlService);
  private viewsQueryParamSync = inject(CollectionTextViewsQueryParamSyncService);
  protected viewOptionsService = inject(ViewOptionsService);
  private activeLocale = inject(LOCALE_ID);

  readonly addViewPopover = viewChild<IonPopover>('addViewPopover');
  readonly fabColumnOptions = viewChildren<IonFabList>('fabColumnOptions');
  readonly fabColumnOptionsButton = viewChildren<IonFabButton>('fabColumnOptionsButton');

  defaultViews: string[] = config.page?.text?.defaultViews ?? ['readingtext'];
  readonly enableLegacyIDs: boolean = config.collections?.enableLegacyIDs;
  readonly multilingualReadingTextLanguages: string[] = config.app?.i18n?.multilingualReadingTextLanguages ?? [];
  readonly showTextDownloadButton: boolean = config.page?.text?.showTextDownloadButton ?? false;
  readonly showURNButton: boolean = config.page?.text?.showURNButton ?? true;
  readonly showViewOptionsButton: boolean = config.page?.text?.showViewOptionsButton ?? true;
  readonly viewTypes: any = config.page?.text?.viewTypes ?? {};

  private collectionAndPublicationLegacyId: string = '';
  private tooltipVisible: boolean = false;
  private uidCounter: number = 0;
  private userIsTouching: boolean = false;

  private unlistenFirstTouchStartEvent?: () => void;
  private unlistenClickEvents?: () => void;
  private unlistenKeyUpEnterEvents?: () => void;
  private unlistenMouseoverEvents?: () => void;
  private unlistenMouseoutEvents?: () => void;

  protected currentPageTitle$: Observable<string> = this.headService.getCurrentPageTitle();
  protected mobileMode = this.platformService.isMobile();

  activeComponent = signal<boolean>(true);
  activeMobileModeViewIndex = signal<number>(0);
  addViewPopoverisOpen = signal<boolean>(false);
  enabledViewTypes = signal<string[]>([]);
  illustrationsViewShown = signal<boolean>(false);
  infoOverlayPosition = signal<{ bottom: string; left: string }>({
    bottom: '0px',
    left: '-1500px',
  });
  infoOverlayPosType = signal<'fixed' | 'absolute'>('fixed');
  infoOverlayText = signal<string>('');
  infoOverlayTitle = signal<string>('');
  infoOverlayTriggerElem = signal<HTMLElement | null>(null);
  infoOverlayWidth = signal<string | null>(null);
  searchMatches = signal<string[]>([]);
  textKey = signal<TextKey>({ collectionID: '', publicationID: '', textItemID: '' });
  textPosition = signal<string>('');
  toolTipMaxWidth = signal<string | null>(null);
  toolTipPosition = signal<{ top: string; left: string }>({
    top: '0px',
    left: '-1500px'
  });
  toolTipPosType = signal<'fixed' | 'absolute'>('fixed');
  toolTipScaleValue = signal<number | null>(null);
  toolTipText = signal<string>('');
  views = signal<ViewState[]>([]);

  private readonly active$ = toObservable(this.activeComponent).pipe(
    distinctUntilChanged()
  );


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor and lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.adjustDefaultViewsForLocale();
    this.attachDomListeners();
    this.registerCleanup();  
  }

  ngOnInit() {
    this.initRouteSync();  // all route/query param handling
  }

  ionViewWillEnter() {
    this.activeComponent.set(true);
  }

  ionViewWillLeave() {
    this.activeComponent.set(false);
  }

  /**
   * Set the active locale's reading text to first column if
   * multilingual reading texts.
   */
  private adjustDefaultViewsForLocale() {
    if (
      this.multilingualReadingTextLanguages.length > 1 &&
      this.defaultViews[0].startsWith('readingtext_') &&
      this.defaultViews[0] !== 'readingtext_' + this.activeLocale
    ) {
      this.defaultViews = moveArrayItem(
        this.defaultViews,
        this.defaultViews.indexOf('readingtext_' + this.activeLocale),
        0
      );
    }
  }

  /**
   * Wire route + queryParam reactions.
   *
   * Keeps component state in sync with route path params and query params.
   * The `activeComponent` signal is converted to an Observable (`active$`)
   * and used to gate browser-side emissions, so updates run only while this
   * page is active (important with Ionic `IonRouterOutlet` page caching).
   *
   * Route-state retrieval is delegated to a platform-specific source:
   * - Browser: reactive stream of route/query changes, gated by `active$`.
   * - Server (SSR): single snapshot emission for the current request.
   */
  private initRouteSync() {
    this.routeStateSource.get(this.route, this.active$).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ params, queryParams }) => {
      this.onRouteParams(params);
      this.onQueryParams(queryParams);
    });
  }

  private onRouteParams(params: any) {
    // Compute new textItemID to see if route params have changed
    const { collectionID = '', publicationID= '', chapterID = undefined } = params;

    const routeTextItemID: string = chapterID
      ? `${collectionID}_${publicationID}_${chapterID}`
      : `${collectionID}_${publicationID}`;

    if (this.textKey().textItemID !== routeTextItemID) {
      // Route params have changed → update textKey & related state
      const newTextKey: TextKey = {
        collectionID: collectionID ?? '',
        publicationID: publicationID ?? '',
        ...(chapterID ? { chapterID: chapterID } : {}),
        textItemID: routeTextItemID
      };
      this.textKey.set(newTextKey);

      // Save the id of the previous and current read view text in
      // textService.
      this.collectionContentService.previousReadViewTextId = this.collectionContentService.readViewTextId;
      this.collectionContentService.readViewTextId = routeTextItemID;

      if (this.enableLegacyIDs && isBrowser()) {
        this.setCollectionAndPublicationLegacyId(publicationID);
      }

      this.enabledViewTypes.set(this.computeEnabledViewTypes(
        collectionID, this.multilingualReadingTextLanguages
      ));
    }
  }

  private onQueryParams(queryParams: any) {
    // * q = searchMatches
    if (queryParams?.['q']) {
      this.searchMatches.set(
        this.parserService.getSearchMatchesFromQueryParams(queryParams['q'])
      );
    } else {
      this.searchMatches.set([]);
    }

    // * views
    if (queryParams?.['views']) {
      let parsedViews: ViewState[] = this.urlService.parse(queryParams['views'], true);

      const enabledViewTypes = this.enabledViewTypes();

      // If any view type is disabled, drop it
      if (!parsedViews.every((v: ViewState) => enabledViewTypes.includes(v.type))) {
        parsedViews = parsedViews.filter(
          (v: ViewState) => enabledViewTypes.includes(v.type)
        );
      }

      const current = this.views();
      let viewsChanged = current.length !== parsedViews.length;
      if (!viewsChanged) {
        // Check if uid of views have changed to detect reorderings,
        // also detects if uids missing from parsedViews, in case of
        // which they need to be added, i.e. the views have changed.
        // Comparison on the entire view objects doesn't work for
        // texts that have just positions that can change, hence
        // checking only if uids unequal.
        for (let i = 0; i < current.length; i++) {
          if (current[i].uid !== parsedViews[i].uid) {
            viewsChanged = true;
            break;
          }
        }
      }

      if (current.length < 1 || viewsChanged) {
        // Views have changed and need to be updated.
        // Check if the views from query params all have valid uids.
        // If not, create new uids for all of them. If valid, the
        // component’s uid counter is updated to stay in sync.
        const [withUids, addedUids] = this.ensureUids(parsedViews);

        parsedViews = withUids;
        this.views.set(parsedViews);
        this.illustrationsViewShown.set(
          this.viewTypeIsShown('illustrations', parsedViews)
        );

        if (addedUids) {
          // Uids have been added to the view objects -> update queryParams.
          // This only happens if the page loads with the views queryParam,
          // but the view objects are missing uids.
          this.updateViewsInRouterQueryParams(parsedViews, false, true);
        }
      }

      this.cacheRecentViews(parsedViews);
    } else {
      this.setViews();
    }

    // * position
    if (
      queryParams?.['position'] ||
      (
        this.textPosition &&
        queryParams?.['position'] === undefined
      )
    ) {
      this.textPosition.set(queryParams['position']);
    }
  }

  /** Attach DOM listeners once after the first render. */
  private attachDomListeners() {
    afterNextRender({
      write: () => {
        this.setUpTextListeners();
      }
    }, { injector: this.injector });
  }

  private registerCleanup() {
    this.destroyRef.onDestroy(() => {
      this.unlistenClickEvents?.();
      this.unlistenKeyUpEnterEvents?.();
      this.unlistenMouseoverEvents?.();
      this.unlistenMouseoutEvents?.();
      this.unlistenFirstTouchStartEvent?.();
    });
  }

  /**
   * Compute which view types (readingtext, comments, facsimiles ...) should be
   * enabled for this collection.
   * @param collectionID 
   * @param readingtextLanguages 
   * @returns string[]
   */
  private computeEnabledViewTypes(
    collectionID: string,
    readingtextLanguages: string[]
  ): string[] {
    const enabledTypes: string[] = [];

    for (const type in this.viewTypes) {
      if (
        this.viewTypes.hasOwnProperty(type) &&
        enableFrontMatterPageOrTextViewType('text', collectionID, config, type)
      ) {
        if (type === 'readingtext' && readingtextLanguages.length > 1) {
          for (const lang of readingtextLanguages) {
            enabledTypes.push(`${type}_${lang}`);
          }
        } else {
          enabledTypes.push(type);
        }
      }
    }

    return enabledTypes;
  }

  /**
   * Compute default view types, taking into consideration the enabled view
   * types for the current collection.
   * @param enabledViewTypes 
   * @returns
   */
  private computeDefaultViewTypes(enabledViewTypes: string[]): ViewState[] {
    const newViews: ViewState[] = [];

    // Ensure default views are among the enabled view types
    this.defaultViews.forEach((type: string) => {
      if (enabledViewTypes.includes(type)) {
        newViews.push(({ type }) as ViewState);
      }
    });

    if (newViews.length < 1 && enabledViewTypes.length > 0) {
      // All default views are disabled -> just show the first
      // enabled view type
      newViews.push(({ type: enabledViewTypes[0] }) as ViewState);
    }

    return newViews;
  }

  private setViews() {
    // There are no views defined in the url params =>
    // show a) current views if defined,
    //      b) recent view types if defined, or
    //      c) default view types.
    const currentViews = this.views();
    const enabledViewTypes = this.enabledViewTypes();
    let nextViews = currentViews;
    let typesOnly = false;

    if (currentViews.length > 0) {
      // a) show current views
      nextViews = currentViews;
    } else if (this.collectionContentService.recentCollectionTextViews.length > 0) {
      // b) show recent view types
      // if different collection than previously pass type of views only
      typesOnly =
        this.textKey().collectionID !==
        this.collectionContentService.previousReadViewTextId.split('_')[0];

      let newViews = this.collectionContentService.recentCollectionTextViews;

      if (typesOnly) {
        // Make sure the only enabled view types for this collection are added
        // from the recent views. First deep copy the array of view objects and
        // then remove disabled view types from it.
        const recentViewsCopy = newViews.map(v => ({ ...v }));
        // Filter out view objects of disabled types
        newViews = recentViewsCopy.filter(
          (v: ViewState) => enabledViewTypes.includes(v.type)
        );
        // If the new views list is empty, add enabled default views
        if (newViews.length < 1) {
          newViews = this.computeDefaultViewTypes(enabledViewTypes);
        }
      }

      nextViews = this.ensureUids(newViews)[0];
    } else {
      // c) show default view types
      nextViews = this.ensureUids(
        this.computeDefaultViewTypes(enabledViewTypes)
      )[0];
    }

    if (nextViews !== currentViews) {
      this.views.set(nextViews);
    }
    this.cacheRecentViews(nextViews);
    // Keep URL in sync without triggering an extra route cycle.
    this.updateViewsInRouterQueryParams(nextViews, typesOnly, true);
    this.setActiveViewInMobileMode(nextViews);
  }

  private cacheRecentViews(views: ViewState[]) {
    // Clear the array keeping track of recently open views in
    // text service and populate it with the current ones.
    this.collectionContentService.recentCollectionTextViews = [];
    views.forEach((v: ViewState) => {
      const cachedViewObj: ViewState = { type: v.type };
      if (
        v.sortOrder &&
        (
          v.type === 'variants' ||
          v.type === 'facsimiles'
        )
      ) {
        cachedViewObj.sortOrder = v.sortOrder;
      }
      this.collectionContentService.recentCollectionTextViews.push(cachedViewObj);
    });
  }

  /**
   * Set active view in mobile mode.
   */
  private setActiveViewInMobileMode(availableViews: ViewState[]) {
    if (!this.mobileMode) {
      return;
    }

    if (this.collectionContentService.activeCollectionTextMobileModeView !== undefined) {
      this.activeMobileModeViewIndex.set(
        this.collectionContentService.activeCollectionTextMobileModeView
      );
    } else {
      let activeMobileModeViewType = this.defaultViews[0];

      if (
        this.multilingualReadingTextLanguages.length > 1 &&
        activeMobileModeViewType.startsWith('readingtext_')
      ) {
        // Set the default selected mobile mode view to the active
        // locale's reading text if multilingual reading texts
        activeMobileModeViewType = 'readingtext_' + this.activeLocale;
      }

      let idx = availableViews.findIndex(
        (view: ViewState) => view.type === activeMobileModeViewType
      );
      if (idx < 0) {
        idx = 0;
      }
      this.activeMobileModeViewIndex.set(idx);
    }
  }

  private getViewTypesShown(): string[] {
    return this.views().map(v => v.type);
  }

  private viewTypeIsShown(type: string, views?: ViewState[]): boolean {
    const arr = views ?? this.views();
    return arr.findIndex(v => v.type === type) > -1;
  }

  openNewView(event: any) {
    if (event.viewType === 'facsimiles') {
      this.addView(event.viewType, event.id, undefined, true);
    } else if (event.viewType === 'manuscriptFacsimile') {
      this.addView('facsimiles', event.id, undefined, true);
    } else if (event.viewType === 'facsimileManuscript') {
      this.addView('manuscripts', event.id, undefined, true);
    } else if (event.viewType === 'illustrations') {
      this.addView(event.viewType, event.id, event, true);
    } else {
      this.addView(event.viewType, event.id, undefined, true);
    }
  }

  showAllViewTypes() {
    const newViewTypes: string[] = [];
    const viewTypesShown = this.getViewTypesShown();

    this.enabledViewTypes().forEach((type: string) => {
      if (
        type !== 'showAll' &&
        viewTypesShown.indexOf(type) < 0
      ) {
        newViewTypes.push(type);
      }
    });

    for (let i = 0; i < newViewTypes.length; i++) {
      this.addView(newViewTypes[i], undefined, undefined, i > newViewTypes.length - 2);
    }
  }

  addView(type: string, id?: number | null, image?: Illustration, scroll?: boolean) {
    if (type === 'showAll') {
      this.showAllViewTypes();
      return;
    }

    if (this.enabledViewTypes().indexOf(type) < 0) {
      return;
    }

    const newView: ViewState = {
      type: (type as ViewType),
      uid: this.createViewUid()
    };

    if (id != null) {
      newView.id = id;
    }
    if (image != null) {
      newView.image = image;
    }

    // Append the new view to the array of current views and navigate
    const newIndex = this.views().length; // index after append
    this.views.update(arr => [...arr, newView]);
    this.updateViewsInRouterQueryParams(this.views());

    // In mobile mode, set the added view as the active view
    this.setActiveMobileModeViewType(undefined, undefined, newIndex);

    // Conditionally scroll the added view into view
    if (scroll === true && !this.mobileMode) {
      this.scrollService.scrollLastViewIntoView();
    }
  }

  /**
   * Removes the view with index i in the this.views array.
   * @param i index of the view to be removed from this.views.
   */
  removeView(i: number) {
    this.views.update((arr: ViewState[]) => arr.filter((_, idx) => idx !== i));
    this.updateViewsInRouterQueryParams(this.views());

    // In mobile mode, set the next view in the views array
    // as the active view, or the previous view if the deleted
    // one was the last view in the array.
    const index = i < this.views().length ? i : i - 1;
    this.setActiveMobileModeViewType(undefined, undefined, index);
  }

  /**
   * Moves the view with index id one step to the right, i.e. exchange
   * positions with the view on the right.
   */
  moveViewRight(id: number) {
    const views = this.views();
    if (id > -1 && id < views.length - 1) {
      this.views.set(moveArrayItem(views, id, id + 1));
      this.fabColumnOptions()?.forEach(f => (f.activated = false));
      this.fabColumnOptionsButton()?.forEach(b => (b.activated = false));
      this.updateViewsInRouterQueryParams(this.views());
    }
  }

  /**
   * Moves the view with index id one step to the left, i.e. exchange
   * positions with the view on the left.
   */
  moveViewLeft(id: number) {
    const views = this.views();
    if (id > 0 && id < views.length) {
      this.views.set(moveArrayItem(views, id, id - 1));
      this.fabColumnOptions()?.forEach(f => (f.activated = false));
      this.fabColumnOptionsButton()?.forEach(b => (b.activated = false));
      this.updateViewsInRouterQueryParams(this.views());
    }
  }

  updateIllustrationViewImage(image: Illustration | null) {
    const index = this.views().findIndex((v) => v.type === 'illustrations');
    this.updateViewProperty('image', image, index);
    this.setActiveMobileModeViewType(undefined, 'illustrations', index);
  }

  updateViewProperty(
    propertyName: string,
    value: any,
    viewIndex: number,
    updateQueryParams: boolean = true
  ) {
    if (viewIndex < 0 || viewIndex >= this.views().length) {
      return;
    }

    this.views.update((arr: any[]) =>
      arr.map((v, i) => {
        // If the view object is not the one whose property should be updated
        // (based on index), the view object is not modified
        if (i !== viewIndex) {
          return v;
        }
        // Update the value of the property `propertyName` unless value is null
        if (value !== null) {
          return { ...v, [propertyName]: value };
        }
        // Default: value = null => remove the property `propertyName` from the view object
        const { [propertyName]: _drop, ...rest } = v;
        return rest;
      })
    );

    if (updateQueryParams) {
      this.updateViewsInRouterQueryParams(this.views());
    }
  }

  private updateViewsInRouterQueryParams(
    views: ViewState[],
    typesOnly: boolean = false,
    silent: boolean = false
  ) {
    this.illustrationsViewShown.set(this.viewTypeIsShown('illustrations', views));

    let trimmedViews: ViewState[] = [];
    if (typesOnly) {
      // Remove all properties from the view objects except
      // type and uid
      trimmedViews = views.filter(v => !!v.type).map(
        v => ({ type: v.type, uid: v.uid ?? null })
      );
    } else {
      // Remove 'title' property from all view objects
      // as it’s not desired in the url
      trimmedViews = views.map(({ title, ...rest }) => rest);
    }

    const nextViewsParam = this.urlService.stringify(trimmedViews, true);

    this.viewsQueryParamSync.update(nextViewsParam, this.route, silent);
  }

  /**
   * Generates a new monotonically increasing view UID like "v12".
   * Increments the internal `uidCounter` and returns the new value
   * with a "v" prefix.
   *
   * @returns The newly created UID (e.g., "v7").
   * @sideeffect Mutates `this.uidCounter` by incrementing it.
   */
  private createViewUid(): ViewUid {
    return `v${++this.uidCounter}`;
  }

  /**
   * Scans a list of views and returns the largest numeric UID suffix found.
   * UIDs are expected to be of the form "v<number>" (e.g., "v3"). Missing
   * or malformed UIDs are treated as 0.
   *
   * @param views - Array of view-like objects that may contain a `uid`
   * string.
   * @returns The largest numeric UID suffix found (0 if none).
   */
  private getMaxViewUid(views: ViewState[]): number {
    let maxUid = 0;
    views.forEach((v: ViewState) => {
      const uidNumber = Number(v.uid?.slice(1) ?? '0');
      if (uidNumber > maxUid) {
        maxUid = uidNumber;
      }
    });
    return maxUid;
  }

  /**
   * Ensures every view has a stable, unique UID of the form "v<number>".
   *
   * - If *all* input views already have valid UIDs, the original array
   *   is returned unchanged and `addedUids` is `false`. The internal
   *   counter is synced up to the max existing UID so future UIDs won’t
   *   collide.
   * - Otherwise, a *new array* is returned where missing/invalid UIDs
   *   are assigned. In this case, `addedUids` is `true`.
   *
   * This method does **not** mutate the input array; it only creates new
   * objects when UIDs need to be added.
   *
   * @param views - The input views (not mutated).
   * @returns
   *   - `views`: Either the original array (if all had valid UIDs) or a
   *     new array with UIDs assigned.
   *   - `addedUids`: `true` if any UID was newly assigned; `false` if
   *     all were already valid.
   *
   * @sideeffect When all UIDs are present, updates `this.uidCounter` to
   * the max UID found.
   *
   * @example
   * const [normalized, added] = this.ensureUids(items);
   *
   * @example
   * let origViews = input;
   * let added: boolean;
   * [origViews, added] = this.ensureUids(origViews);
   */
  private ensureUids(views: ViewState[]): [views: ViewState[], addedUids: boolean] {
    const allHaveUids = views.every(
      (v: ViewState) => v.uid?.startsWith('v') && !Number.isNaN(Number(v.uid?.slice(1)))
    );

    if (allHaveUids) {
      // keep counter in sync so future adds won’t collide
      const max = this.getMaxViewUid(views as any[]);
      if (max > this.uidCounter) {
        this.uidCounter = max;
      }
      // return the original array and the flag
      return [views, false];
    }

    // assign once; do not mutate the incoming array
    const withUids = views.map(v => ({ ...v, uid: this.createViewUid() }));
    return [withUids as ViewState[], true];
  }

  private setCollectionAndPublicationLegacyId(publicationID: string) {
    this.collectionsService.getLegacyIdByPublicationId(publicationID).subscribe({
      next: (publication: any[]) => {
        this.collectionAndPublicationLegacyId = '';
        if (publication[0].legacy_id) {
          this.collectionAndPublicationLegacyId = publication[0].legacy_id;
        }
      },
      error: (e: any) => {
        this.collectionAndPublicationLegacyId = '';
        console.error('Error: could not get publication data trying to resolve collection and publication legacy id', e);
      }
    });
  }

  setActiveMobileModeViewType(event?: any, type?: string, viewIndex?: number) {
    if (!this.mobileMode) {
      return;
    }

    let index = 0;

    if (event) {
      index = event.detail?.value ?? 0;
    } else {
      index = viewIndex !== undefined
            ? viewIndex
            : this.views().findIndex((v) => v.type === type);
      index = index > -1 ? index : 0;
    }

    this.activeMobileModeViewIndex.set(index);
    this.collectionContentService.activeCollectionTextMobileModeView = index;
  }

  private getEventTarget(event: any) {
    let eventTarget: HTMLElement = document.createElement('div');

    if (event.target?.hasAttribute('data-id')) {
      return event.target;
    }
    try {
      if (event.target) {
        if (
          event.target.classList?.contains('tooltiptrigger')
        ) {
          eventTarget = event.target;
        } else if (
          event.target?.parentNode?.classList?.contains('tooltiptrigger')
        ) {
          eventTarget = event.target.parentNode;
        } else if (
          event.target.parentNode?.classList &&
          event.target.parentNode?.parentNode?.classList?.contains('tooltiptrigger')
        ) {
          eventTarget = event.target.parentNode.parentNode;
        } else if (
          event.target.classList?.contains('anchor')
        ) {
          eventTarget = event.target;
        } else if (
          event.target.classList?.contains('variantScrollTarget')
        ) {
          eventTarget = event.target;
        } else if (
          event.target.parentNode?.classList?.contains('variantScrollTarget')
        ) {
          eventTarget = event.target.parentNode;
        } else if (
          event.target.parentNode?.parentNode?.classList?.contains('variantScrollTarget')
        ) {
          eventTarget = event.target.parentNode.parentNode;
        } else if (
          event.target.classList?.contains('anchorScrollTarget')
        ) {
          eventTarget = event.target;
        } else if (
          event.target.parentNode?.classList?.contains('anchorScrollTarget')
        ) {
          eventTarget = event.target.parentNode;
        } else if (
          event.target.classList?.contains('extVariantsTrigger')
        ) {
          eventTarget = event.target;
        } else if (
          event.target.parentNode?.classList?.contains('extVariantsTrigger')
        ) {
          eventTarget = event.target.parentNode;
        }
      }
    } catch (e) {
      console.error('Error resolving event target in getEventTarget() in CollectionTextPage', e);
    }
    return eventTarget;
  }

  private setUpTextListeners() {
    const nElement: HTMLElement = this.elementRef.nativeElement;

    this.ngZone.runOutsideAngular(() => {

      /* CHECK ONCE IF THE USER IF TOUCHING THE SCREEN */
      this.unlistenFirstTouchStartEvent = this.renderer2.listen(nElement, 'touchstart', (event) => {
        this.userIsTouching = true;
        // Don't listen for keyup enter, mouseover and mouseout
        // events since they should have no effect on touch devices
        this.unlistenKeyUpEnterEvents?.();
        this.unlistenMouseoverEvents?.();
        this.unlistenMouseoutEvents?.();
        this.unlistenFirstTouchStartEvent?.();
      });

      /* KEY UP ENTER EVENTS */
      // For keyboard navigation to work on semantic information in
      // dynamically loaded content we need to convert keyup events
      // on the Enter key to click events, since spans are used for
      // them and they won't natively trigger click events on Enter
      // key hits.
      this.unlistenKeyUpEnterEvents = this.renderer2.listen(nElement, 'keyup.enter', (event) => {
        const keyTarget = event.target as HTMLElement;
        if (
          keyTarget?.tagName !== 'A' &&
          keyTarget?.tagName !== 'BUTTON' &&
          (
            keyTarget?.classList.contains('tooltiptrigger') ||
            keyTarget?.classList.contains('figureP')
          )
        ) {
          keyTarget.click();
        }
      });

      /* CLICK EVENTS */
      this.unlistenClickEvents = this.renderer2.listen(nElement, 'click', (event) => {
        if (!this.userIsTouching) {
          this.ngZone.run(() => this.hideToolTip());
        }

        if (event?.target?.classList.contains('close-info-overlay')) {
          this.ngZone.run(() => this.hideInfoOverlay());
          return;
        }

        let eventTarget = this.getEventTarget(event);
        let modalShown = false;
        const viewOptions = this.viewOptionsService.show();

        // Modal trigger for person-, place- or workinfo and info overlay trigger for footnote and comment.
        // Loop needed for finding correct tooltip trigger when there are nested triggers.
        while (!modalShown && eventTarget['classList'].contains('tooltiptrigger')) {
          if (eventTarget.hasAttribute('data-id')) {
            if (
              eventTarget['classList'].contains('person') &&
              viewOptions.personInfo
            ) {
              this.ngZone.run(() => {
                this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id'), 'subject');
              });
              modalShown = true;
            } else if (
              eventTarget['classList'].contains('placeName') &&
              viewOptions.placeInfo
            ) {
              this.ngZone.run(() => {
                this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id'), 'location');
              });
              modalShown = true;
            } else if (
              eventTarget['classList'].contains('title') &&
              viewOptions.workInfo
            ) {
              this.ngZone.run(() => {
                this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id'), 'work');
              });
              modalShown = true;
            } else if (
              eventTarget['classList'].contains('comment') &&
              viewOptions.comments
            ) {
              // The user has clicked a comment lemma ("asterisk") in the reading-text.
              // Check if comments view is shown.
              const viewTypesShown = this.getViewTypesShown();
              const commentsViewIsShown = viewTypesShown.includes('comments');
              if (commentsViewIsShown && !this.mobileMode) {
                // Scroll to comment in comments view and scroll lemma in reading-text view.
                const numId = eventTarget.getAttribute('data-id').replace( /^\D+/g, '');
                const targetId = 'start' + numId;
                const lemmaStart = this.scrollService.findElementInColumnByAttribute(
                  'data-id', targetId, 'reading-text'
                );

                if (lemmaStart) {
                  // Scroll to start of lemma in reading text and temporarily prepend arrow.
                  this.scrollService.scrollToCommentLemma(lemmaStart);
                  // Scroll to comment in the comments-column.
                  this.scrollService.scrollToComment(numId);
                }
              } else {
                // If a comments view isn't shown or viewmode is mobile,
                // show comment in infoOverlay.
                this.ngZone.run(() => {
                  this.showCommentInfoOverlay(eventTarget.getAttribute('data-id'), eventTarget);
                });
              }
              modalShown = true;
            } else if (
              eventTarget['classList'].contains('ttFoot') &&
              eventTarget['classList'].contains('teiManuscript')
            ) {
              // Footnote reference clicked in manuscript column
              this.ngZone.run(() => {
                this.showFootnoteInfoOverlay(
                  eventTarget.getAttribute('data-id'), 'manuscript', eventTarget
                );
              });
              modalShown = true;
            } else if (eventTarget['classList'].contains('ttFoot')) {
              // Footnote reference clicked in reading text
              this.ngZone.run(() => {
                this.showFootnoteInfoOverlay(
                  eventTarget.getAttribute('data-id'), 'reading-text', eventTarget
                );
              });
              modalShown = true;
            }
          } else if (
            (
              (
                eventTarget['classList'].contains('ttChanges') ||
                eventTarget['classList'].contains('ttEmendations')
               ) &&
              viewOptions.emendations
            ) ||
            (
              eventTarget['classList'].contains('ttNormalisations') &&
              viewOptions.normalisations
            ) ||
            (
              eventTarget['classList'].contains('ttAbbreviations') &&
              viewOptions.abbreviations
            )
          ) {
            this.ngZone.run(() => {
              this.showInfoOverlayFromInlineHtml(eventTarget);
            });
            modalShown = true;
          } else if (
            eventTarget['classList'].contains('ttMs') ||
            eventTarget['classList'].contains('tooltipMs')
          ) {
            if (
              eventTarget['classList'].contains('unclear') ||
              eventTarget['classList'].contains('gap') ||
              eventTarget['classList'].contains('marginalia')
            ) {
              // Editorial note about unclear text or text in margin,
              // should be clickable only in the reading text column.
              let parentElem: any = eventTarget;
              parentElem = parentElem.parentElement;
              while (parentElem !== null && parentElem.tagName !== 'READ-TEXT') {
                parentElem = parentElem.parentElement;
              }
              if (parentElem !== null) {
                this.ngZone.run(() => {
                  this.showInfoOverlayFromInlineHtml(eventTarget);
                });
                modalShown = true;
              }
            }
          } else if (
            eventTarget.hasAttribute('id') &&
            eventTarget['classList'].contains('ttFoot') &&
            eventTarget['classList'].contains('teiVariant')
          ) {
            // Footnote reference clicked in variant.
            this.ngZone.run(() => {
              this.showFootnoteInfoOverlay(
                eventTarget.getAttribute('id'), 'variant', eventTarget
              );
            });
            modalShown = true;
          } else if (
            eventTarget['classList'].contains('ttFoot') &&
            !eventTarget.hasAttribute('id') &&
            !eventTarget.hasAttribute('data-id')
          ) {
            this.ngZone.run(() => {
              this.showInfoOverlayFromInlineHtml(eventTarget);
            });
            modalShown = true;
          } else if (eventTarget['classList'].contains('ttComment')) {
            this.ngZone.run(() => {
              this.showInfoOverlayFromInlineHtml(eventTarget);
            });
            modalShown = true;
          }

          // Get the parent node of the event target for the next iteration
          // if a modal or infoOverlay hasn't been shown already. This is
          // for finding nested tooltiptriggers, i.e. a person can be a
          // child of a change.
          if (!modalShown) {
            eventTarget = eventTarget['parentNode'];
            if (
              !eventTarget['classList'].contains('tooltiptrigger') &&
              eventTarget['parentNode'] &&
              eventTarget['parentNode']['classList'].contains('tooltiptrigger')
            ) {
              // The parent isn't a tooltiptrigger, but the parent of the parent
              // is, use it for the next iteration.
              eventTarget = eventTarget['parentNode'];
            }
          }
        }

        eventTarget = this.getEventTarget(event);
        if (
          (
            eventTarget.classList.contains('variantScrollTarget') ||
            eventTarget.classList.contains('anchorScrollTarget')
          ) &&
          (
            this.viewOptionsService.selectedVariationType() === 'all' ||
            (
              this.viewOptionsService.selectedVariationType() === 'sub' &&
              (
                eventTarget.classList.contains('substantial') ||
                eventTarget.classList.contains('lemma')
              )
            )
          )
        ) {
          // Click on variant lemma --> highlight and scroll all variant columns
          // in desktop mode; display variant info in infoOverlay in mobile mode.
          if (!this.mobileMode) {
            eventTarget.classList.add('highlight');
            this.ngZone.run(() => {
              this.hideToolTip();
              this.scrollService.scrollToVariant(
                eventTarget, this.elementRef.nativeElement
              );
            });
            window.setTimeout(function(elem: any) {
              elem.classList.remove('highlight');
            }.bind(null, eventTarget), 5000);
          } else if (eventTarget.classList.contains('tooltiptrigger')) {
            this.ngZone.run(() => this.showInfoOverlayFromInlineHtml(eventTarget));
          }
        } else if (eventTarget['classList'].contains('extVariantsTrigger')) {
          // Click on trigger for showing links to external variants
          if (eventTarget.nextElementSibling) {
            if (
              eventTarget.nextElementSibling.classList.contains('extVariants') &&
              !eventTarget.nextElementSibling.classList.contains('show-extVariants')
            ) {
              eventTarget.nextElementSibling.classList.add('show-extVariants');
            } else if (
              eventTarget.nextElementSibling.classList.contains('extVariants') &&
              eventTarget.nextElementSibling.classList.contains('show-extVariants')
            ) {
              eventTarget.nextElementSibling.classList.remove('show-extVariants');
            }
          }
        }

        // Possibly click on link.
        eventTarget = event.target as HTMLElement;
        if (!eventTarget?.classList.contains('xreference')) {
          eventTarget = eventTarget.parentElement;
          if (eventTarget) {
            if (!eventTarget.classList.contains('xreference')) {
              eventTarget = eventTarget.parentElement;
            }
          }
        }

        if (eventTarget?.classList.contains('xreference')) {
          event.preventDefault();
          const anchorElem: HTMLAnchorElement = eventTarget as HTMLAnchorElement;

          if (eventTarget.classList.contains('footnoteReference')) {
            // Link to (foot)note reference in the same text.
            let targetId = '';
            if (anchorElem.hasAttribute('href')) {
              targetId = anchorElem.getAttribute('href') || '';
            } else if (anchorElem.parentElement?.hasAttribute('href')) {
              targetId = anchorElem.parentElement.getAttribute('href') || '';
            }

            if (targetId) {
              let targetColumnId = '';
              if (anchorElem.className.includes('targetColumnId_')) {
                for (let i = 0; i < anchorElem.classList.length; i++) {
                  if (anchorElem.classList[i].startsWith('targetColumnId_')) {
                    targetColumnId = anchorElem.classList[i].replace('targetColumnId_', '');
                  }
                }
              }

              // Find the containing scrollable element.
              let containerElem: HTMLElement | null = null;
              if (targetColumnId) {
                containerElem = nElement.querySelector<HTMLElement>('#' + targetColumnId);
              } else {
                containerElem = anchorElem.parentElement;
                while (
                  containerElem?.parentElement &&
                  !containerElem.classList.contains('scroll-content-container')
                ) {
                  containerElem = containerElem.parentElement;
                }
                if (!containerElem?.parentElement) {
                  containerElem = null;
                }
                if (!containerElem) {
                  // Check if a footnotereference link in infoOverlay.
                  // This method is used to find the container element if in mobile mode.
                  if (
                    anchorElem.parentElement?.parentElement?.hasAttribute('class') &&
                    anchorElem.parentElement?.parentElement?.classList.contains('infoOverlayContent')
                  ) {
                    containerElem = nElement.querySelector<HTMLElement>(
                      'ion-content.collection-ion-content.mobile-mode-content .scroll-content-container:not(.visuallyhidden)'
                    );
                  }
                }
              }

              if (containerElem) {
                let dataIdSelector = '[data-id="' + String(targetId).replace('#', '') + '"]';
                if (anchorElem.classList.contains('teiVariant')) {
                  // Link to (foot)note reference in variant, uses id-attribute instead of data-id.
                  dataIdSelector = '[id="' + String(targetId).replace('#', '') + '"]';
                }
                const target = containerElem.querySelector<HTMLElement>(dataIdSelector);
                if (target) {
                  this.scrollService.scrollToHTMLElement(target, 'top');
                }
              }
            }
          } else if (anchorElem.classList.contains('ref_variant')) {
            // Click on link to another variant text
            const sid = 'sid-' + anchorElem.href.split(';sid-')[1];
            const varTargets = Array.from(document.querySelectorAll('#' + sid));

            if (varTargets.length > 0) {
              this.scrollService.scrollElementIntoView(anchorElem);
              anchorElem.classList.add('highlight');
              window.setTimeout(function(elem: any) {
                elem.classList.remove('highlight');
              }.bind(null, anchorElem), 5000);

              varTargets.forEach((varTarget: any) => {
                this.scrollService.scrollElementIntoView(varTarget);
                if (varTarget.firstElementChild?.classList.contains('var_margin')) {
                  const marginElem = varTarget.firstElementChild;

                  // Highlight all children of the margin element that have the ref_variant class
                  const refVariants = Array.from(marginElem.querySelectorAll('.ref_variant'));
                  refVariants.forEach((refVariant: any) => {
                    refVariant.classList.add('highlight');
                    window.setTimeout(function(elem: any) {
                      elem.classList.remove('highlight');
                    }.bind(null, refVariant), 5000);
                  });

                  if (marginElem.firstElementChild?.classList.contains('extVariantsTrigger')) {
                    marginElem.firstElementChild.classList.add('highlight');
                    window.setTimeout(function(elem: any) {
                      elem.classList.remove('highlight');
                    }.bind(null, marginElem.firstElementChild), 5000);
                  }
                }
              });
            }

          } else if (anchorElem.classList.contains('ref_external')) {
            // Link to external web page, open in new window/tab.
            if (anchorElem.hasAttribute('href')) {
              window.open(anchorElem.href, '_blank');
            }

          } else {
            // Link to a reading text, comment or introduction.
            // Get the href parts for the targeted text.
            const hrefLink = anchorElem.href.replace('_', ' ');
            const hrefTargetItems: string[] = decodeURIComponent(
              String(hrefLink).split('/').pop() || ''
            ).trim().split(' ');
            let targetCollId = '';
            let targetPubId = '';
            let targetChapterId = '';
            let targetPositionId = '';
            const textKey = this.textKey();

            if (
              anchorElem.classList.contains('ref_readingtext') ||
              anchorElem.classList.contains('ref_comment')
            ) {
              // Link to reading text or comment.

              let comparePageId = '';

              if (hrefTargetItems.length === 1 && hrefTargetItems[0].startsWith('#')) {
                // If only a position starting with a hash, assume it's
                // in the same collection, text and chapter.
                comparePageId = textKey.textItemID;
              } else if (hrefTargetItems.length > 1) {
                targetCollId = hrefTargetItems[0];
                targetPubId = hrefTargetItems[1];
                comparePageId = targetCollId + '_' + targetPubId;
                if (hrefTargetItems.length > 2 && !hrefTargetItems[2].startsWith('#')) {
                  targetChapterId = hrefTargetItems[2];
                  comparePageId += '_' + targetChapterId;
                }
              }

              let legacyPageId = this.collectionAndPublicationLegacyId;
              if (legacyPageId && textKey?.chapterID) {
                legacyPageId += '_' + textKey.chapterID;
              }

              // Check if we are already on the same page.
              if (
                (comparePageId === textKey.textItemID || comparePageId === legacyPageId) &&
                hrefTargetItems[hrefTargetItems.length - 1].startsWith('#')
              ) {
                // We are on the same page and the last item in the target href is a textposition.
                targetPositionId = hrefTargetItems[hrefTargetItems.length - 1].replace('#', '');

                // Find element in the correct column (reading-text or comments) based on ref type.
                let refType = 'reading-text';
                if (anchorElem.classList.contains('ref_comment')) {
                  refType = 'comments';
                }
                const addViewType = (refType === 'reading-text') ? 'readingtext' : refType;

                if (
                  !nElement.querySelector(
                    'page-text:not([ion-page-hidden]):not(.ion-page-hidden) ' + refType
                  )
                ) {
                  // The target column type needs to be opened first
                  this.ngZone.run(() => {
                    this.addView(addViewType, undefined, undefined, true);
                    this.setActiveMobileModeViewType(undefined, addViewType);
                  });

                  // The added view needs to be rendered before looking for
                  // matching elements again -> timeout.
                  // TODO: ideally get rid of setTimeout for this functionality
                  setTimeout(() => {
                    let targetElement = this.scrollService.findElementInColumnByAttribute(
                      'name', targetPositionId, refType
                    );
                    if (targetElement?.classList.contains('anchor')) {
                      this.scrollService.scrollToHTMLElement(targetElement);
                    }
                  }, 700);
                } else {
                  if (!this.mobileMode) {
                    let targetElement = this.scrollService.findElementInColumnByAttribute(
                      'name', targetPositionId, refType
                    );
                    if (targetElement?.classList.contains('anchor')) {
                      this.scrollService.scrollToHTMLElement(targetElement);
                    }
                  } else {
                    this.ngZone.run(() => {
                      this.setActiveMobileModeViewType(undefined, addViewType);
                    });
                    setTimeout(() => {
                      let targetElement = this.scrollService.findElementInColumnByAttribute(
                        'name', targetPositionId, refType
                      );
                      if (targetElement?.classList.contains('anchor')) {
                        this.scrollService.scrollToHTMLElement(targetElement);
                      }
                    }, 700);
                  }
                }
              } else {
                // We are not on the same page, open in new window.
                // (Safari on iOS doesn't allow window.open() inside async calls so
                // we have to open the new window first and set its location later.)
                const newWindowRef = window.open();

                this.collectionsService.getCollectionAndPublicationByLegacyId(
                  targetCollId + '_' + targetPubId
                ).subscribe(
                  (data: any) => {
                    if (data?.length && data[0]['coll_id'] && data[0]['pub_id']) {
                      targetCollId = data[0]['coll_id'];
                      targetPubId = data[0]['pub_id'];
                    }

                    let hrefString = '/collection/' + targetCollId + '/text/' + targetPubId;
                    if (targetChapterId) {
                      hrefString += '/' + targetChapterId;
                      if (hrefTargetItems.length > 3 && hrefTargetItems[3].startsWith('#')) {
                        targetPositionId = hrefTargetItems[3].replace('#', '');
                        hrefString += '?position=' + targetPositionId;
                      }
                    } else if (hrefTargetItems.length > 2 && hrefTargetItems[2].startsWith('#')) {
                      targetPositionId = hrefTargetItems[2].replace('#', '');
                      hrefString += '?position=' + targetPositionId;
                    }
                    if (newWindowRef) {
                      newWindowRef.location.href = '/' + this.activeLocale + hrefString;
                    }
                  }
                );
              }

            } else if (anchorElem.classList.contains('ref_introduction')) {
              // Link to introduction, open in new window/tab.
              targetCollId = hrefTargetItems[0];

              const newWindowRef = window.open();

              this.collectionsService.getCollectionAndPublicationByLegacyId(
                targetCollId
              ).subscribe(
                (data: any) => {
                  if (data?.length && data[0]['coll_id']) {
                    targetCollId = data[0]['coll_id'];
                  }
                  let hrefString = '/collection/' + targetCollId + '/introduction';
                  if (hrefTargetItems.length > 1 && hrefTargetItems[1].startsWith('#')) {
                    targetPositionId = hrefTargetItems[1].replace('#', '');
                    hrefString += '?position=' + targetPositionId;
                  }
                  // Open the link in a new window/tab.
                  if (newWindowRef) {
                    newWindowRef.location.href = '/' + this.activeLocale + hrefString;
                  }
                }
              );
            }
          }
        }
      });

      /* MOUSE OVER EVENTS */
      this.unlistenMouseoverEvents = this.renderer2.listen(nElement, 'mouseover', (event) => {
        // Mouseover effects only if using a cursor, not if the user is touching the screen
        if (this.userIsTouching) {
          return;
        }

        let eventTarget = this.getEventTarget(event);
        const viewOptions = this.viewOptionsService.show();

        // Loop needed for finding correct tooltip trigger when there are nested triggers.
        while (!this.tooltipVisible && eventTarget['classList'].contains('tooltiptrigger')) {
          if (eventTarget.hasAttribute('data-id')) {
            if (
              eventTarget['classList'].contains('person') &&
              viewOptions.personInfo
            ) {
              this.ngZone.run(() => {
                this.showSemanticDataObjectTooltip(eventTarget.getAttribute('data-id'), 'person', eventTarget);
              });
            } else if (
              eventTarget['classList'].contains('placeName') &&
              viewOptions.placeInfo
            ) {
              this.ngZone.run(() => {
                this.showSemanticDataObjectTooltip(eventTarget.getAttribute('data-id'), 'place', eventTarget);
              });
            } else if (
              eventTarget['classList'].contains('title') &&
              viewOptions.workInfo
            ) {
              this.ngZone.run(() => {
                this.showSemanticDataObjectTooltip(eventTarget.getAttribute('data-id'), 'work', eventTarget);
              });
            } else if (
              eventTarget['classList'].contains('comment') &&
              viewOptions.comments
            ) {
              this.ngZone.run(() => {
                this.showCommentTooltip(eventTarget.getAttribute('data-id'), eventTarget);
              });
            } else if (
              eventTarget['classList'].contains('teiManuscript') &&
              eventTarget['classList'].contains('ttFoot')
            ) {
              this.ngZone.run(() => {
                this.showFootnoteTooltip(eventTarget.getAttribute('data-id'), 'manuscript', eventTarget);
              });
            } else if (eventTarget['classList'].contains('ttFoot')) {
              this.ngZone.run(() => {
                this.showFootnoteTooltip(eventTarget.getAttribute('data-id'), 'reading-text', eventTarget);
              });
            }
          } else if (
            (
              (
                eventTarget['classList'].contains('ttChanges') ||
                eventTarget['classList'].contains('ttEmendations')
              ) &&
              viewOptions.emendations
            ) || (
              eventTarget['classList'].contains('ttNormalisations') &&
              viewOptions.normalisations
            ) || (
              eventTarget['classList'].contains('ttAbbreviations') &&
              viewOptions.abbreviations
            )
          ) {
            this.ngZone.run(() => {
              this.showTooltipFromInlineHtml(eventTarget);
            });
          } else if (
            eventTarget['classList'].contains('ttVariant') &&
            this.viewOptionsService.selectedVariationType() !== 'none'
          ) {
            this.ngZone.run(() => {
              this.showVariantTooltip(eventTarget);
            });
          } else if (eventTarget['classList'].contains('ttMs')) {
            // Check if the tooltip trigger element is in a manuscripts column
            // since ttMs should generally only be triggered there.
            if (
              eventTarget['classList'].contains('unclear') ||
              eventTarget['classList'].contains('gap') ||
              eventTarget['classList'].contains('marginalia')
            ) {
              // Tooltips for text with class unclear, gap or marginalia should be shown in other columns too.
              this.ngZone.run(() => {
                this.showTooltipFromInlineHtml(eventTarget);
              });
            } else {
              let parentElem: HTMLElement | null = eventTarget as HTMLElement;
              parentElem = parentElem.parentElement;
              while (parentElem !== null && parentElem?.tagName !== 'MANUSCRIPTS') {
                parentElem = parentElem.parentElement;
              }
              if (parentElem) {
                this.ngZone.run(() => {
                  this.showTooltipFromInlineHtml(eventTarget);
                });
              }
            }
          } else if (
            eventTarget.hasAttribute('id') &&
            eventTarget['classList'].contains('teiVariant') &&
            eventTarget['classList'].contains('ttFoot')
          ) {
            this.ngZone.run(() => {
              this.showFootnoteTooltip(
                eventTarget.getAttribute('id'), 'variant', eventTarget
              );
            });
          } else if (
            (
              eventTarget['classList'].contains('ttFoot') ||
              eventTarget['classList'].contains('ttComment')
            ) &&
            !eventTarget.hasAttribute('id') &&
            !eventTarget.hasAttribute('data-id')
          ) {
            this.ngZone.run(() => this.showTooltipFromInlineHtml(eventTarget));
          }

          /* Get the parent node of the event target for the next iteration if a tooltip hasn't been shown already.
          * This is for finding nested tooltiptriggers, i.e. a person can be a child of a change. */
          if (!this.tooltipVisible) {
            eventTarget = eventTarget['parentNode'];
            if (
              !eventTarget['classList'].contains('tooltiptrigger') &&
              eventTarget['parentNode']['classList'].contains('tooltiptrigger')
            ) {
              /* The parent isn't a tooltiptrigger, but the parent of the parent is, use it for the next iteration. */
              eventTarget = eventTarget['parentNode'];
            }
          }
        }

        /* Check if mouse over doodle image which has a parent tooltiptrigger */
        if (
          eventTarget.hasAttribute('data-id') &&
          eventTarget['classList'].contains('doodle') &&
          eventTarget['classList'].contains('unknown') &&
          eventTarget['parentNode'] &&
          eventTarget['parentNode']['classList'].contains('tooltiptrigger')
        ) {
          eventTarget = eventTarget['parentNode'];
          this.ngZone.run(() => this.showTooltipFromInlineHtml(eventTarget));
        }
      });

      /* MOUSE OUT EVENTS */
      this.unlistenMouseoutEvents = this.renderer2.listen(nElement, 'mouseout', (event) => {
        if (!this.userIsTouching && this.tooltipVisible) {
          this.ngZone.run(() => this.hideToolTip());
        }
      });

    });
  }

  private showSemanticDataObjectTooltip(id: string, type: string, targetElem: HTMLElement) {
    this.tooltipService.getSemanticDataObjectTooltip(id, type, targetElem).subscribe(
      (text: string) => {
        this.setToolTipPosition(targetElem, text);
        this.setToolTipText(text);
      }
    );
  }

  private showFootnoteTooltip(id: string, textType: string, targetElem: HTMLElement) {
    this.tooltipService.getFootnoteTooltip(id, textType, targetElem).subscribe(
      (footnoteHTML: string) => {
        if (footnoteHTML) {
          this.setToolTipPosition(targetElem, footnoteHTML);
          this.setToolTipText(footnoteHTML);
        }
      }
    );
  }

  /**
   * This function is used for showing tooltips for emendations,
   * normalisations, abbreviations and explanations in manuscripts.
   */
  private showTooltipFromInlineHtml(targetElem: HTMLElement) {
    if (targetElem.nextElementSibling?.classList.contains('tooltip')) {
      const html = targetElem.nextElementSibling.innerHTML;
      this.setToolTipPosition(targetElem, html);
      this.setToolTipText(html);
    }
  }

  private showCommentTooltip(id: string, targetElem: HTMLElement) {
    this.tooltipService.getCommentTooltip(this.textKey(), id).subscribe({
      next: (tooltip: any) => {
        this.setToolTipPosition(targetElem, tooltip.description);
        this.setToolTipText(tooltip.description);
      },
      error: (e: any) => {
        const noInfoFound = $localize`:@@NamedEntity.NoInfoFound:Ingen information hittades.`;
        this.setToolTipPosition(targetElem, noInfoFound);
        this.setToolTipText(noInfoFound);
      }
    });
  }

  private showVariantTooltip(targetElem: HTMLElement) {
    if (
      this.viewOptionsService.selectedVariationType() === 'sub' &&
      !targetElem.classList.contains('substantial')
    ) {
      return;
    }

    const sib = targetElem.nextElementSibling;
    if (
      sib?.classList.contains('tooltip') &&
      sib?.textContent
    ) {
      this.setToolTipPosition(targetElem, sib.textContent);
      this.setToolTipText(sib.textContent);
    }
  }

  private showFootnoteInfoOverlay(id: string, textType: string, targetElem: HTMLElement) {
    this.tooltipService.getFootnoteTooltip(id, textType, targetElem).subscribe(
      (footnoteHTML: string) => {
        if (footnoteHTML) {
          this.setInfoOverlayTitle($localize`:@@ViewOptions.Note:Not`);
          this.setInfoOverlayPositionAndWidth(targetElem);
          this.setInfoOverlayText(footnoteHTML);
        }
      }
    );
  }

  private showCommentInfoOverlay(id: string, targetElem: HTMLElement) {
    this.tooltipService.getCommentTooltip(this.textKey(), id).subscribe({
      next: (tooltip: any) => {
        this.setInfoOverlayTitle($localize`:@@ViewOptions.ExplanatoryNote:Punktkommentar`);
        this.setInfoOverlayPositionAndWidth(targetElem);
        this.setInfoOverlayText(tooltip.description);
      },
      error: (errorC: any) => {
        this.setInfoOverlayTitle($localize`:@@ViewOptions.ExplanatoryNote:Punktkommentar`);
        this.setInfoOverlayPositionAndWidth(targetElem);
        this.setInfoOverlayText($localize`:@@NamedEntity.NoInfoFound:Ingen information hittades.`);
      }
    });
  }

  /**
   * This function is used for showing infoOverlays for emendations,
   * normalisations and abbreviations, and also comments if they
   * are present inline in the text.
   */
  private showInfoOverlayFromInlineHtml(targetElem: HTMLElement) {
    if (!targetElem.nextElementSibling?.classList.contains('tooltip')) {
      return;
    }

    let text = '';
    let lemma = '';

    if (targetElem.nextElementSibling.classList.contains('ttChanges')) {
      // Change.
      this.setInfoOverlayTitle($localize`:@@ViewOptions.Emendation:Utgivarändring`);
      if (targetElem.classList.contains('corr_red')) {
        lemma = targetElem.innerHTML;
      } else if (targetElem.firstElementChild?.classList.contains('corr_hide')) {
        lemma = '<span class="corr_hide">' + targetElem.firstElementChild.innerHTML + '</span>';
      } else if (targetElem.firstElementChild?.classList.contains('corr')) {
        lemma = targetElem.firstElementChild.innerHTML;
      }
      text = '<p class="infoOverlayText"><span class="ioLemma">'
        + lemma + '</span><span class="ioDescription">'
        + targetElem.nextElementSibling.innerHTML + '</span></p>';
    } else if (targetElem.nextElementSibling.classList.contains('ttNormalisations')) {
      // Normalisation.
      this.setInfoOverlayTitle($localize`:@@ViewOptions.Normalisation:Normalisering`);
      if (targetElem.classList.contains('reg_hide')) {
        lemma = '<span class="reg_hide">' + targetElem.innerHTML + '</span>';
      } else {
        lemma = targetElem.innerHTML;
      }
      text = '<p class="infoOverlayText"><span class="ioLemma">'
        + lemma + '</span><span class="ioDescription">'
        + targetElem.nextElementSibling.innerHTML + '</span></p>';
    } else if (targetElem.nextElementSibling.classList.contains('ttAbbreviations')) {
      // Abbreviation.
      this.setInfoOverlayTitle($localize`:@@ViewOptions.Abbreviation:Förkortning`);
      if (targetElem.firstElementChild?.classList.contains('abbr')) {
        text = '<p class="infoOverlayText"><span class="ioLemma">'
          + targetElem.firstElementChild.innerHTML
          + '</span><span class="ioDescription">'
          + targetElem.nextElementSibling.innerHTML + '</span></p>';
      }
    } else if (targetElem.nextElementSibling.classList.contains('ttComment')) {
      // Comment.
      this.setInfoOverlayTitle($localize`:@@ViewOptions.ExplanatoryNote:Punktkommentar`);
      if (targetElem.nextElementSibling?.classList.contains('noteText')) {
        text = '<p class="infoOverlayText"><span class="ioDescription">'
          + targetElem.nextElementSibling.innerHTML + '</span></p>';
      }
    } else if (
      targetElem.classList.contains('ttFoot') &&
      targetElem.nextElementSibling?.classList.contains('ttFoot')
    ) {
      // Some other note coded as a footnote (but lacking id and data-id attributes).
      if (targetElem.nextElementSibling.firstElementChild?.classList.contains('ttFixed')) {
        if (targetElem.classList.contains('revision')) {
          this.setInfoOverlayTitle($localize`:@@ViewOptions.RevisionNote:Repetitionsanteckning`);
          lemma = '';
        } else {
          this.setInfoOverlayTitle('');
          lemma = '<span class="ioLemma">' + targetElem.innerHTML + '</span>';
        }
        text = '<p class="infoOverlayText">'
          + lemma + '<span class="ioDescription">'
          + targetElem.nextElementSibling.firstElementChild.innerHTML + '</span></p>';
      }
    } else {
      // Some other note, generally editorial remarks pertaining to a manuscript.
      if (targetElem.classList.contains('ttMs')) {
        this.setInfoOverlayTitle($localize`:@@ViewOptions.EditorialNote:Utgivarens anmärkning`);
      } else if (targetElem.classList.contains('ttVariant')) {
        this.setInfoOverlayTitle($localize`:@@Variants.VariantCategory:Variantkategori`);
      } else {
        this.setInfoOverlayTitle('');
      }
      lemma = targetElem.textContent || '';
      if (
        targetElem.classList.contains('deletion') || (
          targetElem.parentElement !== null &&
          targetElem.classList.contains('tei_deletion_medium_wrapper')
        )
      ) {
        lemma = '<span class="deletion">' + lemma + '</span>';
      }
      text = '<p class="infoOverlayText"><span class="ioLemma">'
        + lemma + '</span><span class="ioDescription">'
        + targetElem.nextElementSibling.innerHTML + '</span></p>';
    }
    this.setInfoOverlayPositionAndWidth(targetElem);
    this.setInfoOverlayText(text);
  }

  private setToolTipText(text: string) {
    this.toolTipText.set(text);
  }

  private setInfoOverlayText(text: string) {
    this.infoOverlayText.set(text);
  }

  private setInfoOverlayTitle(title: string) {
    this.infoOverlayTitle.set(String(title));
  }

  private hideToolTip() {
    this.setToolTipText('');
    this.toolTipPosType.set('fixed'); // Position needs to be fixed so we can safely hide it outside viewport
    this.toolTipPosition.set({
      top: 0 + 'px',
      left: -1500 + 'px'
    });
    this.tooltipVisible = false;
  }

  hideInfoOverlay() {
    // Clear info overlay content and move it out of viewport
    this.setInfoOverlayText('');
    this.setInfoOverlayTitle('');
    this.infoOverlayPosType.set('fixed'); // Position needs to be fixed so we can safely hide it outside viewport
    this.infoOverlayPosition.set({
      bottom: 0 + 'px',
      left: -1500 + 'px'
    });

    // Return focus to element that triggered the info overlay,
    // with timeout so the info overlay isn't triggered again
    // on keyup.enter event
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.infoOverlayTriggerElem()?.focus({ preventScroll: true });
        this.infoOverlayTriggerElem.set(null);
      }, 250);
    });
  }

  private setToolTipPosition(targetElem: HTMLElement, ttText: string) {
    const ttProp = this.tooltipService.getTooltipProperties(
      targetElem, ttText, 'page-text'
    );
    if (!ttProp) {
      return;
    }

    // Set tooltip width, position and visibility
    this.toolTipMaxWidth.set(ttProp.maxWidth);
    this.toolTipScaleValue.set(ttProp.scaleValue);
    this.toolTipPosition.set({
      top: ttProp.top,
      left: ttProp.left
    });
    const posType = this.mobileMode ? 'fixed' : 'absolute';
    this.toolTipPosType.set(posType);
    this.tooltipVisible = true;
  }

  /**
   * Set position and width of infoOverlay element. This function is not exactly
   * the same as in introduction.ts due to different page structure on text page.
   */
  private setInfoOverlayPositionAndWidth(
    triggerElement: HTMLElement,
    defaultMargins = 20,
    maxWidth = 600
  ) {
    // Store triggering element so focus can later be restored to it
    this.infoOverlayTriggerElem.set(triggerElement);
  
    let margins = defaultMargins;

    // Get viewport height and width.
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    // Get text page content element and adjust viewport height with horizontal
    // scrollbar height if such is present. Also get how much the text page has
    // scrolled horizontally to the left.
    let scrollLeft = 0;
    let horizontalScrollbarOffsetHeight = 0;
    const contentElem = this.elementRef.nativeElement.querySelector(
      'ion-content.collection-ion-content'
    )?.shadowRoot?.querySelector('[part="scroll"]') as HTMLElement;
    if (contentElem) {
      scrollLeft = contentElem.scrollLeft;
      if (contentElem.clientHeight < contentElem.offsetHeight) {
        horizontalScrollbarOffsetHeight = contentElem.offsetHeight - contentElem.clientHeight;
      }
    }

    // Get bounding rectangle of the div.scroll-content-container element which is the
    // container for the column that the trigger element resides in.
    let containerElem = triggerElement.parentElement;
    while (
      containerElem?.parentElement &&
      !containerElem.classList.contains('scroll-content-container')
    ) {
      containerElem = containerElem.parentElement;
    }

    if (containerElem?.parentElement) {
      const containerElemRect = containerElem.getBoundingClientRect();
      let calcWidth = containerElem.clientWidth; // Width without scrollbar

      if (this.mobileMode && vw > 800) {
        // Adjust width in mobile view when viewport size over 800 px
        // since padding changes through CSS then.
        margins = margins + 16;
      }

      if (calcWidth > maxWidth + 2 * margins) {
        margins = Math.floor((calcWidth - maxWidth) / 2);
        calcWidth = maxWidth;
      } else {
        calcWidth = calcWidth - 2 * margins;
      }

      // Set info overlay position
      this.infoOverlayPosition.set({
        bottom: (vh - horizontalScrollbarOffsetHeight - containerElemRect.bottom) + 'px',
        left: (containerElemRect.left + scrollLeft + margins - contentElem.getBoundingClientRect().left) + 'px'
      });

      const posType = this.mobileMode ? 'fixed' : 'absolute';
      this.infoOverlayPosType.set(posType);

      // Set info overlay width
      this.infoOverlayWidth.set(`${calcWidth}px`);

      // Set focus to info overlay
      const ioElem = this.elementRef.nativeElement.querySelector(
        '.infoOverlay'
      ) as HTMLElement;
      ioElem?.focus();
    }
  }

  private async showSemanticDataObjectModal(id: string, type: string) {
    const { NamedEntityModal } = await import('@modals/named-entity/named-entity.modal');
    const modal = await this.modalCtrl.create({
      component: NamedEntityModal,
      componentProps: { id, type }
    });

    modal.present();
  }

  async showViewOptionsPopover(event: any) {
    const { ViewOptionsPopover } = await import('@popovers/view-options/view-options.popover');
    const popover = await this.popoverCtrl.create({
      component: ViewOptionsPopover,
      cssClass: 'view-options-popover',
      reference: 'trigger',
      side: 'bottom',
      alignment: 'end'
    });

    popover.present(event);
  }

  async showReference() {
    const { ReferenceDataModal } = await import('@modals/reference-data/reference-data.modal');
    // Get URL of Page and then the URI
    const modal = await this.modalCtrl.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-text' }
    });

    modal.present();
  }

  async showDownloadModal() {
    const { DownloadTextsModal } = await import('@modals/download-texts/download-texts.modal');
    const modal = await this.modalCtrl.create({
      component: DownloadTextsModal,
      componentProps: { origin: 'page-text', textKey: this.textKey() }
    });

    modal.present();
  }

  showAddViewPopover(e: Event) {
    const popover = this.addViewPopover();
    if (popover) {
      popover.event = e;
      this.addViewPopoverisOpen.set(true);
    }
  }

  dismissAddViewPopover() {
    this.addViewPopoverisOpen.set(false);
  }

  /**
   * Opens a new reading text view and scrolls the given comment lemma into view.
   * @param commentLemmaId 
   */
  openNewReadingTextShowCommentLemma(commentLemmaId: string) {
    this.openNewView({ viewType: 'readingtext' });
    this.setActiveMobileModeViewType(undefined, 'readingtext');

    setTimeout(() => {
      const lemmaStart = this.scrollService.findElementInColumnByAttribute(
        'data-id', commentLemmaId, 'reading-text'
      );
      this.scrollService.scrollToCommentLemma(lemmaStart);
    }, 700);
  }

}
