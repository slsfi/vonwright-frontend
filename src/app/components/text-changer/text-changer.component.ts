import { Component, OnChanges, OnDestroy, OnInit, SimpleChanges, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { combineLatestWith, distinctUntilChanged, filter, map, Subscription } from 'rxjs';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { DocumentHeadService } from '@services/document-head.service';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { CollectionPagePositionQueryparamPipe } from '@pipes/collection-page-position-queryparam.pipe';
import { PlatformService } from '@services/platform.service';
import { enableFrontMatterPageOrTextViewType } from '@utility-functions';


/**
 * Component for displaying the title of the current collection page as well
 * as links to the previous and next collection page based on the collection
 * menu/table of contents. This component is responsible for setting the 
 * document title to the title of the current text for collection pages.
 * Thus this component must always be server-side rendered.
 */
@Component({
  selector: 'text-changer',
  templateUrl: './text-changer.component.html',
  styleUrls: ['./text-changer.component.scss'],
  imports: [RouterLink, IonicModule, CollectionPagePathPipe, CollectionPagePositionQueryparamPipe]
})
export class TextChangerComponent implements OnChanges, OnDestroy, OnInit {
  private headService = inject(DocumentHeadService);
  private platformService = inject(PlatformService);
  private route = inject(ActivatedRoute);
  private tocService = inject(CollectionTableOfContentsService);

  readonly parentPageType = input<string>('text');
  // ionViewActive is true when the parent page component is active in the DOM,
  // i.e. the component has entered the Ionic life cycle hook ionViewWillEnter.
  // Set to false when the parent component has entered ionViewWillLeave life
  // cycle hook. This way we can react to ActivatedRoute changes only in active
  // components.
  readonly ionViewActive = input<boolean>(true);

  activeMenuOrder: string = '';
  collectionId: string = '';
  collectionTitle: string = '';
  currentTocTextIndex: number = 0;
  flattenedToc: any[] = [];
  frontMatterPages: any[] = [];
  mobileMode: boolean = false;
  textItemID: string = '';
  textPosition: string = '';
  tocItemId: string = '';
  tocSubscr: Subscription | null = null;

  readonly nextLabel: string = $localize`:@@TextChanger.NextLabel:Följande text`;
  readonly prevLabel: string = $localize`:@@TextChanger.PrevLabel:Föregående text`;

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ionViewActive?.currentValue && !changes.ionViewActive?.firstChange) {
      // Update current text when the ionic view becomes active again
      this.updateCurrentText();
    }
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    // Subscribe to BehaviorSubject emitting the current (flattened) TOC
    // (the received TOC is already properly ordered) and to route
    // parameters, then act on changes to either.
    this.tocSubscr = this.tocService.getCurrentFlattenedCollectionToc().pipe(
      filter(toc => this.ionViewActive() && !!toc),
      combineLatestWith(this.route.paramMap, this.route.queryParamMap),
      map(([toc, paramMap, queryParamMap]) => ({
        toc,
        collectionID: paramMap.get('collectionID'),
        publicationID: paramMap.get('publicationID'),
        chapterID: paramMap.get('chapterID'),
        position: queryParamMap.get('position')
      })),
      distinctUntilChanged((prev, curr) => 
        prev.toc.collectionId === curr.toc.collectionId &&
        prev.toc.order === curr.toc.order &&
        prev.collectionID === curr.collectionID &&
        prev.publicationID === curr.publicationID &&
        prev.chapterID === curr.chapterID &&
        prev.position === curr.position
      )
    ).subscribe(({ toc, collectionID, publicationID, chapterID, position }) => {
      // Check that collectionID not nullish and matches id in TOC to proceed
      if (!collectionID || collectionID !== String(toc.collectionId)) {
        return;
      }

      this.textItemID =
            (publicationID && chapterID) ? `${collectionID}_${publicationID}_${chapterID}`
            : publicationID ? `${collectionID}_${publicationID}`
            : collectionID;
      this.tocItemId = position ? `${this.textItemID};${position}` : this.textItemID;
      this.textPosition = position || '';

      if (this.collectionId !== collectionID || this.activeMenuOrder !== toc.order) {
        // A new TOC or changed ordering of current TOC:
        // concatenate front matter pages and TOC to form flattened TOC
        this.collectionId = collectionID;
        this.collectionTitle = toc.text || '';
        this.activeMenuOrder = toc.order || 'default';
        this.flattenedToc = this.getFrontmatterPages(collectionID, toc).concat(toc.children ?? []);
      }

      this.updateCurrentText();
    });
  }

  ngOnDestroy() {
    this.tocSubscr?.unsubscribe();
  }

  private getFrontmatterPages(collectionId: string, toc: any) {
    type FrontMatterKey = 'cover' | 'title' | 'foreword' | 'introduction';
    const frontMatterKeys: FrontMatterKey[] = ['cover', 'title', 'foreword', 'introduction'];
    const localizedTexts: Record<FrontMatterKey, string> = {
      cover: toc.coverPageName || $localize`:@@CollectionCover.Cover:Omslag`,
      title: toc.titlePageName || $localize`:@@CollectionTitle.TitlePage:Titelblad`,
      foreword: toc.forewordPageName || $localize`:@@CollectionForeword.Foreword:Förord`,
      introduction: toc.introductionPageName || $localize`:@@CollectionIntroduction.Introduction:Inledning`
    };

    return frontMatterKeys.reduce<{ text: string; page: string; itemId: string }[]>((pages, key) => {
      if (enableFrontMatterPageOrTextViewType(key, collectionId, config)) {
        pages.push({
          text: localizedTexts[key],
          page: key,
          itemId: collectionId
        });
      }
      return pages;
    }, []);
  }

  /**
   * Updates the text that's displayed as the current text (as well as the
   * previous and next text), and sets the document title to the current
   * text title. If the current text is a positioned heading in a longer
   * text, the parent text title is set as the document title.
   */
  private updateCurrentText() {
    const pageType = this.parentPageType()

    // Initially search for ToC item matching tocItemId, which includes position.
    // If not found, search for ToC item matching textItemId, which excludes
    // position.
    const tocItemIdIndex = this.getCurrentTextIndex(this.tocItemId, pageType);
    const textItemIdIndex = tocItemIdIndex < 0
          ? this.getCurrentTextIndex(this.textItemID, pageType)
          : -1;
    
    if (tocItemIdIndex > -1) {
      this.currentTocTextIndex = tocItemIdIndex;
    } else if (textItemIdIndex > -1) {
      this.currentTocTextIndex = textItemIdIndex;
    } else {
      console.error('Unable to find the current text in flattenedTOC in text-changer component.');
      this.currentTocTextIndex = 0;
    }

    // Set the document title to the current text title.
    // Positioned item's title should not be set. Instead, if not a frontmatter
    // page ("page" key missing), we have to search for the non-positioned
    // item's title.
    const titleItemIndex = this.textPosition && pageType === 'text'
          ? (textItemIdIndex < 0
                ? this.getCurrentTextIndex(this.textItemID, pageType)
                : textItemIdIndex)
          : this.currentTocTextIndex;

    const itemTitle = titleItemIndex > -1
          ? this.flattenedToc[titleItemIndex].text || ''
          : this.flattenedToc[this.currentTocTextIndex].text || '';

    this.headService.setTitle([itemTitle, this.collectionTitle]);
  }

  private getCurrentTextIndex(searchItemId: string, pageType: string): number {
    return this.flattenedToc.findIndex(item => {
      if (!item.page && item.itemId === searchItemId) {
        return true;
      }
      return item.page === pageType;
    });
  }
}
