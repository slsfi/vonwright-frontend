import { AfterViewInit, Component, ElementRef, Inject, Input, LOCALE_ID, NgZone, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { NgClass, NgStyle, NgTemplateOutlet, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AlertController, IonicModule, ModalController, PopoverController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Book } from 'epubjs';

import { config } from '@config';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { Textsize } from '@models/textsize.model';
import { IsExternalURLPipe } from '@pipes/is-external-url.pipe';
import { ViewOptionsPopover } from '@popovers/view-options/view-options.popover';
import { PlatformService } from '@services/platform.service';
import { ViewOptionsService } from '@services/view-options.service';
import { concatenateNames, isBrowser, numberIsEven } from '@utility-functions';


@Component({
  selector: 'epub-viewer',
  templateUrl: './epub-viewer.component.html',
  styleUrls: ['./epub-viewer.component.scss'],
  imports: [NgClass, NgStyle, NgTemplateOutlet, FormsModule, IonicModule, IsExternalURLPipe],
  host: { ngSkipHydration: 'true' }
})
export class EpubViewerComponent implements AfterViewInit, OnDestroy, OnInit {
  @Input() epubFileName: string = '';
  @ViewChild('downloadOptionsPopover') downloadOptionsPopover: any;
  
  atEnd: boolean = false;
  atStart: boolean = true;
  book: any = null;
  currentHighlight: any = undefined;
  currentLocationCfi: any = '';
  currentPositionPercentage: string = '0 %';
  currentSectionLabel: string = '';
  displayed: any = null;
  downloadPopoverIsOpen: boolean = false;
  epubData: Record<string, any> = {};
  epubContributors: string[] = [];
  epubCoverImageSrc: SafeUrl | undefined | null = '';
  epubCreators: string[] = [];
  epubFileExists: boolean = true;
  epubTitle: string = '';
  epubToc: any[] = [];
  epubWritersString: string = '';
  intervalTimerId: ReturnType<typeof setInterval> | undefined = undefined;
  loading: boolean = true;
  mobileMode: boolean = false;
  previousLocationCfi: any = '';
  rendition: any = null;
  resizeObserver: ResizeObserver | null = null;
  searchMenuOpen: boolean = false;
  searchResultIndex: number = 0;
  searchResults: any[] = [];
  searchText: string = '';
  showTOCButton: boolean = true;
  showURNButton: boolean = false;
  showViewOptionsButton: boolean = true;
  textsize: Textsize = Textsize.Small;
  textsizeSubscription: Subscription | null = null;
  tocMenuOpen: boolean = false;
  resizeTimeoutId: any = null;
  _window: Window | null = null;

  private unlistenKeyDownEvents?: () => void;

  constructor(
    private alertController: AlertController,
    private elementRef: ElementRef,
    private modalController: ModalController,
    private ngZone: NgZone,
    private platformService: PlatformService,
    private popoverCtrl: PopoverController,
    private renderer2: Renderer2,
    private sanitizer: DomSanitizer,
    private viewOptionsService: ViewOptionsService,
    @Inject(LOCALE_ID) private activeLocale: string,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.showTOCButton = config.component?.epub?.showTOCButton ?? true;
    this.showURNButton = config.component?.epub?.showURNButton ?? false;
    this.showViewOptionsButton = config.component?.epub?.showViewOptionsButton ?? true;
    this._window = <any>this.document.defaultView;
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();
    this.subscribeToTextsizeChanges();

    const availableEbooks: any[] = config.ebooks ?? [];
    for (const ebook of availableEbooks) {
      if (ebook.filename === this.epubFileName) {
        this.epubData = ebook;
        break;
      }
    }

    // Set up resizing of the epub when the container dimensions change
    if (isBrowser()) {
      this.resizeObserver = new ResizeObserver(entries => {
        this.throttledEpubResize();
      });
      this.resizeObserver.observe(this.elementRef.nativeElement);
    }
  }

  ngAfterViewInit() {
    // TODO: After upgrade to Angular 16.2+ test changing this to the AfterRender lifecycle hook. The DOM needs to be ready before the epub is loaded.
    // Loading the epub works only in the browser
    if (isBrowser()) {
      let epubFilePath = (this._window?.location.origin ?? '')
            + (this._window?.location.pathname.split('/')[1] === this.activeLocale ? '/' + this.activeLocale : '')
            + '/assets/ebooks/'
            + this.epubFileName;

      if (this.epubData.externalFileURL) {
        epubFilePath = this.epubData.externalFileURL;
      }
    
      let iterationsLeft = 10;
      if (this.intervalTimerId !== undefined) {
        clearInterval(this.intervalTimerId);
      }
      this.intervalTimerId = setInterval(() => {
        if (iterationsLeft < 1) {
          clearInterval(this.intervalTimerId);
        } else {
          iterationsLeft -= 1;
          if (this.elementRef.nativeElement.querySelector('#epub-render-area')) {
            iterationsLeft = 0;
            clearInterval(this.intervalTimerId);
            this.loadEpub(epubFilePath);
          }
        }
      }, 1000);
    }
  }

  ngOnDestroy() {
    this.unlistenKeyDownEvents?.();
    this.textsizeSubscription?.unsubscribe();
    this.resizeObserver?.unobserve(this.elementRef.nativeElement);
    this.rendition?.destroy();
    this.book?.destroy();
  }

  private loadEpub(epubFilePath: string) {
    // console.log('Loading epub from ', epubFilePath);
    this.ngZone.runOutsideAngular(() => {
      this.book = new Book(epubFilePath);
      this.renderEpub();

      this.book.ready.then((res: any) => {
        if (!this.viewOptionsService.epubAlertIsDismissed() && $localize`:@@Epub.NoticeHeader:Anmärkning`) {
          this.showNotice();
        }

        // Remove loading spinner with a delay
        setTimeout(() => {
          this.ngZone.run(() => {
            this.loading = false;
          });
        }, 500);

        if (this.showTOCButton) {
          // Get epub title, creator(s), contributor(s) and cover image
          // (as a blob) from the epub. Since the metadata object provided
          // by the epub.js library doesn't support multiple creators or
          // contributors we have to get those directly from the epub
          // package document.
          this.epubTitle = this.book.package.metadata.title;

          let opfFilePath = String(this.book.container.packagePath);
          if (!opfFilePath.startsWith('/')) {
            opfFilePath = '/' + opfFilePath;
          }

          this.book.archive.getText(opfFilePath).then((res: any) => {
            try {
              if (res) {
                // TODO: DOMParser is safe here because this code is only run in the browser,
                // however, this could be refactored to use the SSR compatible htmlparser2 instead.
                const parser = new DOMParser();
                const opf = parser.parseFromString(res, 'text/xml');
                const creatorElements = opf.getElementsByTagName('dc:creator');
                for (let i = 0; i < creatorElements.length; i++) {
                  if (creatorElements && creatorElements.item(i)?.textContent) {
                    const text = creatorElements.item(i)?.textContent;
                    if (text) {
                      this.epubCreators.push(text);
                    }
                  }
                }
                const contributorElements = opf.getElementsByTagName('dc:contributor');
                for (let i = 0; i < contributorElements.length; i++) {
                  if (creatorElements && contributorElements.item(i)?.textContent) {
                    const text = contributorElements.item(i)?.textContent;
                    if (text) {
                      this.epubContributors.push(text);
                    }
                  }
                }
                // Form concatenated string with epub writer names
                if (this.epubCreators.length > 0) {
                  this.epubWritersString = concatenateNames(this.epubCreators, ',');
                } else if (this.epubContributors.length > 0) {
                  this.epubWritersString = concatenateNames(this.epubContributors, ',');
                }
              }
            } catch {}
          });

          // Get epub cover image
          this.book.archive.getBlob(this.book.cover).then((res: any) => {
            this.ngZone.run(() => {
              try {
                if (res) {
                  this.epubCoverImageSrc = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(res));
                } else {
                  this.epubCoverImageSrc = '';
                }
              } catch (e) {
                this.epubCoverImageSrc = '';
              }
            });
          });

          // Get epub table of contents
          this.book.loaded.navigation.then((toc: any) => {
            this.ngZone.run(() => {
              if (toc?.length) {
                this.epubToc = toc.toc;
              }
            });
          });
        }

        // Generate locations for calculating percentage positions throughout the book
        this.book.locations.generate();

      }); // End of this.book.ready

      // Event fired when current location (i.e. page or spread) in book changes
      this.rendition.on('relocated', (location: any) => {
        this.ngZone.run(() => {

          // Store current cfi location in book and check if at start or end of book
          this.previousLocationCfi = this.currentLocationCfi;
          this.currentLocationCfi = location.start.cfi;
          if (location.atStart) {
            this.atStart = true;
          } else {
            this.atStart = false;
          }
          if (location.atEnd) {
            this.atEnd = true;
          } else {
            this.atEnd = false;
          }

          // Get the current position in the book as a percentage with one decimal
          if (this.atStart) {
            this.currentPositionPercentage = '0.0 %';
          } else if (this.atEnd) {
            this.currentPositionPercentage = '100.0 %';
          } else {
            this.currentPositionPercentage = (parseFloat(this.book.locations.percentageFromCfi(this.currentLocationCfi)) * 100).toFixed(1)
            + ' %';
          }
        });

        // Get the label of the current section from the epub
        const getNavItemByHref = (href: any) => (function flatten(arr) {
          return [].concat(...arr.map((v: any) => [v, ...flatten(v.subitems)]));
        })(this.book.navigation.toc).filter(
            (item: any) => this.book.canonical(item.href.split('#')[0]) === this.book.canonical(href)
        )[0] || null;

        const navItemHref = getNavItemByHref(this.rendition.currentLocation().start.href) as any;

        this.ngZone.run(() => {
          if (navItemHref !== null && navItemHref !== undefined) {
            this.currentSectionLabel = navItemHref.label;
          } else {
            this.currentSectionLabel = '';
          }
          if (this.currentSectionLabel === null || this.currentSectionLabel === undefined) {
            this.currentSectionLabel = '';
          }
        });
      });

      // Set up event listeners (keyboard)
      this.setUpInputListeners();

    }); // End of runOutsideAngular
  }

  private renderEpub() {
    // Get the dimensions of the epub rendering area. Adjust the size of the
    // rendering to even numbers (helps rendering of spreads).
    const area = this.elementRef.nativeElement.querySelector('#epub-render-area');
    let areaWidth: number | string = Math.floor(area?.getBoundingClientRect().width || 1);
    let areaHeight: number | string = Math.floor(area?.getBoundingClientRect().height || 1);
    if (areaWidth > 1 && !numberIsEven(areaWidth)) {
      areaWidth = areaWidth - 1;
    } else {
      areaWidth = '100%';
    }
    if (areaHeight > 1 && !numberIsEven(areaHeight)) {
      areaHeight = areaHeight - 1;
    } else {
      areaHeight = '100%';
    }

    // Render the epub in the specified HTML element with rendering options
    this.rendition = this.book.renderTo(
      area,
      {
        method: 'continuous',
        width: areaWidth,
        height: areaHeight,
        spread: 'auto',
        allowPopups: true
      }
    );

    // Register epub themes for switching font size and setting font family to
    // browser default serif for the search to highlight matches correctly.
    this.rendition.themes.register('fontsize_XS', { 'body': { 'font-size': '1em' },
      'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('fontsize_S', { 'body': { 'font-size': '1.0625em' },
      'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('fontsize_M', { 'body': { 'font-size': '1.125em' },
      'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('fontsize_L', { 'body': { 'font-size': '1.1875em' },
      'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('fontsize_XL', { 'body': { 'font-size': '1.3125em' },
      'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('search_fontsize_XS', { '*': { 'font-family': 'serif !important' },
      'body': { 'font-size': '1em' }, 'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('search_fontsize_S', { '*': { 'font-family': 'serif !important' },
      'body': { 'font-size': '1.0625em' }, 'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('search_fontsize_M', { '*': { 'font-family': 'serif !important' },
      'body': { 'font-size': '1.125em' }, 'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('search_fontsize_L', { '*': { 'font-family': 'serif !important' },
      'body': { 'font-size': '1.1875em' }, 'img': { 'max-width': '100% !important;' } });
    this.rendition.themes.register('search_fontsize_XL', { '*': { 'font-family': 'serif !important' },
      'body': { 'font-size': '1.3125em' }, 'img': { 'max-width': '100% !important;' } });

    this.rendition.themes.select('fontsize_' + this.textsize);

    // Display the epub from the beginning
    this.rendition.display();
  }

  /**
   * Get fontsize changes from the read popover service and update epub
   * font size when new size has been set.
   */
  private subscribeToTextsizeChanges() {
    this.textsizeSubscription = this.viewOptionsService.getTextsize().subscribe(
      (textsize: Textsize) => {
      if (textsize !== this.textsize) {
        this.setEpubFontsize(textsize);
      }
    });
  }

  private setEpubFontsize(size: Textsize) {
    const currentLocation = this.currentLocationCfi;
    try {
      if (this.rendition) {
        if (this.searchMenuOpen) {
          this.rendition.themes.select('search_fontsize_' + size);
        } else {
          this.rendition.themes.select('fontsize_' + size);
        }
        this.textsize = size;
        // this.rendition.clear(); // ! Causes typescipt error, but doesn't seem to be needed
        this.rendition.start();
        this.rendition.display(currentLocation);
      }
    } catch(e) {
      console.error('Error setting epub font size', e);
    }
  }

  private throttledEpubResize() {
    const timeout = 300;
    // clear the timeout
    clearTimeout(this.resizeTimeoutId);
    // start timing for event "completion"
    this.resizeTimeoutId = setTimeout(() => {
      this.resizeEpub();
    }, timeout);
  }

  private resizeEpub() {
    // Get the dimensions of the epub containing element, div#epub-render-area, and round off to even integers
    const area = this.elementRef.nativeElement.querySelector('.toc-epub-container > #epub-render-area');
    if (area) {
      let areaWidth = Math.floor(area?.getBoundingClientRect().width || 1);
      let areaHeight = Math.floor(area?.getBoundingClientRect().height || 1);
      if (!numberIsEven(areaWidth)) {
        areaWidth = areaWidth - 1;
      }
      if (!numberIsEven(areaHeight)) {
        areaHeight = areaHeight - 1;
      }
      if (areaWidth > 0 && areaHeight > 0) {
        // Resize the epub rendition with the area's dimensions
        try {
          this.rendition?.resize(areaWidth, areaHeight);
        } catch {
          console.log('epub.js threw an error resizing the rendering area');
        }
      }
    }
  }

  doSearch(q: any): Promise<any> | void {
    const search = String(this.searchText);
    if (search.length > 0) {
      const _book = this.book;
      this.searchResultIndex = 0;
      this.searchResults = [];
      return Promise.all(
        _book.spine.spineItems.map((item: any) =>
          item
          .load(_book.load.bind(_book))
          .then(item.find.bind(item, search))
        )
      ).then(results =>
        Promise.resolve(
          this.searchResults = [].concat.apply([], results)
        ).then(() => {
            // console.log(this.searchResults);
            this.nextSearch(true);
          }
        )
      );
    }
  };

  applyHighlight(cfiRange: any) {
    // Apply a class to selected text
    if (this.currentHighlight !== undefined) {
      this.rendition.annotations.remove(this.currentHighlight, 'highlight');
    }
    this.rendition.annotations.highlight(cfiRange);
    this.currentHighlight = cfiRange;
  }

  nextSearch(first?: boolean) {
    if (this.searchResultIndex < (this.searchResults.length - 1) && first === undefined) {
      this.searchResultIndex++;
    }
    if (this.searchResults !== undefined) {
      const res = this.searchResults[this.searchResultIndex];
      if (res !== undefined && res.cfi !== undefined) {
        const url = res.cfi;
        if (url !== undefined) {
          this.rendition.display(url).then(() => {
            this.applyHighlight(url);
          });
        }
      }
    }
  }

  prevSearch() {
    if (this.searchResultIndex !== 0) {
      this.searchResultIndex--;
    }
    if (this.searchResults !== undefined) {
      const res = this.searchResults[this.searchResultIndex];
      if (res !== undefined && res.cfi !== undefined) {
        const url = res.cfi;
        if (url !== undefined) {
          this.rendition.display(url).then(() => {
            this.applyHighlight(url);
          });
        }
      }
    }
  }

  clearSearch() {
    if (this.currentHighlight !== undefined) {
      this.rendition.annotations.remove(this.currentHighlight, 'highlight');
    }
    this.searchText = '';
    this.searchResultIndex = 0;
    this.searchResults = [];
  }

  openChapter(event: any, url: string) {
    event.preventDefault();
    this.rendition.display(url);
  }

  toggleTocMenu() {
    if (this.tocMenuOpen) {
      this.tocMenuOpen = false;
    } else {
      this.tocMenuOpen = true;
    }
  }

  toggleSearchMenu() {
    let currentLocation = this.currentLocationCfi;
    if (this.searchMenuOpen) {
      this.searchMenuOpen = false;
      if (this.currentHighlight !== undefined && this.currentHighlight !== null) {
        currentLocation = this.currentHighlight;
      }
      this.clearSearch();
      this.rendition.themes.select('fontsize_' + this.textsize);
      try {
        // this.rendition.clear(); // ! Causes typescipt error, but doesn't seem to be needed
        this.rendition.start();
      } catch {}
      this.rendition.display(currentLocation);
    } else {
      this.searchMenuOpen = true;
      this.rendition.themes.select('search_fontsize_' + this.textsize);
      this.rendition.display(currentLocation);
    }
  }

  next() {
    this.rendition.next();
  }

  prev() {
    this.rendition.prev();
  }

  openDownloadPopover(event: any) {
    this.downloadOptionsPopover.event = event;
    this.downloadPopoverIsOpen = true;
  }

  closeDownloadPopover() {
    this.downloadPopoverIsOpen = false;
  }

  async showReadSettingsPopover(event: any) {
    const toggles = {
      'comments': false,
      'personInfo': false,
      'placeInfo': false,
      'workInfo': false,
      'emendations': false,
      'normalisations': false,
      'abbreviations': false,
      'paragraphNumbering': false,
      'pageBreakOriginal': false,
      'pageBreakEdition': false
    };

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
    const modal = await this.modalController.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-ebook' }
    });
    modal.present();
  }

  private setUpInputListeners() {
    // 1. Listen for keydown events inside the epub rendition. This is
    // needed for prev/next on keydown to work after the user has
    // clicked inside the epub iframe.
    this.rendition.on('keydown', (event: any) => {
      switch (event.key) {
        case 'ArrowLeft':
          this.prev();
          break;
        case 'ArrowRight':
          this.next();
          break;
      }
    });

    // 2. Add touch event listeners to the epub content in order
    // to enable swipe gestures for flipping page.
    // ! SWIPE SUPPORT DISABLED for now. It works great until
    // ! this.rendition.clear() and this.rendition.start()
    // ! have to be run, i.e. when changing epub theme and font size.
    // ! After that swiping turns multiple pages/spreads instead of one.
    /*
    this.rendition.hooks.content.register((contents) => {
      const el = contents.document.documentElement;
      if (el) {
        let start: Touch;
        let end: Touch;

        // Define the minimum length of the horizontal touch action to be registered as a swipe.
        // This is a fraction between 0 and 1 and is relative to the epub's width.
        const horizontalTouchLengthThreshold = 0.12;

        el.addEventListener('touchstart', (event: TouchEvent) => {
          start = event.changedTouches[0];
        });

        el.addEventListener('touchend', (event: TouchEvent) => {
          end = event.changedTouches[0];
          const elBook = this.elementRef.nativeElement.querySelector('div.toc-epub-container'); // Parent div, which contains div#epub-render-area
          if (elBook) {
            const bound = elBook.getBoundingClientRect();
            const hr = (end.screenX - start.screenX) / bound.width;
            const vr = Math.abs((end.screenY - start.screenY) / bound.height);
            if (hr > horizontalTouchLengthThreshold && vr < 0.1) {
              return this.prev();
            }
            if (hr < -horizontalTouchLengthThreshold && vr < 0.1) {
              return this.next();
            }
          }
        });
      }
    });
    */

    // 3. We also need to listen on the whole document for next/prev in epub
    // to work when the user has clicked somewhere outside the epub iframe.
    // However, arrow left/right clicks inside the searchbar should be ignored.
    this.unlistenKeyDownEvents = this.renderer2.listen('document', 'keydown', (event) => {
      switch (event.key) {
        case 'ArrowLeft':
          if (!event.target.className.includes('searchbar-input')) {
            this.prev();
          }
          break;
        case 'ArrowRight':
          if (!event.target.className.includes('searchbar-input')) {
            this.next();
          }
          break;
        case 'Enter':
          // Move to next search match if 'enter' key pressed in epub
          // search bar. Since we are listening on the whole document
          // we need to make sure we catch the key stroke in the
          // epub's search bar and not elsewhere.
          if (event.target.className.includes('searchbar-input')) {
            if (event.target.parentElement !== null) {
              if (event.target.parentElement.parentElement !== null) {
                if (event.target.parentElement.parentElement.className.includes('epub-searchbar')) {
                  this.nextSearch();
                  break;
                }
              }
            }
          }
      }
    });
  }

  private async showNotice() {
    const alert = await this.alertController.create({
      header: $localize`:@@Epub.NoticeHeader:Anmärkning`,
      message: $localize`:@@Epub.NoticeMessage:Det här är en e-bok i epubformat som visas på webbsidan med hjälp av ett inbyggt läsprogram. Läsprogrammet fungerar bäst om din webbläsare är Firefox. I Chrome, Edge och Safari fungerar inte e-böckers länkar i läsprogrammet. Vi rekommenderar därför att du använder Firefox, eller laddar ner e-boken och läser den med ett läsprogram på din apparat.`,
      cssClass: 'custom-select-alert',
      buttons: [
        {
          text: $localize`:@@BasicActions.Ok:Ok`,
          role: 'ok'
        },
        {
          text: $localize`:@@BasicActions.DontShowAgain:Visa inte igen`,
          role: 'dismiss',
          cssClass: 'alert-button-highlighted'
        }
      ]
    });

    alert.present();
    const { data, role } = await alert.onWillDismiss();

    if (role === 'dismiss') {
      this.viewOptionsService.markEpubAlertAsDismissed();
    }
  }

}
