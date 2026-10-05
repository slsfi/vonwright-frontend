import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, LOCALE_ID, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
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
import { catchError, combineLatest, filter, map, Observable, of, switchMap, tap } from 'rxjs';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { config } from '@config';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


@Component({
  selector: 'page-foreword',
  templateUrl: './collection-foreword.page.html',
  styleUrls: ['./collection-foreword.page.scss'],
  imports: [
    AsyncPipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
    TextChangerComponent,
    TrustHtmlPipe
  ]
})
export class CollectionForewordPage implements OnInit, OnDestroy {
  private collectionContentService = inject(CollectionContentService);
  private elementRef = inject(ElementRef);
  private modalController = inject(ModalController);
  private parserService = inject(HtmlParserService);
  private platformService = inject(PlatformService);
  private popoverCtrl = inject(PopoverController);
  private route = inject(ActivatedRoute);
  private scrollService = inject(ScrollService);
  viewOptionsService = inject(ViewOptionsService);
  private activeLocale = inject(LOCALE_ID);

  readonly replaceImageAssetsPaths: boolean = config.collections?.replaceImageAssetsPaths ?? true;
  readonly showURNButton: boolean = config.page?.foreword?.showURNButton ?? false;
  readonly showViewOptionsButton: boolean = config.page?.foreword?.showViewOptionsButton ?? true;

  readonly activeComponent = signal(true);
  readonly mobileMode = this.platformService.isMobile();
  text$: Observable<string>;
  private readonly active$ = toObservable(this.activeComponent);
  private intervalTimerId?: number;

  ngOnInit() {
    this.text$ = combineLatest(
      [this.route.params, this.route.queryParams, this.active$]
    ).pipe(
      filter(([, , active]) => active),
      map(([params, queryParams]) => ({
        collectionID: params['collectionID'],
        searchMatches: queryParams['q']
          ? this.parserService.getSearchMatchesFromQueryParams(queryParams['q'])
          : []
      })),
      tap(({searchMatches}) => {
        if (searchMatches.length) {
          this.clearSearchMatchInterval();
          this.intervalTimerId = this.scrollService.scrollToFirstSearchMatch(
            this.elementRef.nativeElement
          );
        }
      }),
      switchMap(({collectionID, searchMatches}) => {
        return this.loadForeword(collectionID, this.activeLocale, searchMatches);
      })
    );
  }

  ionViewWillEnter() {
    this.activeComponent.set(true);
  }

  ionViewWillLeave() {
    this.activeComponent.set(false);
    this.clearSearchMatchInterval();
  }

  ngOnDestroy() {
    this.clearSearchMatchInterval();
  }

  private clearSearchMatchInterval() {
    if (this.intervalTimerId !== undefined) {
      clearInterval(this.intervalTimerId);
      this.intervalTimerId = undefined;
    }
  }

  private loadForeword(id: string, lang: string, searchMatches: string[]): Observable<string> {
    return this.collectionContentService.getForeword(id, lang).pipe(
      map((res: any) => {
        if (res?.content && res?.content !== 'File not found') {
          let text = this.replaceImageAssetsPaths
            ? res.content.replace(/src="images\//g, 'src="assets/images/')
            : res.content;
          return this.parserService.insertSearchMatchTags(text, searchMatches);
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
    const modal = await this.modalController.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-foreword' }
    });

    modal.present();
  }

}
