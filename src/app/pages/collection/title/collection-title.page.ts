import { Component, ElementRef, Inject, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { catchError, combineLatest, map, Observable, of, Subscription, switchMap, tap } from 'rxjs';

import { config } from '@config';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { Textsize } from '@models/textsize.model';
import { ViewOptionsPopover } from '@popovers/view-options/view-options.popover';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { MarkdownContentService } from '@services/markdown-content.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


@Component({
  selector: 'page-title',
  templateUrl: './collection-title.page.html',
  styleUrls: ['./collection-title.page.scss'],
})
export class CollectionTitlePage implements OnDestroy, OnInit {
  collectionID: string = '';
  intervalTimerId: number = 0;
  loadContentFromMarkdown: boolean = false;
  mobileMode: boolean = false;
  replaceImageAssetsPaths: boolean = true;
  searchMatches: string[] = [];
  showURNButton: boolean = false;
  showViewOptionsButton: boolean = true;
  text$: Observable<SafeHtml>;
  textsize: Textsize = Textsize.Small;
  textsizeSubscription: Subscription | null = null;

  TextsizeEnum = Textsize;

  constructor(
    private collectionContentService: CollectionContentService,
    private elementRef: ElementRef,
    private mdContentService: MarkdownContentService,
    private modalController: ModalController,
    private parserService: HtmlParserService,
    private popoverCtrl: PopoverController,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private scrollService: ScrollService,
    private platformService: PlatformService,
    private viewOptionsService: ViewOptionsService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.loadContentFromMarkdown = config.page?.title?.loadContentFromMarkdown ?? false;
    this.replaceImageAssetsPaths = config.collections?.replaceImageAssetsPaths ?? true;
    this.showURNButton = config.page?.title?.showURNButton ?? false;
    this.showViewOptionsButton = config.page?.title?.showViewOptionsButton ?? true;
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    this.textsizeSubscription = this.viewOptionsService.getTextsize().subscribe(
      (textsize: Textsize) => {
        this.textsize = textsize;
      }
    );

    this.text$ = combineLatest(
      [this.route.params, this.route.queryParams]
    ).pipe(
      map(([params, queryParams]) => ({...params, ...queryParams})),
      tap(({collectionID, q}) => {
        this.collectionID = collectionID;
        if (q) {
          this.searchMatches = this.parserService.getSearchMatchesFromQueryParams(q);
          if (this.searchMatches.length) {
            this.scrollService.scrollToFirstSearchMatch(this.elementRef.nativeElement, this.intervalTimerId);
          }
        }
      }),
      switchMap(({collectionID}) => {
        return this.loadTitle(collectionID, this.activeLocale);
      })
    );
  }

  ngOnDestroy() {
    this.textsizeSubscription?.unsubscribe();
  }

  private loadTitle(id: string, lang: string): Observable<SafeHtml> {
    if (!this.loadContentFromMarkdown) {
      return this.collectionContentService.getTitle(id, lang).pipe(
        map((res: any) => {
          if (res?.content) {
            let text = this.replaceImageAssetsPaths
              ? res.content.replace(/src="images\//g, 'src="assets/images/')
              : res.content;
            text = this.parserService.insertSearchMatchTags(text, this.searchMatches);
            return this.sanitizer.bypassSecurityTrustHtml(text);
          } else {
            return of(this.sanitizer.bypassSecurityTrustHtml(
              $localize`:@@CollectionTitle.None:Titelbladet kunde inte laddas.`
            ));
          }
        }),
        catchError((e: any) => {
          console.error(e);
          return of(this.sanitizer.bypassSecurityTrustHtml(
            $localize`:@@CollectionTitle.None:Titelbladet kunde inte laddas.`
          ));
        })
      );
    } else {
      return this.getMdContent(`${lang}-09-${id}`);
    }
  }

  private getMdContent(fileID: string): Observable<SafeHtml> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        return this.sanitizer.bypassSecurityTrustHtml(
          this.mdContentService.getParsedMd(res.content)
        );
      }),
      catchError((e: any) => {
        console.error(e);
        return of(this.sanitizer.bypassSecurityTrustHtml(
          $localize`:@@CollectionTitle.None:Titelbladet kunde inte laddas.`
        ));
      })
    );
  }

  async showViewOptionsPopover(event: any) {
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
      componentProps: { origin: 'page-title' }
    });

    modal.present();
  }

}
