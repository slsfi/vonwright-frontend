import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { DocumentHeadService } from '@services/document-head.service';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { CollectionPagePositionQueryparamPipe } from '@pipes/collection-page-position-queryparam.pipe';
import { PlatformService } from '@services/platform.service';


/**
 * Component for displaying the title of the current collection page as well
 * as links to the previous and next collection page based on the collection
 * menu/table of contents. This component is responsible for setting the 
 * document title to the title of the current text for collection pages.
 * Thus this component must always be server-side rendered.
 */
@Component({
  standalone: true,
  selector: 'text-changer',
  templateUrl: './text-changer.component.html',
  styleUrls: ['./text-changer.component.scss'],
  imports: [NgIf, RouterLink, IonicModule, CollectionPagePathPipe, CollectionPagePositionQueryparamPipe]
})
export class TextChangerComponent implements OnChanges, OnDestroy, OnInit {
  @Input() parentPageType: string = '';
  @Input() textItemID: string = '';
  @Input() textPosition: string = '';

  collectionId: string = '';
  collectionTitle: string = '';
  currentTocTextIndex: number = 0;
  flattenedToc: any[] = [];
  frontMatterPages: any[] = [];
  mobileMode: boolean = false;
  tocItemId: string = '';
  tocSubscr: Subscription | null = null;

  constructor(
    private headService: DocumentHeadService,
    private platformService: PlatformService,
    private tocService: CollectionTableOfContentsService
  ) {}

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

    if (!firstChange) {
      this.updateVariables();
      this.updateCurrentText();
    }
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();
    this.updateVariables();
    this.setFrontmatterPagesArray();

    // Subscribe to BehaviorSubject emitting the current (flattened) TOC.
    // The received TOC is already properly ordered.
    this.tocSubscr = this.tocService.getCurrentFlattenedCollectionToc().subscribe(
      (toc: any) => {
        if (
          toc?.children?.length &&
          this.collectionId === String(toc?.collectionId)
        ) {
          this.collectionTitle = toc.text || '';
          // Prepend the frontmatter pages to the TOC array
          this.flattenedToc = this.frontMatterPages.concat(toc.children);
          // Search for the current text in the array and display it
          this.updateCurrentText();
        }
      }
    );
  }

  ngOnDestroy() {
    this.tocSubscr?.unsubscribe();
  }

  private updateVariables() {
    if (!this.parentPageType) {
      this.parentPageType = 'text';
    }

    this.collectionId = this.textItemID.split('_')[0];
    this.tocItemId = this.textPosition
          ? this.textItemID + ';' + this.textPosition
          : this.textItemID;
  }

  private setFrontmatterPagesArray() {
    if (config.collections?.frontMatterPages?.cover) {
      this.frontMatterPages.push({
        text: $localize`:@@CollectionCover.Cover:Omslag`,
        page: 'cover',
        itemId: this.collectionId
      });
    }
    if (config.collections?.frontMatterPages?.title) {
      this.frontMatterPages.push({
        text: $localize`:@@CollectionTitle.TitlePage:Titelblad`,
        page: 'title',
        itemId: this.collectionId
      });
    }
    if (config.collections?.frontMatterPages?.foreword) {
      this.frontMatterPages.push({
        text: $localize`:@@CollectionForeword.Foreword:Förord`,
        page: 'foreword',
        itemId: this.collectionId
      });
    }
    if (config.collections?.frontMatterPages?.introduction) {
      this.frontMatterPages.push({
        text: $localize`:@@CollectionIntroduction.Introduction:Inledning`,
        page: 'introduction',
        itemId: this.collectionId
      });
    }
  }

  /**
   * Updates the text that's displayed as the current text (as well as the
   * previous and next text), and sets the document title to the current
   * text title. If the current text is a positioned heading in a longer
   * text, the patent text title is set as the document title.
   */
  private updateCurrentText() {
    const foundTextIndex = this.getCurrentTextIndex();
    if (foundTextIndex > -1) {
      this.currentTocTextIndex = foundTextIndex;
    } else {
      console.error('Unable to find the current text in flattenedTOC in text-changer component.');
      this.currentTocTextIndex = 0;
    }

    // Set the document title to the current text title.
    // Positioned item's title should not be set, instead we have to
    // search for the non-positioned item's title.
    let titleItemIndex = this.currentTocTextIndex;
    if (this.textPosition) {
      titleItemIndex = this.flattenedToc.findIndex(
        ({ itemId }) => itemId === this.textItemID
      );
    }

    const itemTitle = titleItemIndex > -1
          ? this.flattenedToc[titleItemIndex].text || ''
          : this.flattenedToc[this.currentTocTextIndex].text || '';
    this.headService.setTitle([itemTitle, this.collectionTitle]);
  }

  private getCurrentTextIndex() {
    let currentTextIndex = -1;
    for (let i = 0; i < this.flattenedToc.length; i++) {
      if (!this.flattenedToc[i].page) {
        // Text page
        if (this.flattenedToc[i].itemId === this.tocItemId) {
          return i;
        }
      } else if (this.flattenedToc[i].page === this.parentPageType) {
        // Front matter page
        return i;
      }
    }
    return currentTextIndex;
  }

}
