import { Component, ElementRef, Inject, LOCALE_ID, NgZone, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { combineLatest, map, Subscription } from 'rxjs';

import { config } from '@config';
import { DownloadTextsModal } from '@modals/download-texts/download-texts.modal';
import { IllustrationModal } from '@modals/illustration/illustration.modal';
import { NamedEntityModal } from '@modals/named-entity/named-entity.modal';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { Textsize } from '@models/textsize.model';
import { ViewOptionsPopover } from '@popovers/view-options/view-options.popover';
import { CollectionContentService } from '@services/collection-content.service';
import { CollectionsService } from '@services/collections.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { TooltipService } from '@services/tooltip.service';
import { ViewOptionsService } from '@services/view-options.service';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'page-introduction',
  templateUrl: './collection-introduction.page.html',
  styleUrls: ['./collection-introduction.page.scss']
})
export class CollectionIntroductionPage implements OnInit, OnDestroy {
  collectionID: string = '';
  collectionLegacyId: string = '';
  hasSeparateIntroToc: boolean = false;
  infoOverlayPosition: any = {
    bottom: 0 + 'px',
    left: -1500 + 'px'
  };
  infoOverlayPosType: string = 'fixed';
  infoOverlayText: string = '';
  infoOverlayTitle: string = '';
  infoOverlayTriggerElem: HTMLElement | null = null;
  infoOverlayWidth: string | null = null;
  intervalTimerId: number = 0;
  mobileMode: boolean = false;
  pos: string | null = null;
  replaceImageAssetsPaths: boolean = true;
  searchMatches: string[] = [];
  showTextDownloadButton: boolean = false;
  showURNButton: boolean = true;
  showViewOptionsButton: boolean = true;
  text: string = '';
  textLoading: boolean = true;
  textMenu: string = '';
  textsize: Textsize = Textsize.Small;
  textsizeSubscription: Subscription | null = null;
  tocMenuOpen: boolean = false;
  toolTipMaxWidth: string | null = null;
  toolTipPosition: any = {
    top: 0 + 'px',
    left: -1500 + 'px'
  };
  toolTipPosType: string = 'fixed';
  toolTipScaleValue: number | null = null;
  toolTipText: string = '';
  tooltipVisible: boolean = false;
  urlParametersSubscription: Subscription | null = null;
  userIsTouching: boolean = false;
  viewOptionsTogglesIntro: any = {};

  TextsizeEnum = Textsize;

  private unlistenClickEvents?: () => void;
  private unlistenKeyUpEnterEvents?: () => void;
  private unlistenMouseoverEvents?: () => void;
  private unlistenMouseoutEvents?: () => void;
  private unlistenFirstTouchStartEvent?: () => void;

  constructor(
    private collectionContentService: CollectionContentService,
    private collectionsService: CollectionsService,
    private elementRef: ElementRef,
    private modalCtrl: ModalController,
    private ngZone: NgZone,
    private parserService: HtmlParserService,
    private platformService: PlatformService,
    private popoverCtrl: PopoverController,
    private renderer2: Renderer2,
    private tooltipService: TooltipService,
    private route: ActivatedRoute,
    private router: Router,
    private scrollService: ScrollService,
    public viewOptionsService: ViewOptionsService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.hasSeparateIntroToc = config.page?.introduction?.hasSeparateTOC ?? false;
    this.replaceImageAssetsPaths = config.collections?.replaceImageAssetsPaths ?? true;
    this.showTextDownloadButton = config.page?.introduction?.showTextDownloadButton ?? false;
    this.showURNButton = config.page?.introduction?.showURNButton ?? true;
    this.showViewOptionsButton = config.page?.introduction?.showViewOptionsButton ?? true;
    this.viewOptionsTogglesIntro = config.page?.introduction?.viewOptions ?? undefined;

    if (
      this.viewOptionsTogglesIntro === undefined ||
      this.viewOptionsTogglesIntro === null ||
      Object.keys(this.viewOptionsTogglesIntro).length === 0
    ) {
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
      this.viewOptionsTogglesIntro.comments = false;
      this.viewOptionsTogglesIntro.emendations = false;
      this.viewOptionsTogglesIntro.normalisations = false;
      this.viewOptionsTogglesIntro.abbreviations = false;
      this.viewOptionsTogglesIntro.pageBreakOriginal = false;
    }
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    this.textsizeSubscription = this.viewOptionsService.getTextsize().subscribe(
      (textsize: Textsize) => {
        this.textsize = textsize;
      }
    );

    this.urlParametersSubscription = combineLatest(
      [this.route.params, this.route.queryParams]
    ).pipe(
      map(([params, queryParams]) => ({...params, ...queryParams}))
    ).subscribe(routeParams => {
      
      // Check if there is a text position in the route params
      // (comes from queryParams)
      if (routeParams['position'] !== undefined) {
        this.pos = routeParams['position'];
      } else {
        this.pos = null;
      }

      if (routeParams['q'] !== undefined) {
        this.searchMatches = this.parserService.getSearchMatchesFromQueryParams(routeParams['q']);
      }

      // If there is a collection id in the route params and it's
      // not the same as already stored in the component, load
      // content. If it's the same collection id, try to scroll
      // the text to this.pos (will only scroll if not null).
      if (routeParams['collectionID']) {
        if (routeParams['collectionID'] !== this.collectionID) {
          this.collectionID = routeParams['collectionID'];
          if (config.collections?.enableLegacyIDs) {
            this.setCollectionLegacyId(this.collectionID);
          }
          this.loadIntroduction(this.collectionID, this.activeLocale);
        } else {
          // Try to scroll to a position in the text
          this.scrollToPos(100);
        }
      }
    });

    if (isBrowser()) {
      this.setUpTextListeners();
    }
  }

  ngOnDestroy() {
    this.urlParametersSubscription?.unsubscribe();
    this.textsizeSubscription?.unsubscribe();
    this.unlistenClickEvents?.();
    this.unlistenKeyUpEnterEvents?.();
    this.unlistenMouseoverEvents?.();
    this.unlistenMouseoutEvents?.();
    this.unlistenFirstTouchStartEvent?.();
  }

  private loadIntroduction(id: string, lang: string) {
    this.text = '';
    this.textLoading = true;
    this.collectionContentService.getIntroduction(id, lang).subscribe({
      next: (res: any) => {
        if (res?.content) {
          this.textLoading = false;
          // Fix paths for images
          let textContent = this.replaceImageAssetsPaths
            ? res.content.replace(/src="images\//g, 'src="assets/images/')
            : res.content;

          // TODO: this manipulation of the introductions TOC should maybe be done using htmlparser2,
          // TODO: on the other hand using regex doesn't rely on an external dependency ...
          // Find the introduction's table of contents in the text
          const pattern = /<div data-id="content">(.*?)<\/div>/;
          const matches = textContent.match(pattern);
          if (matches && matches.length > 0) {
            // The introduction's table of contents was found,
            // copy it to this.textMenu and remove it from this.text
            this.textMenu = matches[1];
            textContent = textContent.replace(pattern, '');
            if (!this.platformService.isMobile()) {
              if (!this.tocMenuOpen) {
                this.tocMenuOpen = true;
              }
            }
          } else {
            this.hasSeparateIntroToc = false;
          }

          this.text = this.parserService.insertSearchMatchTags(textContent, this.searchMatches);
          // Try to scroll to a position in the text or first search match
          if (this.pos) {
            this.scrollToPos();
          } else if (this.searchMatches.length) {
            this.scrollService.scrollToFirstSearchMatch(this.elementRef.nativeElement, this.intervalTimerId);
          }
        } else {
          this.textLoading = false;
          this.text = $localize`:@@CollectionIntroduction.None:Inledningen kunde inte laddas.`;
          this.hasSeparateIntroToc = false;
        }
      },
      error: (e: any) =>  {
        console.error(e);
        this.textLoading = false;
        this.text = $localize`:@@CollectionIntroduction.None:Inledningen kunde inte laddas.`;
        this.hasSeparateIntroToc = false;
      }
    });
  }

  /**
   * Try to scroll to an element in the text, checks if this.pos
   * is null. Interval, to give text some time to load on the page.
   * */
  private scrollToPos(timeout: number = 1000) {
    if (isBrowser()) {
      const that = this;
      this.ngZone.runOutsideAngular(() => {
        let iterationsLeft = 10;
        clearInterval(this.intervalTimerId);
        this.intervalTimerId = window.setInterval(function() {
          if (iterationsLeft < 1) {
            clearInterval(that.intervalTimerId);
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
                clearInterval(that.intervalTimerId);
              }
            } else {
              clearInterval(that.intervalTimerId);
            }
          }
        }.bind(this), timeout);
      });
    }
  }

  private setCollectionLegacyId(id: string) {
    this.collectionsService.getLegacyIdByCollectionId(id).subscribe({
      next: (collection: any[]) => {
        this.collectionLegacyId = '';
        if (collection[0].legacy_id) {
          this.collectionLegacyId = collection[0].legacy_id;
        }
      },
      error: (e: any) => {
        this.collectionLegacyId = '';
        console.log('could not get collection data trying to resolve collection legacy id');
      }
    });
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
          keyTarget?.classList.contains('tooltiptrigger')
        ) {
          keyTarget.click();
        }
      });

      /* CLICK EVENTS */
      this.unlistenClickEvents = this.renderer2.listen(nElement, 'click', (event) => {
        if (!this.userIsTouching) {
          this.ngZone.run(() => {
            this.hideToolTip();
          });
        }

        if (event?.target?.classList.contains('close-info-overlay')) {
          this.ngZone.run(() => {
            this.hideInfoOverlay();
            return;
          });
        }

        let eventTarget = this.getEventTarget(event);

        // Modal trigger for person-, place- or workinfo and info overlay trigger for footnote.
        if (eventTarget.classList.contains('tooltiptrigger') && eventTarget.hasAttribute('data-id')) {
          this.ngZone.run(() => {
            if (eventTarget.classList.contains('person') && this.viewOptionsService.show.personInfo) {
              this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id') || '', 'subject');
            } else if (eventTarget.classList.contains('placeName') && this.viewOptionsService.show.placeInfo) {
              this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id') || '', 'location');
            } else if (eventTarget.classList.contains('title') && this.viewOptionsService.show.workInfo) {
              this.showSemanticDataObjectModal(eventTarget.getAttribute('data-id') || '', 'work');
            } else if (eventTarget.classList.contains('ttFoot')) {
              this.showFootnoteInfoOverlay(eventTarget.getAttribute('data-id') || '', eventTarget);
            }
          });
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
                this.ngZone.run(() => {
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
                });
              } else {
                // Different introduction, open in new window.
                const newWindowRef = window.open();
                this.collectionsService.getCollectionAndPublicationByLegacyId(
                  publicationId
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
            this.ngZone.run(() => {
              this.showIllustrationModal(imageNumber);
            });
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
            let target = nElement.querySelector(dataIdSelector) as HTMLElement;
            if (target !== null) {
              this.ngZone.run(() => {
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
              });
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
            this.ngZone.run(() => {
              if (
                eventTarget.classList.contains('person') &&
                this.viewOptionsService.show.personInfo
              ) {
                this.showSemanticDataObjectTooltip(
                  eventTarget.getAttribute('data-id'), 'person', eventTarget
                );
              } else if (
                eventTarget.classList.contains('placeName') &&
                this.viewOptionsService.show.placeInfo
              ) {
                this.showSemanticDataObjectTooltip(
                  eventTarget.getAttribute('data-id'), 'place', eventTarget
                );
              } else if (
                eventTarget.classList.contains('title') &&
                this.viewOptionsService.show.workInfo
              ) {
                this.showSemanticDataObjectTooltip(
                  eventTarget.getAttribute('data-id'), 'work', eventTarget
                );
              } else if (eventTarget.classList.contains('ttFoot')) {
                this.showFootnoteTooltip(
                  eventTarget.getAttribute('data-id'), eventTarget
                );
              }
            });
          }
        }
      });

      /* MOUSE OUT EVENTS */
      this.unlistenMouseoutEvents = this.renderer2.listen(nElement, 'mouseout', (event) => {
        if (!this.userIsTouching && this.tooltipVisible) {
          this.ngZone.run(() => {
            this.hideToolTip();
          });
        }
      });

    });
  }

  showSemanticDataObjectTooltip(id: string, type: string, targetElem: HTMLElement) {
    this.tooltipService.getSemanticDataObjectTooltip(id, type, targetElem).subscribe(
      (text) => {
        this.setToolTipPosition(targetElem, text);
        this.setToolTipText(text);
      }
    );
  }

  showFootnoteTooltip(id: string, targetElem: HTMLElement) {
    this.tooltipService.getFootnoteTooltip(id, 'introduction', targetElem).subscribe(
      (footnoteHTML: string) => {
        if (footnoteHTML) {
          this.setToolTipPosition(targetElem, footnoteHTML);
          this.setToolTipText(footnoteHTML);
        }
      }
    );
  }

  showFootnoteInfoOverlay(id: string, targetElem: HTMLElement) {
    this.tooltipService.getFootnoteTooltip(id, 'introduction', targetElem).subscribe(
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
      this.toolTipMaxWidth = ttProperties.maxWidth;
      this.toolTipScaleValue = ttProperties.scaleValue;
      this.toolTipPosition = {
        top: ttProperties.top,
        left: ttProperties.left
      };
      this.toolTipPosType = 'absolute';
      if (!this.platformService.isDesktop()) {
        this.toolTipPosType = 'fixed';
      }
      this.tooltipVisible = true;
    }
  }

  /** Set position and width of infoOverlay element. This function is not exactly
   *  the same as in read.ts due to different page structure in introductions.
   */
  private setInfoOverlayPositionAndWidth(triggerElement: HTMLElement, defaultMargins = 10, maxWidth = 600) {
    // Store triggering element so focus can later be restored to it
    this.infoOverlayTriggerElem = triggerElement;

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
      this.infoOverlayPosition = {
        bottom: bottomPos + 'px',
        left: (containerElemRect.left + margins - contentElem.getBoundingClientRect().left) + 'px'
      };
      this.infoOverlayPosType = 'absolute';

      // Set info overlay width
      this.infoOverlayWidth = calcWidth + 'px';

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
    this.toolTipText = text;
  }

  setInfoOverlayText(text: string) {
    this.infoOverlayText = text;
  }

  setInfoOverlayTitle(title: string) {
    this.infoOverlayTitle = title;
  }

  hideToolTip() {
    this.setToolTipText('');
    this.toolTipPosType = 'fixed'; // Position needs to be fixed so we can safely hide it outside viewport
    this.toolTipPosition = {
      top: 0 + 'px',
      left: -1500 + 'px'
    };
    this.tooltipVisible = false;
  }

  hideInfoOverlay() {
    // Clear info overlay content and move it out of viewport
    this.setInfoOverlayText('');
    this.setInfoOverlayTitle('');
    this.infoOverlayPosType = 'fixed'; // Position needs to be fixed so we can hide it outside viewport
    this.infoOverlayPosition = {
      bottom: 0 + 'px',
      left: -1500 + 'px'
    };

    // Return focus to element that triggered the info overlay
    // timeout so the info overlay isn't triggered again on
    // keyup.enter event
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.infoOverlayTriggerElem?.focus({ preventScroll: true });
        this.infoOverlayTriggerElem = null;
      }, 250);
    });
  }

  async showSemanticDataObjectModal(id: string, type: string) {
    const modal = await this.modalCtrl.create({
      component: NamedEntityModal,
      componentProps: { id, type }
    });

    modal.present();
  }

  async showIllustrationModal(imageNumber: string) {
    const modal = await this.modalCtrl.create({
      component: IllustrationModal,
      componentProps: { 'imageNumber': imageNumber }
    });

    modal.present();
  }

  async showViewOptionsPopover(event: any) {
    const toggles = this.viewOptionsTogglesIntro;
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
    const modal = await this.modalCtrl.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-introduction' }
    });

    modal.present();
  }

  async showDownloadModal() {
    const modal = await this.modalCtrl.create({
      component: DownloadTextsModal,
      componentProps: { origin: 'page-introduction', textItemID: this.collectionID }
    });

    modal.present();
  }

  toggleTocMenu() {
    this.tocMenuOpen = !this.tocMenuOpen;
  }

}
