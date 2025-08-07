import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges,
  OnDestroy, OnInit, SimpleChanges
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink, UrlSegment } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { distinctUntilChanged, filter, Subscription } from 'rxjs';

import { config } from '@config';
import { ArrayIncludesAnyPipe } from '@pipes/array-includes-any.pipe';
import { ArrayIncludesPipe } from '@pipes/array-includes.pipe';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { CollectionPagePositionQueryparamPipe } from '@pipes/collection-page-position-queryparam.pipe';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { ScrollService } from '@services/scroll.service';
import { addOrRemoveValueInNewArray, enableFrontMatterPageOrTextViewType, isBrowser } from '@utility-functions';

/**
 * * This component uses ChangeDetectionStrategy.OnPush so change detection has to
 * * be manually triggered in the component whenever the `selectedMenu` array changes.
 * * Because pure pipes are used in the template to check included items in
 * * `selectedMenu`, the array has to be recreated every time it changes, otherwise
 * * the changes won't be reflected in the view.
 */
@Component({
  selector: 'collection-side-menu',
  templateUrl: './collection-side-menu.component.html',
  styleUrls: ['./collection-side-menu.component.scss'],
  imports: [
    NgClass, NgTemplateOutlet, IonicModule, RouterLink,
    ArrayIncludesAnyPipe, ArrayIncludesPipe, CollectionPagePathPipe,
    CollectionPagePositionQueryparamPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionSideMenuComponent implements OnInit, OnChanges, OnDestroy {
  @Input() collectionID: string = '';
  @Input() routeQueryParams: Params;
  @Input() routeUrlSegments: UrlSegment[];
  @Input() sideMenuToggled: boolean = true;

  activeMenuOrder: string = '';
  collectionMenu: any[] = [];
  collectionTitle: string = '';
  coverPageName: string = '';
  currentMenuItemId: string = '';
  enableCover: boolean = false;
  enableTitle: boolean = false;
  enableForeword: boolean = false;
  enableIntroduction: boolean = false;
  forewordPageName: string = '';
  introductionPageName: string = '';
  isLoading: boolean = true;
  selectedMenu: string[] = []; // list of all open menu items in the menu tree
  sortOptions: string[] = [];
  sortSelectOptions: Record<string, any> = {};
  titlePageName: string = '';
  tocSubscr: Subscription | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private scrollService: ScrollService,
    private tocService: CollectionTableOfContentsService
  ) {
    this.sortSelectOptions = {
      header: $localize`:@@CollectionSideMenu.SortOptions.SelectSorting:Välj sortering för innehållsförteckningen`,
      cssClass: 'custom-select-alert'
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    // Check if the changed input values are relevant, i.e. require the side
    // menu to be updated. If just some other queryParams than position have
    // changed, no action is necessary in the menu.
    if (
      changes.collectionID &&
      changes.collectionID.previousValue !== changes.collectionID.currentValue
    ) {
      // Collection changed, the new menu will be loaded in the subscription
      // in ngOnInit(). Update collection frontmatter pages if collectionID set.
      if (this.collectionID) {
        this.updateFrontmatterPages();
      }
      return;
    }

    const urlChanged = changes.routeUrlSegments &&
          this.segmentsChanged(
            changes.routeUrlSegments.previousValue,
            changes.routeUrlSegments.currentValue
          );

    const positionChanged =
          changes.routeQueryParams &&
          changes.routeQueryParams.previousValue?.position !== changes.routeQueryParams.currentValue?.position;

    if (urlChanged || positionChanged) {
      // The collection text or text position has changed, so update which
      // menu item is highlighted.
      if (this.collectionMenu?.length) {
        this.updateHighlightedMenuItem()
      }
      return;
    }

    if (
      changes.sideMenuToggled &&
      changes.sideMenuToggled.previousValue !== changes.sideMenuToggled.currentValue &&
      changes.sideMenuToggled.currentValue
    ) {
      // The side menu has been toggled visible, so scroll the menu
      // vertically so the current menu item is visible.
      this.scrollHighlightedMenuItemIntoView(this.getItemId(), 200);
    }
  }

  ngOnInit() {
    this.updateFrontmatterPages();

    // Subscribe to BehaviorSubject emitting the current TOC.
    // The received TOC is already properly ordered.
    this.tocSubscr = this.tocService.getCurrentCollectionToc().pipe(
      filter(toc => !!toc),
      distinctUntilChanged((prev, curr) =>
        prev.collectionId === curr.collectionId &&
        prev.order === curr.order
      )
    ).subscribe(
      (toc: any) => {
        this.isLoading = true;
        this.collectionMenu = [];
        this.selectedMenu = [];
        this.currentMenuItemId = '';

        const scrollTimeout = this.activeMenuOrder !== toc.order ? 1000 : 700;
        this.activeMenuOrder = toc.order || 'default';

        this.collectionTitle = toc.text || '';
        this.coverPageName = toc.coverPageName || $localize`:@@CollectionCover.Cover:Omslag`;
        this.titlePageName = toc.titlePageName || $localize`:@@CollectionTitle.TitlePage:Titelblad`;
        this.forewordPageName = toc.forewordPageName || $localize`:@@CollectionForeword.Foreword:Förord`;
        this.introductionPageName = toc.introductionPageName || $localize`:@@CollectionIntroduction.Introduction:Inledning`;

        if (toc.children?.length) {
          this.recursiveInitializeSelectedMenu(toc.children);
          this.collectionMenu = toc.children;
        }

        this.sortOptions = this.setSortOptions(this.collectionID);

        this.isLoading = false;
        this.updateHighlightedMenuItem(scrollTimeout);
      }
    );
  }

  ngOnDestroy() {
    this.tocSubscr?.unsubscribe();
  }

  private updateFrontmatterPages() {
    this.enableCover = enableFrontMatterPageOrTextViewType('cover', this.collectionID, config);
    this.enableTitle = enableFrontMatterPageOrTextViewType('title', this.collectionID, config);
    this.enableForeword = enableFrontMatterPageOrTextViewType('foreword', this.collectionID, config);
    this.enableIntroduction = enableFrontMatterPageOrTextViewType('introduction', this.collectionID, config);
    this.cdr.markForCheck();
  }

  private updateHighlightedMenuItem(scrollTimeout: number = 600) {
    const itemId = this.getItemId();
    this.currentMenuItemId = itemId;
    if (this.routeUrlSegments[2].path === 'text') {
      const item = this.recursiveFindMenuItem(this.collectionMenu, itemId);
      if (item && !this.selectedMenu.includes(item.itemId || item.nodeId)) {
        this.selectedMenu = addOrRemoveValueInNewArray(
          this.selectedMenu,
          item.itemId || item.nodeId
        );
      }
    }
    this.cdr.markForCheck();
    this.scrollHighlightedMenuItemIntoView(itemId, scrollTimeout);
  }

  /**
   * Compares two arrays of Angular UrlSegment objects by their `path` values.
   *
   * Returns true if:
   * - Either array is missing
   * - The arrays have different lengths
   * - Any segment's path differs
   *
   * This is useful for determining if a router URL structure has changed between input updates.
   *
   * @param a The previous array of UrlSegment objects
   * @param b The current array of UrlSegment objects
   * @returns `true` if any path differs, otherwise `false`
   */
  private segmentsChanged(a: UrlSegment[], b: UrlSegment[]): boolean {
    if (!a || !b || a.length !== b.length) return true;
    return a.some((seg, i) => seg.path !== b[i].path);
  }

  private getItemId(): string {
    const parts = [
      this.routeUrlSegments[1]?.path,
      this.routeUrlSegments[3]?.path,
      this.routeUrlSegments[4]?.path
    ].filter(Boolean).join('_');

    return this.routeQueryParams.position ? `${parts};${this.routeQueryParams.position}` : parts;
  }

  /**
   * Recursively search array for an object that has an 'itemId' property
   * equal to 'searchItemId'. If found, the item is marked as the selected
   * item in the side menu.
   */
  private recursiveFindMenuItem(array: any[], searchItemId: string): any {
    return array.find(item => {
      if (item.itemId === searchItemId) {
        return item;
      } else if (item.children) {
        const result = this.recursiveFindMenuItem(item.children, searchItemId);
        if (
          result &&
          !this.selectedMenu.includes(result.itemId || result.nodeId)
        ) {
          this.selectedMenu = addOrRemoveValueInNewArray(
            this.selectedMenu,
            result.itemId || result.nodeId
          );
        }
        return result;
      } else {
        return undefined;
      }
    });
  }

  /**
   * Recursively add nodeId property to each object in the array and push any items
   * with collapsed property false to selectedMenu. nodeId is a string starting
   * with "n" and followed by running numbers. Each new branch is indicated by a
   * dash and the counter is reset. For example: n1-1-2. This way each item gets
   * a unique identifier.
   */
  private recursiveInitializeSelectedMenu(array: any[], parentNodeId?: string) {
    for (let i = 0; i < array.length; i++) {
      array[i]["nodeId"] = (parentNodeId ? `${parentNodeId}-` : 'n') + (i+1);
      if (array[i]["collapsed"] === false) {
        if (array[i]["itemId"]) {
          this.selectedMenu = addOrRemoveValueInNewArray(this.selectedMenu, array[i]["itemId"]);
        } else {
          this.selectedMenu = addOrRemoveValueInNewArray(this.selectedMenu, array[i]["nodeId"]);
        }
      }
      if (array[i]["children"] && array[i]["children"].length) {
        this.recursiveInitializeSelectedMenu(array[i]["children"], array[i]["nodeId"]);
      }
    }
  }

  private scrollHighlightedMenuItemIntoView(
    itemId: string,
    scrollTimeout: number = 600
  ) {
    if (isBrowser()) {
      setTimeout(() => {
        const dataIdValue = this.routeUrlSegments[2].path === 'text'
              ? `toc_${itemId}`
              : `toc_${this.routeUrlSegments[2].path}`;
        const container = document.querySelector('.side-navigation') as HTMLElement;
        const target = document.querySelector(
          'collection-side-menu [data-id="' + dataIdValue + '"] .menu-highlight'
        ) as HTMLElement;
        if (container && target) {
          this.scrollService.scrollElementIntoView(
            target, 'center', 0, 'smooth', container
          );
        }
      }, scrollTimeout);
    }
  }

  private setSortOptions(collectionID: string) {
    const sortOptions: string[] = [];
    if (config.component?.collectionSideMenu?.
            sortableCollectionsAlphabetical?.includes(collectionID)) {
      sortOptions.push('alphabetical');
    }
    if (config.component?.collectionSideMenu?.
            sortableCollectionsChronological?.includes(collectionID)) {
      sortOptions.push('chronological');
    }
    if (config.component?.collectionSideMenu?.
            sortableCollectionsCategorical?.includes(collectionID)) {
      sortOptions.push('categorical');
    }
    return sortOptions;
  }

  toggle(menuItem: any) {
    this.selectedMenu = addOrRemoveValueInNewArray(this.selectedMenu, menuItem.itemId || menuItem.nodeId);
    this.cdr.markForCheck();
  }

  async setActiveMenuSorting(event: any) {
    if (this.activeMenuOrder !== event.detail.value) {
      this.tocService.setCurrentCollectionToc(
        this.collectionID, event.detail.value
      );
    }
  }

}
