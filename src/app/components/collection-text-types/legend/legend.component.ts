import { Component, ElementRef, Inject, Input, LOCALE_ID, NgZone, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { catchError, map, Observable, of } from 'rxjs';

import { MarkdownContentService } from '@services/markdown-content.service';
import { ScrollService } from '@services/scroll.service';
import { isBrowser } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'text-legend',
  templateUrl: './legend.component.html',
  styleUrls: ['./legend.component.scss'],
  imports: [AsyncPipe, NgIf, IonicModule]
})
export class LegendComponent implements OnDestroy, OnInit {
  @Input() itemId?: string;
  @Input() scrollToElementId?: string;

  collectionId: string = '';
  intervalTimerId: number = 0;
  publicationId: string = '';
  staticMdLegendFolderNumber: string = '13';
  text$: Observable<SafeHtml>;

  private unlistenClickEvents?: () => void;

  constructor(
    private elementRef: ElementRef,
    private mdContentService: MarkdownContentService,
    private ngZone: NgZone,
    private renderer2: Renderer2,
    private sanitizer: DomSanitizer,
    private scrollService: ScrollService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.collectionId = this.itemId?.split('_')[0] || '';
    this.publicationId = this.itemId?.split('_')[1].split(';')[0] || '';

    this.text$ = this.getMdContent(this.activeLocale + '-' + this.staticMdLegendFolderNumber + '-' + this.collectionId + '-' + this.publicationId);
    if (isBrowser()) {
      this.setUpTextListeners();
    }
  }

  ngOnDestroy() {
    this.unlistenClickEvents?.();
  }

  getMdContent(fileID: string): Observable<SafeHtml> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        if (isBrowser()) {
          this.scrollToInitialTextPosition();
        }
        return this.sanitizer.bypassSecurityTrustHtml(
          this.mdContentService.getParsedMd(res.content)
        );
      }),
      catchError(e => {
        if (fileID.split('-').length > 3) {
          return this.getMdContent(this.activeLocale + '-' + this.staticMdLegendFolderNumber + '-' + this.collectionId);
        } else if (fileID.split('-')[2] !== '00') {
          return this.getMdContent(this.activeLocale + '-' + this.staticMdLegendFolderNumber + '-' + '00');
        } else {
          return of($localize`:@@Legend.None:Inga teckenförklaringar tillgängliga.`);
        }
      })
    );
  }

  private setUpTextListeners() {
    const nElement: HTMLElement = this.elementRef.nativeElement;
    this.ngZone.runOutsideAngular(() => {
      /* CLICK EVENTS */
      this.unlistenClickEvents = this.renderer2.listen(nElement, 'click', (event) => {
        try {
          const clickedElem = event.target as HTMLElement;

          if (
            clickedElem.hasAttribute('href') === true &&
            clickedElem.getAttribute('href')?.startsWith('http') === false &&
            clickedElem.getAttribute('href')?.startsWith('/') === false
          ) {
            event.preventDefault();
            const targetHref = clickedElem.getAttribute('href');

            if (targetHref && targetHref.startsWith('#')) {
              // Assume link to data-id in same legend text --> find element and scroll it into view
              let containerElem = clickedElem.parentElement;
              while (containerElem !== null && containerElem.tagName !== 'TEXT-LEGEND') {
                containerElem = containerElem.parentElement;
              }
              if (containerElem) {
                const targetElem = containerElem.querySelector(
                  '[data-id="' + targetHref.slice(1) + '"]'
                ) as HTMLElement;
                this.scrollService.scrollElementIntoView(targetElem, 'top');
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  /**
   * Function for scrolling an element with matching data-id attribute in the
   * last text-legend-element into view.
   */
  scrollToInitialTextPosition() {
    if (this.scrollToElementId) {
      const that = this;
      this.ngZone.runOutsideAngular(() => {
        let iterationsLeft = 10;
        clearInterval(this.intervalTimerId);

        this.intervalTimerId = window.setInterval(function() {
          if (iterationsLeft < 1) {
            clearInterval(that.intervalTimerId);
          } else {
            iterationsLeft -= 1;
            const legendElements = document.querySelectorAll('page-text:not([ion-page-hidden]):not(.ion-page-hidden) text-legend');
            const element = legendElements[legendElements.length - 1].querySelector('[data-id="' + that.scrollToElementId + '"]') as any;
            if (element) {
              that.scrollService.scrollElementIntoView(element, 'top');
              clearInterval(that.intervalTimerId);
            }
          }
        }.bind(this), 500);
      });
    }
  }

}
