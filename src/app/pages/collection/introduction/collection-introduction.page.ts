import { NgClass, NgStyle } from '@angular/common';
import { Component, DestroyRef, ElementRef, LOCALE_ID, OnDestroy, OnInit, Renderer2, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
  ModalController,
  PopoverController
} from '@ionic/angular';
import { Subscription, catchError, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { config } from '@config';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { CollectionsService } from '@services/collections.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { TooltipService } from '@services/tooltip.service';
import { ViewOptionsService } from '@services/view-options.service';
import { RouteStateSourceService } from '@services/route-state-source.service';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'page-introduction',
  templateUrl: './collection-introduction.page.html',
  styleUrls: ['./collection-introduction.page.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
    NgClass,
    NgStyle,
    TextChangerComponent,
    TrustHtmlPipe
  ]
})
export class CollectionIntroductionPage implements OnInit, OnDestroy {
  private collectionContentService = inject(CollectionContentService);
  private collectionsService = inject(CollectionsService);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);
  private modalCtrl = inject(ModalController);
  private parserService = inject(HtmlParserService);
  private platformService = inject(PlatformService);
  private popoverCtrl = inject(PopoverController);
  private renderer2 = inject(Renderer2);
  private tooltipService = inject(TooltipService);
  private route = inject(ActivatedRoute);
  private routeStateSource = inject(RouteStateSourceService);
  private router = inject(Router);
  private scrollService = inject(ScrollService);
  viewOptionsService = inject(ViewOptionsService);
  private activeLocale = inject(LOCALE_ID);

  readonly legacyIDsEnabled: boolean = config.collections?.enableLegacyIDs ?? false;
  readonly replaceImageAssetsPaths: boolean = config.collections?.replaceImageAssetsPaths ?? true;
  readonly separateIntroTocEnabled: boolean = config.page?.introduction?.hasSeparateTOC ?? false;
  readonly showTextDownloadButton: boolean = config.page?.introduction?.showTextDownloadButton ?? false;
  readonly showURNButton: boolean = config.page?.introduction?.showURNButton ?? true;
  readonly showViewOptionsButton: boolean = config.page?.introduction?.showViewOptionsButton ?? true;
  readonly activeComponent = signal(true);
  readonly showSeparateIntroToc = signal(false);
  readonly infoOverlayPosition = signal({
    bottom: 0 + 'px',
    left: -1500 + 'px'
  });
  readonly infoOverlayPosType = signal('fixed');
  readonly infoOverlayText = signal('');
  readonly infoOverlayTitle = signal('');
  readonly infoOverlayTriggerElem = signal<HTMLElement | null>(null);
  readonly infoOverlayWidth = signal<string | null>(null);
  readonly mobileMode = this.platformService.isMobile();
  readonly text = signal('');
  readonly textLoading = signal(true);
  readonly textMenu = signal('');
  readonly tocMenuOpen = signal(false);
  readonly toolTipMaxWidth = signal<string | null>(null);
  readonly toolTipPosition = signal({
    top: 0 + 'px',
    left: -1500 + 'px'
  });
  readonly toolTipPosType = signal('fixed');
  readonly toolTipScaleValue = signal<number | null>(null);
  readonly toolTipText = signal('');
  readonly viewOptionsTogglesIntro: Record<string, boolean>;

  private readonly active$ = toObservable(this.activeComponent);
  private collectionID: string = '';
  private collectionLegacyId: string = '';
  private intervalTimerId?: number;
  private legacyIdSubscription?: Subscription;
  private pos: string | null = null;
  private restoreInfoOverlayFocusTimer?: ReturnType<typeof setTimeout>;
  private searchMatches: string[] = [];
  private tooltipVisible: boolean = false;
  private unlistenClickEvents?: () => void;
  private unlistenKeyUpEnterEvents?: () => void;
  private unlistenMouseoverEvents?: () => void;
  private unlistenMouseoutEvents?: () => void;
  private unlistenFirstTouchStartEvent?: () => void;
  private userIsTouching: boolean = false;

  constructor() {
    const configuredToggles = config.page?.introduction?.viewOptions;
    if (!configuredToggles || Object.keys(configuredToggles).length === 0) {
      this.viewOptionsTogglesIntro = {
        'comments': false,
        'personInfo': false,
        'placeInfo': false,
        'workInfo': false,
        'emendations': false,
        'normalisations': false,
        'abbreviations': false,
        'paragraphNumbering': true,
        'pageBreakOriginal': false,
        'pageBreakEdition': false
      };
    } else {
      this.viewOptionsTogglesIntro = {
        ...configuredToggles,
        comments: false,
        emendations: false,
        normalisations: false,
        abbreviations: false,
        pageBreakOriginal: false
      };
    }
  }

  /**
   * Keep the introduction in sync with route and query parameters while this
   * Ionic page is active. Position-only changes scroll the already loaded
   * introduction; a new collection ID resets the page and starts a new content
   * request. `switchMap` cancels an older request if route reuse changes the
   * collection again before that request completes.
   */
  ngOnInit() {
    this.routeStateSource.get(this.route, this.active$).pipe(
      map(({ params, queryParams }) => ({ ...params, ...queryParams })),
      tap(routeParams => {
        // Position and search terms come from query parameters and affect what
        // happens after the introduction has been rendered.
        this.pos = routeParams['position'] ?? null;
        this.searchMatches = routeParams['q']
          ? this.parserService.getSearchMatchesFromQueryParams(routeParams['q'])
          : [];

        // The collection content is already loaded, so a route update for the
        // same collection only needs to move to the requested position.
        if (
          routeParams['collectionID'] &&
          routeParams['collectionID'] === this.collectionID
        ) {
          this.scrollToPos(100);
        }
      }),
      map(routeParams => routeParams['collectionID']),
      filter((collectionID): collectionID is string => Boolean(collectionID)),
      distinctUntilChanged(),
      tap(collectionID => this.prepareIntroductionLoad(collectionID)),
      switchMap(collectionID => this.collectionContentService.getIntroduction(
        collectionID,
        this.activeLocale
      ).pipe(
        map((res: any) => this.parseIntroductionResponse(res)),
        catchError((e: any) => {
          console.error(e);
          return of(this.getIntroductionLoadError());
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => this.applyIntroductionResult(result));

    if (isBrowser()) {
      this.setUpTextListeners();
    }
  }

  ngOnDestroy() {
    this.clearScrollInterval();
    if (this.restoreInfoOverlayFocusTimer !== undefined) {
      clearTimeout(this.restoreInfoOverlayFocusTimer);
    }
    this.legacyIdSubscription?.unsubscribe();
    this.unlistenClickEvents?.();
    this.unlistenKeyUpEnterEvents?.();
    this.unlistenMouseoverEvents?.();
    this.unlistenMouseoutEvents?.();
    this.unlistenFirstTouchStartEvent?.();
  }

  ionViewWillEnter() {
    this.activeComponent.set(true);
  }

  ionViewWillLeave() {
    this.activeComponent.set(false);
    this.clearScrollInterval();
  }

  private clearScrollInterval() {
    if (this.intervalTimerId !== undefined) {
      clearInterval(this.intervalTimerId);
      this.intervalTimerId = undefined;
    }
  }

  /** Reset collection-specific state before loading a reused page. */
  private prepareIntroductionLoad(collectionID: string) {
    this.collectionID = collectionID;
    this.collectionLegacyId = '';
    this.text.set('');
    this.textMenu.set('');
    this.textLoading.set(true);
    this.showSeparateIntroToc.set(false);
    this.tocMenuOpen.set(false);

    if (this.legacyIDsEnabled) {
      this.setCollectionLegacyId(collectionID);
    }
  }

  /**
   * Normalize the API response and split an embedded introduction TOC from the
   * main text. Whether the extracted TOC is displayed is controlled separately
   * by the static `separateIntroTocEnabled` configuration flag.
   */
  private parseIntroductionResponse(res: any) {
    if (!res?.content || res.content === 'File not found') {
      return this.getIntroductionLoadError();
    }

    // Fix paths for images before inserting the response into the page.
    let textContent = this.replaceImageAssetsPaths
      ? res.content.replace(/src="images\//g, 'src="assets/images/')
      : res.content;

    // Find the introduction's table of contents, copy it to the separate menu,
    // and remove it from the main introduction text.
    // TODO: This manipulation could be moved to HtmlParserService/htmlparser2.
    const pattern = /<div data-id="content">(.*?)<\/div>/s;
    const matches = textContent.match(pattern);
    const textMenu = matches?.[1] ?? '';
    if (matches) {
      textContent = textContent.replace(pattern, '');
    }

    return {
      showSeparateIntroToc: Boolean(matches) && this.separateIntroTocEnabled,
      text: this.parserService.insertSearchMatchTags(textContent, this.searchMatches),
      textMenu
    };
  }

  /** Create the common visible state for missing or failed introduction data. */
  private getIntroductionLoadError() {
    return {
      showSeparateIntroToc: false,
      text: $localize`:@@CollectionIntroduction.None:Inledningen kunde inte laddas.`,
      textMenu: ''
    };
  }

  /**
   * Publish the completed load to the template and then scroll to either the
   * requested position or the first highlighted search match. A separate TOC
   * opens by default on desktop but remains closed on mobile.
   */
  private applyIntroductionResult(result: {
    showSeparateIntroToc: boolean;
    text: string;
    textMenu: string;
  }) {
    this.text.set(result.text);
    this.textMenu.set(result.textMenu);
    this.textLoading.set(false);
    this.showSeparateIntroToc.set(result.showSeparateIntroToc);
    this.tocMenuOpen.set(result.showSeparateIntroToc && !this.mobileMode);

    // Try to scroll to a position in the text or first search match.
    if (this.pos) {
      this.scrollToPos();
    } else if (this.searchMatches.length) {
      this.clearScrollInterval();
      this.intervalTimerId = this.scrollService.scrollToFirstSearchMatch(
        this.elementRef.nativeElement
      );
    }
  }

  /**
   * Try to scroll to an element in the text, checks if this.pos
   * is null. Interval, to give text some time to load on the page.
   * */
  private scrollToPos(timeout: number = 1000) {
    if (isBrowser()) {
      const that = this;
      let iterationsLeft = 10;
      this.clearScrollInterval();
      this.intervalTimerId = window.setInterval(function() {
        if (iterationsLeft < 1) {
          that.clearScrollInterval();
        } else {
          iterationsLeft -= 1;
          if (that.pos !== undefined && that.pos !== null) {
            // Look for position in name attributes
            let posElem: HTMLElement | null = that.elementRef.nativeElement.querySelector(
              '[name="' + that.pos + '"]'
            );
            if (posElem) {
              const parentElem = posElem.parentElement;
              if (parentElem) {
                if (
                  parentElem.classList.contains('ttFixed') ||
                  parentElem.parentElement?.classList?.contains('ttFixed')
                ) {
                  // Anchor is in footnote --> look for next occurence
                  // since the first footnote element is not displayed
                  // (footnote elements are copied to a list at the
                  // end of the introduction and that's the position
                  // we need to find).
                  posElem = that.elementRef.nativeElement.querySelectorAll(
                    '[name="' + that.pos + '"]'
                  )[1] as HTMLElement;
                }
              }
              if (posElem && !posElem.classList?.contains('anchor')) {
                posElem = null;
              }
            } else {
              // Look for position in data-id attributes
              posElem = that.elementRef.nativeElement.querySelector(
                '[data-id="' + that.pos + '"]'
              );
            }
            if (posElem) {
              if (
                posElem.classList?.contains('anchor') ||
                posElem.classList?.contains('footnoteindicator')
              ) {
                that.scrollService.scrollToHTMLElement(posElem, 'top');
              } else {
                that.scrollService.scrollElementIntoView(posElem, 'top');
              }
              that.clearScrollInterval();
            }
          } else {
            that.clearScrollInterval();
          }
        }
      }.bind(this), timeout);
    }
  }

  private setCollectionLegacyId(id: string) {
    this.legacyIdSubscription?.unsubscribe();
    this.legacyIdSubscription = this.collectionsService.getLegacyIdByCollectionId(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (collection: any[]) => {
        this.collectionLegacyId = '';
        if (collection[0]?.legacy_id) {
          this.collectionLegacyId = collection[0].legacy_id;
        }
      },
      error: () => {
        this.collectionLegacyId = '';
        console.log('could not get collection data trying to resolve collection legacy id');
      }
    });
  }

  private setUpTextListeners() {
    const nElement: HTMLElement = this.elementRef.nativeElement;

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
        keyTarget?.classList.contains('tooltiptrigger')
      ) {
        keyTarget.click();
      }
    });

    /* CLICK EVENTS */
    this.unlistenClickEvents = this.renderer2.listen(nElement, 'click', (event) => {
      if (!this.userIsTouching) {
        this.hideToolTip();
      }

      if (event?.target?.classList.contains('close-info-overlay')) {
        this.hideInfoOverlay();
        return;
      }

      let eventTarget = this.getEventTarget(event);

      // Modal trigger for person-, place- or workinfo and info overlay trigger for footnote.
      if (
        eventTarget.classList.contains('tooltiptrigger') &&
        eventTarget.hasAttribute('data-id')
      ) {
        const viewOptions = this.viewOptionsService.show();
        if (
          eventTarget.classList.contains('person') &&
          viewOptions.personInfo
        ) {
          this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id') || '', 'subject');
        } else if (
          eventTarget.classList.contains('placeName') &&
          viewOptions.placeInfo
        ) {
          this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id') || '', 'location');
        } else if (
          eventTarget.classList.contains('title') &&
          viewOptions.workInfo
        ) {
          this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id') || '', 'work');
        } else if (eventTarget.classList.contains('ttFoot')) {
          this.showFootnoteInfoOverlay(eventTarget.getAttribute('data-id') || '', eventTarget);
        }
      }

      // Possibly click on link.
      eventTarget = event.target as HTMLElement;
      if (eventTarget !== null && !eventTarget.classList.contains('xreference')) {
        if (eventTarget.parentElement) {
          eventTarget = eventTarget.parentElement;
          if (!eventTarget.classList.contains('xreference') && eventTarget.parentElement) {
            eventTarget = eventTarget.parentElement;
          }
        }
      }

      // Links in the introduction.
      if (eventTarget?.classList.contains('xreference')) {
        event.preventDefault();
        const anchorElem: HTMLAnchorElement = eventTarget as HTMLAnchorElement;

        if (anchorElem.classList.contains('ref_external')) {
          // Link to external web page, open in new window/tab.
          if (anchorElem.hasAttribute('href')) {
            window.open(anchorElem.href, '_blank');
          }

        } else if (
          anchorElem.classList.contains('ref_readingtext') ||
          anchorElem.classList.contains('ref_comment') ||
          anchorElem.classList.contains('ref_introduction')
        ) {
          // Link to reading text, comment or introduction.
          // Get the href parts for the targeted text.
          const link = anchorElem.href;
          const hrefTargetItems: Array<string> = decodeURIComponent(
            String(link).split('/').pop() || ''
          ).trim().split(' ');
          let publicationId = '';
          let textId = '';
          let chapterId = '';
          let positionId = '';

          if (
            anchorElem.classList.contains('ref_readingtext') ||
            anchorElem.classList.contains('ref_comment')
          ) {
            // Link to reading text or comment, open in new window.
            const newWindowRef = window.open();

            publicationId = hrefTargetItems[0];
            textId = hrefTargetItems[1];
            this.collectionsService.getCollectionAndPublicationByLegacyId(
              publicationId + '_' + textId
            ).pipe(
              takeUntilDestroyed(this.destroyRef)
            ).subscribe({
              next: (data: any) => {
                if (data?.length && data[0]['coll_id'] && data[0]['pub_id']) {
                  publicationId = data[0]['coll_id'];
                  textId = data[0]['pub_id'];
                }

                if (hrefTargetItems.length > 2 && !hrefTargetItems[2].startsWith('#')) {
                  chapterId = hrefTargetItems[2];
                }

                let hrefString = '/collection/' + publicationId + '/text/' + textId;
                if (chapterId) {
                  hrefString += '/' + chapterId;
                  if (hrefTargetItems.length > 3 && hrefTargetItems[3].startsWith('#')) {
                    positionId = hrefTargetItems[3].replace('#', '');
                    hrefString += '?position=' + positionId;
                  }
                } else if (hrefTargetItems.length > 2 && hrefTargetItems[2].startsWith('#')) {
                  positionId = hrefTargetItems[2].replace('#', '');
                  hrefString += '?position=' + positionId;
                }
                if (newWindowRef) {
                  newWindowRef.location.href = '/' + this.activeLocale + hrefString;
                }
              }
            });

          } else if (anchorElem.classList.contains('ref_introduction')) {
            // Link to introduction.
            if (hrefTargetItems.length === 1 && hrefTargetItems[0].startsWith('#')) {
              // If only a position starting with a hash, assume it's in the same publication.
              publicationId = this.collectionID;
              positionId = hrefTargetItems[0];
            } else {
              publicationId = hrefTargetItems[0];
            }
            if (
              hrefTargetItems.length > 1 &&
              hrefTargetItems[hrefTargetItems.length - 1].startsWith('#')
            ) {
              positionId = hrefTargetItems[hrefTargetItems.length - 1];
            }

            // Check if we are already on the same page.
            if (
              (
                String(publicationId) === String(this.collectionID) ||
                String(publicationId) === String(this.collectionLegacyId)
              ) && positionId !== undefined 
            ) {
              // Same introduction.
              positionId = positionId.replace('#', '');
              if (positionId !== this.pos) {
                this.router.navigate(
                  [],
                  {
                    relativeTo: this.route,
                    queryParams: { position: positionId },
                    queryParamsHandling: 'merge'
                  }
                );
              } else {
                this.scrollToPos(100);
              }
            } else {
              // Different introduction, open in new window.
              const newWindowRef = window.open();
              this.collectionsService.getCollectionAndPublicationByLegacyId(
                publicationId
              ).pipe(
                takeUntilDestroyed(this.destroyRef)
              ).subscribe({
                next: (data: any) => {
                  if (data?.length && data[0]['coll_id']) {
                    publicationId = data[0]['coll_id'];
                  }
                  let hrefString = '/collection/' + publicationId + '/introduction';
                  if (hrefTargetItems.length > 1 && hrefTargetItems[1].startsWith('#')) {
                    positionId = hrefTargetItems[1].replace('#', '');
                    hrefString += '?position=' + positionId;
                  }
                  if (newWindowRef) {
                    newWindowRef.location.href = '/' + this.activeLocale + hrefString;
                  }
                }
              });
            }
          }
        } else if (anchorElem.classList.contains('ref_illustration')) {
          const imageNumber = anchorElem.hash.split('#')[1];
          this.showIllustrationModal(imageNumber);
        } else {
          // Link in the introduction's TOC or link to (foot)note reference
          let targetId = '' as any;
          if (anchorElem.hasAttribute('href')) {
            targetId = anchorElem.getAttribute('href');
          } else if (anchorElem.parentElement?.hasAttribute('href')) {
            targetId = anchorElem.parentElement.getAttribute('href');
          }
          targetId = String(targetId).replace('#', '');
          const dataIdSelector = '[data-id="' + targetId + '"]';
          const target = nElement.querySelector(dataIdSelector) as HTMLElement;
          if (target !== null) {
            if (targetId !== this.pos) {
              this.router.navigate(
                [],
                {
                  relativeTo: this.route,
                  queryParams: { position: targetId },
                  queryParamsHandling: 'merge'
                }
              );
            } else {
              this.scrollToPos(100);
            }
          }
        }
      }
    });

    /* MOUSE OVER EVENTS */
    this.unlistenMouseoverEvents = this.renderer2.listen(nElement, 'mouseover', (event) => {
      if (!this.userIsTouching) {
        // Mouseover effects only if using a cursor, not if the user is touching the screen
        const eventTarget = this.getEventTarget(event) as any;

        if (
          eventTarget.classList.contains('tooltiptrigger') &&
          eventTarget.hasAttribute('data-id')
        ) {
          const show = this.viewOptionsService.show();
          if (
            eventTarget.classList.contains('person') &&
            show.personInfo
          ) {
            this.showSemanticDataObjectTooltip(
              eventTarget.getAttribute('data-id'), 'person', eventTarget
            );
          } else if (
            eventTarget.classList.contains('placeName') &&
            show.placeInfo
          ) {
            this.showSemanticDataObjectTooltip(
              eventTarget.getAttribute('data-id'), 'place', eventTarget
            );
          } else if (
            eventTarget.classList.contains('title') &&
            show.workInfo
          ) {
            this.showSemanticDataObjectTooltip(
              eventTarget.getAttribute('data-id'), 'work', eventTarget
            );
          } else if (eventTarget.classList.contains('ttFoot')) {
            this.showFootnoteTooltip(
              eventTarget.getAttribute('data-id'), eventTarget
            );
          }
        }
      }
    });

    /* MOUSE OUT EVENTS */
    this.unlistenMouseoutEvents = this.renderer2.listen(nElement, 'mouseout', () => {
      if (!this.userIsTouching && this.tooltipVisible) {
        this.hideToolTip();
      }
    });
  }

  showSemanticDataObjectTooltip(id: string, type: string, targetElem: HTMLElement) {
    this.tooltipService.getSemanticDataObjectTooltip(id, type, targetElem).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (text) => {
        this.setToolTipPosition(targetElem, text);
        this.setToolTipText(text);
      }
    );
  }

  showFootnoteTooltip(id: string, targetElem: HTMLElement) {
    this.tooltipService.getFootnoteTooltip(id, 'introduction', targetElem).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (footnoteHTML: string) => {
        if (footnoteHTML) {
          this.setToolTipPosition(targetElem, footnoteHTML);
          this.setToolTipText(footnoteHTML);
        }
      }
    );
  }

  showFootnoteInfoOverlay(id: string, targetElem: HTMLElement) {
    this.tooltipService.getFootnoteTooltip(id, 'introduction', targetElem).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (footnoteHTML: string) => {
        if (footnoteHTML) {
          this.setInfoOverlayTitle($localize`:@@ViewOptions.Note:Not`);
          this.setInfoOverlayPositionAndWidth(targetElem);
          this.setInfoOverlayText(footnoteHTML);
        }
      }
    );
  }

  setToolTipPosition(targetElem: HTMLElement, ttText: string) {
    const ttProperties = this.tooltipService.getTooltipProperties(targetElem, ttText, 'page-introduction');

    if (ttProperties !== undefined && ttProperties !== null) {
      // Set tooltip width, position and visibility
      this.toolTipMaxWidth.set(ttProperties.maxWidth);
      this.toolTipScaleValue.set(ttProperties.scaleValue);
      this.toolTipPosition.set({
        top: ttProperties.top,
        left: ttProperties.left
      });
      this.toolTipPosType.set(this.mobileMode ? 'fixed' : 'absolute');
      this.tooltipVisible = true;
    }
  }

  /**
   * Set position and width of infoOverlay element. This function is not exactly
   * the same as in collection-text.page.ts due to different page structure in
   * introductions.
   */
  private setInfoOverlayPositionAndWidth(triggerElement: HTMLElement, defaultMargins = 10, maxWidth = 600) {
    // Store triggering element so focus can later be restored to it
    if (this.restoreInfoOverlayFocusTimer !== undefined) {
      clearTimeout(this.restoreInfoOverlayFocusTimer);
      this.restoreInfoOverlayFocusTimer = undefined;
    }
    this.infoOverlayTriggerElem.set(triggerElement);

    let margins = defaultMargins;

    // If the viewport width is less than this value the overlay will be placed at the bottom of the viewport.
    const bottomPosBreakpointWidth = 800;

    // Get viewport height and width.
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    // Get page content element and adjust viewport height with horizontal scrollbar height if such is present
    const contentElem = this.elementRef.nativeElement.querySelector(
      'ion-content.collection-ion-content'
    ) as HTMLElement;
    let horizontalScrollbarOffsetHeight = 0;
    if (contentElem.clientHeight < contentElem.offsetHeight) {
      horizontalScrollbarOffsetHeight = contentElem.offsetHeight - contentElem.clientHeight;
    }

    // Get bounding rectangle of the div.scroll-content-container element which is the container for the column that the trigger element resides in.
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

      if (calcWidth > maxWidth + 2 * margins) {
        margins = Math.floor((calcWidth - maxWidth) / 2);
        calcWidth = maxWidth;
      } else {
        calcWidth = calcWidth - 2 * margins;
      }

      let bottomPos = vh - horizontalScrollbarOffsetHeight - containerElemRect.bottom;
      if (
        vw <= bottomPosBreakpointWidth && !(this.platformService.isMobile()) ||
        this.platformService.isMobile()
      ) {
        bottomPos = 0;
      }

      // Set info overlay position
      this.infoOverlayPosition.set({
        bottom: bottomPos + 'px',
        left: (containerElemRect.left + margins - contentElem.getBoundingClientRect().left) + 'px'
      });
      this.infoOverlayPosType.set('absolute');

      // Set info overlay width
      this.infoOverlayWidth.set(calcWidth + 'px');

      // Set focus to info overlay
      const ioElem = this.elementRef.nativeElement.querySelector(
        '.infoOverlay'
      ) as HTMLElement;
      ioElem?.focus();
    }
  }

  private getEventTarget(event: any) {
    const eventTarget: HTMLElement = event.target as HTMLElement;

    try {
      if (eventTarget) {
        if (eventTarget.getAttribute('data-id')) {
          return eventTarget;
        }

        if (eventTarget.classList.contains('tooltiptrigger')) {
          return eventTarget;
        } else if (eventTarget.parentElement) {
          if (eventTarget.parentElement.classList.contains('tooltiptrigger')) {
            return eventTarget.parentElement;
          } else if (eventTarget.parentElement?.parentElement?.classList.contains('tooltiptrigger')) {
            return eventTarget.parentElement.parentElement;
          }
        }
        if (eventTarget.classList.contains('anchor')) {
          return eventTarget;
        } else {
          return document.createElement('div');
        }
      } else {
        return document.createElement('div');
      }
    } catch (e) {
      console.error(e);
      return document.createElement('div');
    }
  }

  setToolTipText(text: string) {
    this.toolTipText.set(text);
  }

  setInfoOverlayText(text: string) {
    this.infoOverlayText.set(text);
  }

  setInfoOverlayTitle(title: string) {
    this.infoOverlayTitle.set(title);
  }

  hideToolTip() {
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
    this.infoOverlayPosType.set('fixed'); // Position needs to be fixed so we can hide it outside viewport
    this.infoOverlayPosition.set({
      bottom: 0 + 'px',
      left: -1500 + 'px'
    });

    // Return focus to element that triggered the info overlay
    // timeout so the info overlay isn't triggered again on
    // keyup.enter event
    this.restoreInfoOverlayFocusTimer = setTimeout(() => {
      this.infoOverlayTriggerElem()?.focus({ preventScroll: true });
      this.infoOverlayTriggerElem.set(null);
      this.restoreInfoOverlayFocusTimer = undefined;
    }, 250);
  }

  async showSemanticDataObjectModal(id: string, type: string) {
    const { NamedEntityModal } = await import('@modals/named-entity/named-entity.modal');
    const modal = await this.modalCtrl.create({
      component: NamedEntityModal,
      componentProps: { id, type }
    });

    modal.present();
  }

  async showIllustrationModal(imageNumber: string) {
    const { IllustrationModal } = await import('@modals/illustration/illustration.modal');
    const modal = await this.modalCtrl.create({
      component: IllustrationModal,
      componentProps: { 'imageNumber': imageNumber }
    });

    modal.present();
  }

  async showViewOptionsPopover(event: any) {
    const toggles = this.viewOptionsTogglesIntro;
    const { ViewOptionsPopover } = await import('@popovers/view-options/view-options.popover');
    const popover = await this.popoverCtrl.create({
      component: ViewOptionsPopover,
      componentProps: { toggles },
      cssClass: 'view-options-popover',
      reference: 'trigger',
      side: 'bottom',
      alignment: 'end'
    });

    popover.present(event);
  }

  async showReference() {
    const { ReferenceDataModal } = await import('@modals/reference-data/reference-data.modal');
    const modal = await this.modalCtrl.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-introduction' }
    });

    modal.present();
  }

  async showDownloadModal() {
    const { DownloadTextsModal } = await import('@modals/download-texts/download-texts.modal');
    const modal = await this.modalCtrl.create({
      component: DownloadTextsModal,
      componentProps: { origin: 'page-introduction', collectionId: this.collectionID }
    });

    modal.present();
  }

  toggleTocMenu() {
    this.tocMenuOpen.update(tocMenuOpen => !tocMenuOpen);
  }

}
