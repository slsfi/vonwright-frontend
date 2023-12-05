import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { PlatformService } from '@services/platform.service';
import { sortArrayOfObjectsAlphabetically, sortArrayOfObjectsNumerically } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'text-changer',
  templateUrl: './text-changer.component.html',
  styleUrls: ['./text-changer.component.scss'],
  imports: [NgIf, IonicModule]
})
export class TextChangerComponent implements OnChanges, OnDestroy, OnInit {
  @Input() parentPageType: string = '';
  @Input() textItemID: string = '';
  @Input() textPosition: string = '';

  activeTocOrder: string = '';
  activeTocOrderSubscription: Subscription | null = null;
  collectionHasCover: boolean = false;
  collectionHasTitle: boolean = false;
  collectionHasForeword: boolean = false;
  collectionHasIntro: boolean = false;
  collectionId: string = '';
  currentItemTitle: string = '';
  firstItem?: boolean;
  flattened: Array<any> = [];
  lastItem?: boolean;
  mobileMode: boolean = false;
  nextItem: any;
  nextItemTitle?: string;
  prevItem: any;
  prevItemTitle?: string;
  tocItemId: string = '';

  constructor(
    private platformService: PlatformService,
    private router: Router,
    private tocService: CollectionTableOfContentsService
  ) {
    this.collectionHasCover = config.collections?.frontMatterPages?.cover ?? false;
    this.collectionHasTitle = config.collections?.frontMatterPages?.title ?? false;
    this.collectionHasForeword = config.collections?.frontMatterPages?.foreword ?? false;
    this.collectionHasIntro = config.collections?.frontMatterPages?.introduction ?? false;
  }

  ngOnChanges(changes: SimpleChanges) {
    let firstChange = true;
    for (const propName in changes) {
      if (changes.hasOwnProperty(propName)) {
        if (propName === 'textItemID') {
          if (!changes.textItemID.firstChange) {
            firstChange = false;
          }
        } else if (propName === 'textPosition') {
          if (!changes.textPosition.firstChange) {
            firstChange = false;
          }
        } else if (propName === 'parentPageType') {
          if (!changes.parentPageType.firstChange) {
            firstChange = false;
          }
        }
      }
    }

    if (!this.parentPageType) {
      this.parentPageType = 'page-text';
    }

    this.collectionId = this.textItemID.split('_')[0];
    this.tocItemId = this.textItemID;
    if (this.textPosition) {
      this.tocItemId += ';' + this.textPosition;
    }

    if (
      !firstChange &&
      this.parentPageType === 'page-text' &&
      (
        changes.textItemID === undefined ||
        this.textItemID === changes.textItemID.previousValue
      ) &&
      changes.textPosition &&
      this.textPosition !== changes.textPosition.previousValue
    ) {
      // Same read text, different text position
      this.setCurrentPreviousAndNextItemsFromFlattenedToc(this.tocItemId);
    } else if (
      !firstChange &&
      this.parentPageType === 'page-text' &&
      this.flattened.length > 0 &&
      changes.textItemID &&
      this.collectionId === changes.textItemID.previousValue.split('_')[0]
    ) {
      // Different read text, same collection
      this.setCurrentPreviousAndNextItemsFromFlattenedToc(this.tocItemId);
    } else if (!firstChange) {
      // Different collection or parent page type
      this.loadData();
    }
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    this.activeTocOrderSubscription = this.tocService.getActiveTocOrder().subscribe(
      (tocOrder: string) => {
        if (tocOrder !== this.activeTocOrder) {
          this.activeTocOrder = tocOrder;
          if (this.textItemID) {
            this.loadData();
          }
        }
      }
    );
  }

  ngOnDestroy() {
    this.activeTocOrderSubscription?.unsubscribe();
  }

  loadData() {
    this.flattened = [];

    if (this.parentPageType === 'page-cover') {
      // Initialised from page-cover
      this.currentItemTitle = $localize`:@@CollectionCover.Cover:Omslag`;

      this.firstItem = true;
      this.lastItem = false;
      if (this.collectionHasTitle) {
        this.setPageTitleAsNext(this.collectionId);
      } else if (this.collectionHasForeword) {
        this.setPageForewordAsNext(this.collectionId);
      } else if (this.collectionHasIntro) {
        this.setPageIntroductionAsNext(this.collectionId);
      } else {
        this.setFirstTocItemAsNext(this.collectionId);
      }

    } else if (this.parentPageType === 'page-title') {
      // Initialised from page-title
      this.currentItemTitle = $localize`:@@CollectionTitle.TitlePage:Titelblad`;

      if (this.collectionHasCover) {
        this.firstItem = false;
        this.setPageCoverAsPrevious(this.collectionId);
      } else {
        this.firstItem = true;
      }

      this.lastItem = false;
      if (this.collectionId === 'mediaCollections') {
        this.setMediaCollectionsAsNext();
      } else {
        if (this.collectionHasForeword) {
          this.setPageForewordAsNext(this.collectionId);
        } else if (this.collectionHasIntro) {
          this.setPageIntroductionAsNext(this.collectionId);
        } else {
          this.setFirstTocItemAsNext(this.collectionId);
        }
      }

    } else if (this.parentPageType === 'page-foreword') {
      // Initialised from page-foreword
      this.currentItemTitle = $localize`:@@CollectionForeword.Foreword:Förord`;

      this.lastItem = false;
      if (this.collectionHasCover || this.collectionHasTitle) {
        this.firstItem = false;
      } else {
        this.firstItem = true;
      }

      if (this.collectionHasTitle) {
        this.setPageTitleAsPrevious(this.collectionId);
      } else if (this.collectionHasCover) {
        this.setPageCoverAsPrevious(this.collectionId);
      }

      if (this.collectionHasIntro) {
        this.setPageIntroductionAsNext(this.collectionId);
      } else {
        this.setFirstTocItemAsNext(this.collectionId);
      }

    } else if (this.parentPageType === 'page-introduction') {
      // Initialised from page-introduction
      this.currentItemTitle = $localize`:@@CollectionIntroduction.Introduction:Inledning`;

      this.lastItem = false;
      if (this.collectionHasCover || this.collectionHasTitle || this.collectionHasForeword) {
        this.firstItem = false;
      } else {
        this.firstItem = true;
      }

      if (this.collectionHasForeword) {
        this.setPageForewordAsPrevious(this.collectionId);
      } else if (this.collectionHasTitle) {
        this.setPageTitleAsPrevious(this.collectionId);
      } else if (this.collectionHasCover) {
        this.setPageCoverAsPrevious(this.collectionId);
      }
      this.setFirstTocItemAsNext(this.collectionId);

    } else {
      // Default functionality, e.g. as when initialised from page-text
      this.firstItem = false;
      this.lastItem = false;
      this.next(true);
    }
  }

  setFirstTocItemAsNext(collectionId: string) {
    try {
      this.tocService.getTableOfContents(collectionId).subscribe(
        (toc: any) => {
          if (toc && toc.children && String(toc.collectionId) === collectionId) {
            this.flatten(toc);
            if (this.activeTocOrder === 'alphabetical') {
              this.sortFlattenedTocAlphabetically();
            } else if (this.activeTocOrder === 'chronological') {
              this.sortFlattenedTocChronologically();
            } else if (this.activeTocOrder === 'categorical') {
              this.sortFlattenedTocCategorically();
            }
            for (let i = 0; i < this.flattened.length; i++) {
              if (
                this.flattened[i].itemId !== undefined &&
                this.flattened[i].type !== 'subtitle' &&
                this.flattened[i].type !== 'section_title'
              ) {
                this.nextItemTitle = this.flattened[i].text;
                this.nextItem = this.flattened[i];
                break;
              }
            }
          } else {
            this.nextItemTitle = '';
            this.nextItem = null;
            this.lastItem = true;
          }
        }
      );
    } catch (e) {
      console.log('Unable to get first toc item as next in text-changer');
      this.nextItemTitle = '';
      this.nextItem = null;
      this.lastItem = true;
    }
  }

  setPageTitleAsNext(collectionId: string) {
    this.nextItemTitle = $localize`:@@CollectionTitle.TitlePage:Titelblad`;
    this.nextItem = {
      itemId: collectionId,
      page: 'page-title'
    };
  }

  setPageForewordAsNext(collectionId: string) {
    this.nextItemTitle = $localize`:@@CollectionForeword.Foreword:Förord`;
    this.nextItem = {
      itemId: collectionId,
      page: 'page-foreword'
    };
  }

  setPageIntroductionAsNext(collectionId: string) {
    this.nextItemTitle = $localize`:@@CollectionIntroduction.Introduction:Inledning`;
    this.nextItem = {
      itemId: collectionId,
      page: 'page-introduction'
    };
  }

  setMediaCollectionsAsNext() {
    this.nextItemTitle = '';
    this.nextItem = {
      itemId: 'mediaCollections',
      page: 'media-collection'
    };
  }

  setPageCoverAsPrevious(collectionId: string) {
    this.prevItemTitle = $localize`:@@CollectionCover.Cover:Omslag`;
    this.prevItem = {
      itemId: collectionId,
      page: 'page-cover'
    };
  }

  setPageTitleAsPrevious(collectionId: string) {
    this.prevItemTitle = $localize`:@@CollectionTitle.TitlePage:Titelblad`;
    this.prevItem = {
      itemId: collectionId,
      page: 'page-title'
    };
  }

  setPageForewordAsPrevious(collectionId: string) {
    this.prevItemTitle = $localize`:@@CollectionForeword.Foreword:Förord`;
    this.prevItem = {
      itemId: collectionId,
      page: 'page-foreword'
    };
  }

  setPageIntroductionAsPrevious(collectionId: string) {
    this.prevItemTitle = $localize`:@@CollectionIntroduction.Introduction:Inledning`;
    this.prevItem = {
      itemId: collectionId,
      page: 'page-introduction'
    };
  }

  async previous(test?: boolean) {
    if (this.parentPageType === 'page-text') {
      this.tocService.getTableOfContents(this.collectionId).subscribe(
        toc => {
          this.findNext(toc);
        }
      );
    }
    if (this.prevItem !== undefined && test !== true) {
      await this.open(this.prevItem);
    } else if (test && this.prevItem !== undefined) {
      return true;
    } else if (test && this.prevItem === undefined) {
      return false;
    }
    return false;
  }

  async next(test?: boolean) {
    if (this.tocItemId !== 'mediaCollections' && this.parentPageType === 'page-text') {
      this.tocService.getTableOfContents(this.collectionId).subscribe(
        toc => {
          this.findNext(toc);
        }
      );
    }
    if (this.nextItem !== undefined && test !== true) {
      await this.open(this.nextItem);
    } else if (test && this.nextItem !== undefined) {
      return true;
    } else if (test && this.nextItem === undefined) {
      return false;
    }
    return false;
  }

  findNext(toc: any) {
    if (this.flattened.length < 1) {
      this.flatten(toc);
    }
    if (this.activeTocOrder === 'alphabetical') {
      this.sortFlattenedTocAlphabetically();
    } else if (this.activeTocOrder === 'chronological') {
      this.sortFlattenedTocChronologically();
    } else if (this.activeTocOrder === 'categorical') {
      this.sortFlattenedTocCategorically();
    }
    let itemFound = this.setCurrentPreviousAndNextItemsFromFlattenedToc(this.tocItemId);
    if (!itemFound) {
      if (this.tocItemId.indexOf(';') > -1) {
        let searchTocId = this.tocItemId.split(';')[0];
        // The current toc item was not found with position in legacy id, so look for toc item without position
        itemFound = this.setCurrentPreviousAndNextItemsFromFlattenedToc(searchTocId);
        if (!itemFound && this.tocItemId.split(';')[0].split('_').length > 2) {
          // The current toc item was not found without position either, so look without chapter if any
          const chapterStartPos = this.tocItemId.split(';')[0].lastIndexOf('_');
          searchTocId = this.tocItemId.slice(0, chapterStartPos);
          itemFound = this.setCurrentPreviousAndNextItemsFromFlattenedToc(searchTocId);
        }
      }
    }
  }

  setCurrentPreviousAndNextItemsFromFlattenedToc(currentTextId: string) {
    // get the id of the current toc item in the flattened toc array
    let currentId = 0;
    let currentItemFound = false;
    for (let i = 0; i < this.flattened.length; i ++) {
      if ( this.flattened[i].itemId === currentTextId ) {
        currentId = i;
        currentItemFound = true;
        break;
      }
    }
    let nextId = 0 as any;
    let prevId = 0 as any;
    // last item
    if ((currentId + 1) === this.flattened.length) {
      // nextId = 0; // this line makes the text-changer into a loop
      nextId = null;
    } else {
      nextId = currentId + 1;
    }

    if (currentId === 0) {
      // prevId = this.flattened.length - 1; // this line makes the text-changer into a loop
      prevId = null;
    } else {
      prevId = currentId - 1;
    }

    // Set the new next, previous and current items only if on page-text in order to prevent these
    // from flashing before the new page is loaded.
    if (this.parentPageType === 'page-text') {
      if (nextId !== null) {
        this.lastItem = false;
        this.nextItem = this.flattened[nextId];
        if (this.nextItem !== undefined && this.nextItem.text !== undefined) {
          this.nextItemTitle = String(this.nextItem.text);
        } else {
          this.nextItemTitle = '';
        }
      } else {
        this.lastItem = true;
        this.nextItem = null;
        this.nextItemTitle = '';
      }
    }

    if (prevId !== null) {
      if (this.parentPageType === 'page-text') {
        this.firstItem = false;
        this.prevItem = this.flattened[prevId];
        if (this.prevItem !== undefined && this.prevItem.text !== undefined) {
          this.prevItemTitle = String(this.prevItem.text);
        } else {
          this.prevItemTitle = '';
        }
      }
    } else {
      if (this.collectionHasIntro) {
        this.firstItem = false;
        this.setPageIntroductionAsPrevious(this.collectionId);
      } else if (this.collectionHasForeword) {
        this.firstItem = false;
        this.setPageForewordAsPrevious(this.collectionId);
      } else if (this.collectionHasTitle) {
        this.firstItem = false;
        this.setPageTitleAsPrevious(this.collectionId);
      } else if (this.collectionHasCover) {
        this.firstItem = false;
        this.setPageCoverAsPrevious(this.collectionId);
      } else {
        this.firstItem = true;
        this.prevItem = null;
        this.prevItemTitle = '';
      }
    }

    if (this.parentPageType === 'page-text') {
      if (this.flattened[currentId] !== undefined) {
        this.currentItemTitle = String(this.flattened[currentId].text);
      } else {
        this.currentItemTitle = '';
      }
    }
    return currentItemFound;
  }

  flatten(toc: any) {
    if (toc !== null && toc !== undefined) {
      if (toc.children) {
        for (let i = 0, count = toc.children.length; i < count; i++) {
          if (toc.children[i].itemId !== undefined && toc.children[i].itemId !== '') {
            this.flattened.push(toc.children[i]);
          }
          this.flatten(toc.children[i]);
        }
      }
    }
  }

  sortFlattenedTocAlphabetically() {
    if (this.flattened.length > 0) {
      this.flattened.sort(
        (a: any, b: any) =>
          (a.text !== undefined && b.text !== undefined) ?
            ((String(a.text).toUpperCase() < String(b.text).toUpperCase()) ? -1 :
            (String(a.text).toUpperCase() > String(b.text).toUpperCase()) ? 1 : 0) : 0
      );
    }
  }

  sortFlattenedTocChronologically() {
    if (this.flattened.length > 0) {
      this.flattened.sort(
        (a: any, b: any) =>
          (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0
      );
    }
  }

  sortFlattenedTocCategorically() {
    const primarySortKey = config.component?.collectionSideMenu?.categoricalSortingPrimaryKey ?? '';
    const secondarySortKey = config.component?.collectionSideMenu?.categoricalSortingSecondaryKey ?? '';

    if (this.flattened.length > 0 && primarySortKey && secondarySortKey) {
      if (primarySortKey === 'date') {
        sortArrayOfObjectsNumerically(this.flattened, primarySortKey, 'asc');
      } else {
        sortArrayOfObjectsAlphabetically(this.flattened, primarySortKey);
      }

      const categorized: any[] = [];
      let categoryItems: any[] = [];
      let prevCategory = '';

      for (let i = 0; i < this.flattened.length; i++) {
        const currentCategory = this.flattened[i][primarySortKey];
        if (i < 1) {
          prevCategory = currentCategory;
        }
        if (currentCategory !== prevCategory) {
          if (secondarySortKey === 'date') {
            sortArrayOfObjectsNumerically(categoryItems, secondarySortKey, 'asc');
          } else if (secondarySortKey) {
            sortArrayOfObjectsAlphabetically(categoryItems, secondarySortKey);
          }
          categorized.push(categoryItems);
          categoryItems = [];
        }
        categoryItems.push(this.flattened[i]);
      }

      if (categoryItems.length > 0) {
        if (secondarySortKey === 'date') {
          sortArrayOfObjectsNumerically(categoryItems, secondarySortKey, 'asc');
        } else if (secondarySortKey) {
          sortArrayOfObjectsAlphabetically(categoryItems, secondarySortKey);
        }
        categorized.push(categoryItems);
      }
      this.flattened = categorized.flat();
    }
  }

  findPrevTitle(toc: any, currentIndex: any, prevChild?: any) {
    if (currentIndex === 0) {
      this.findPrevTitle(prevChild, prevChild.length);
    }
    for (let i = currentIndex; i > 0; i--) {
      if (toc[i - 1] !== undefined) {
        if (toc[i - 1].type !== 'subtitle' && toc[i - 1].type !== 'section_title') {
          return toc[i - 1];
        }
      }
    }
  }

  async open(item: any) {
    if (item.page !== undefined) {
      // Open text in page-cover, page-title, page-foreword, page-introduction or media-collection
      if (item.page === 'page-cover') {
        this.router.navigate(['/collection', item.itemId, 'cover']);
      } else if (item.page === 'page-title') {
        this.router.navigate(['/collection', item.itemId, 'title']);
      } else if (item.page === 'page-foreword') {
        this.router.navigate(['/collection', item.itemId, 'foreword']);
      } else if (item.page === 'page-introduction') {
        this.router.navigate(['/collection', item.itemId, 'introduction']);
      } else if (item.page === 'media-collection') {
        this.router.navigate(['/media-collection']);
      }
    } else {
      // Open text in page-text
      let itemIdParts = item.itemId.split(';');
      let positionId = '';
      if (itemIdParts.length > 1) {
        positionId = itemIdParts[1];
      }
      itemIdParts = itemIdParts[0].split('_');
      const collectionId = itemIdParts[0];
      const publicationId = itemIdParts[1];
      let chapterId = '';
      if (itemIdParts.length > 2) {
        chapterId = itemIdParts[2];
      }

      this.router.navigate(
        (
          chapterId ? ['/collection', collectionId, 'text', publicationId, chapterId] :
          ['/collection', collectionId, 'text', publicationId]
        ),
        (positionId ? { queryParams: { position: positionId } } : {})
      );
    }
  }

}
