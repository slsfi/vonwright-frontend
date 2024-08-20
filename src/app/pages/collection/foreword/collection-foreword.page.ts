import { Component, ElementRef, Inject, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { catchError, combineLatest, map, Observable, of, Subscription, switchMap, tap } from 'rxjs';

import { config } from '@config';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { Textsize } from '@models/textsize.model';
import { ViewOptionsPopover } from '@popovers/view-options/view-options.popover';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


@Component({
  selector: 'page-foreword',
  templateUrl: './collection-foreword.page.html',
  styleUrls: ['./collection-foreword.page.scss']
})
export class CollectionForewordPage implements OnDestroy, OnInit {
  _activeComponent: boolean = true;
  collectionID: string = '';
  intervalTimerId: number = 0;
  mobileMode: boolean = false;
  replaceImageAssetsPaths: boolean = true;
  searchMatches: string[] = [];
  showURNButton: boolean = false;
  showViewOptionsButton: boolean = true;
  text$: Observable<string>;
  textsize: Textsize = Textsize.Small;
  textsizeSubscription: Subscription | null = null;

  TextsizeEnum = Textsize;

  constructor(
    private collectionContentService: CollectionContentService,
    private elementRef: ElementRef,
    private modalController: ModalController,
    private parserService: HtmlParserService,
    private platformService: PlatformService,
    private popoverCtrl: PopoverController,
    private route: ActivatedRoute,
    private scrollService: ScrollService,
    private viewOptionsService: ViewOptionsService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.replaceImageAssetsPaths = config.collections?.replaceImageAssetsPaths ?? true;
    this.showURNButton = config.page?.foreword?.showURNButton ?? false;
    this.showViewOptionsButton = config.page?.foreword?.showViewOptionsButton ?? true;
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
        return this.loadForeword(collectionID, this.activeLocale);
      })
    );
  }

  ngOnDestroy() {
    this.textsizeSubscription?.unsubscribe();
  }

  ionViewWillEnter() {
    this._activeComponent = true;
  }

  ionViewWillLeave() {
    this._activeComponent = false;
  }

  private loadForeword(id: string, lang: string): Observable<string> {
    return this.collectionContentService.getForeword(id, lang).pipe(
      map((res: any) => {
        if (res?.content && res?.content !== 'File not found') {
          let text = this.replaceImageAssetsPaths
            ? res.content.replace(/src="images\//g, 'src="assets/images/')
            : res.content;
          return this.parserService.insertSearchMatchTags(text, this.searchMatches);
        } else {
          return $localize`:@@CollectionForeword.None:Förordet kunde inte laddas.`;
        }
      }),
      catchError((e: any) => {
        console.error(e);
        return of(
          $localize`:@@CollectionForeword.None:Förordet kunde inte laddas.`
        );
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
      componentProps: { origin: 'page-foreword' }
    });

    modal.present();
  }

}
