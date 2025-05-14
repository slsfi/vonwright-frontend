import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink, UrlSegment } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { config } from '@config';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { CollectionPagePositionQueryparamPipe } from '@pipes/collection-page-position-queryparam.pipe';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { ScrollService } from '@services/scroll.service';
import { addOrRemoveValueInArray, isBrowser } from '@utility-functions';


@Component({
  selector: 'collection-side-menu',
  templateUrl: './collection-side-menu.component.html',
  styleUrls: ['./collection-side-menu.component.scss'],
  imports: [NgClass, NgTemplateOutlet, IonicModule, RouterLink, CollectionPagePathPipe, CollectionPagePositionQueryparamPipe]
})
export class CollectionSideMenuComponent implements OnInit, OnChanges, OnDestroy {
  @Input() collectionID: string = '';
  @Input() routeQueryParams: Params;
  @Input() routeUrlSegments: UrlSegment[];
  @Input() sideMenuToggled: boolean = true;

  activeMenuOrder: string = '';
  collectionMenu: any[] = [];
  collectionTitle: string = '';
  currentMenuItemId: string = '';
  enableCover: boolean = false;
  enableTitle: boolean = false;
  enableForeword: boolean = false;
  enableIntroduction: boolean = false;
  isLoading: boolean = true;
  selectedMenu: string[] = []; // list of all open menu items in the menu tree
  sortOptions: string[] = [];
  sortSelectOptions: Record<string, any> = {};
  tocSubscr: Subscription | null = null;

  constructor(
    private scrollService: ScrollService,
    private tocService: CollectionTableOfContentsService
  ) {
    this.enableCover = config.collections?.frontMatterPages?.cover ?? false;
    this.enableTitle = config.collections?.frontMatterPages?.title ?? false;
    this.enableForeword = config.collections?.frontMatterPages?.foreword ?? false;
    this.enableIntroduction = config.collections?.frontMatterPages?.introduction ?? false;

    this.sortSelectOptions = {
      header: $localize`:@@CollectionSideMenu.SortOptions.SelectSorting:Välj sortering för innehållsförteckningen`,
      cssClass: 'custom-select-alert'
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    // Check if the changed input values are relevant, i.e. require the side
    // menu to be updated. If just some other queryParams than position have
    // changed, no action is necessary in the menu.
    for (const propName in changes) {
      if (changes.hasOwnProperty(propName)) {
        if (
          propName === 'collectionID' &&
          changes.collectionID.previousValue !== changes.collectionID.currentValue
        ) {
          // Collection changed, the new menu will be loaded in the subscription
          // in ngOnInit(), so no need to do anything here.
          break;
        } else if (
          (
            propName === 'routeUrlSegments' &&
            JSON.stringify(changes.routeUrlSegments.previousValue) !== JSON.stringify(changes.routeUrlSegments.currentValue)
          ) || (
            propName === 'routeQueryParams' &&
            changes.routeQueryParams.previousValue.position !== changes.routeQueryParams.currentValue.position
          )
        ) {
          // The collection text or text position has changed, so update which
          // menu item is highlighted.
          this.collectionMenu?.length && this.updateHighlightedMenuItem();
          break;
        } else if (
          propName === 'sideMenuToggled' &&
          changes.sideMenuToggled.previousValue !== changes.sideMenuToggled.currentValue &&
          changes.sideMenuToggled.currentValue
        ) {
          // The side menu has been toggled visible, so scroll the menu
          // vertically so the current menu item is visible.
          this.scrollHighlightedMenuItemIntoView(this.getItemId(), 200);
        }
      }
    }
  }

  ngOnInit() {
    // Subscribe to BehaviorSubject emitting the current TOC.
    // The received TOC is already properly ordered.
    this.tocSubscr = this.tocService.getCurrentCollectionToc().subscribe(
      (toc: any) => {
        this.isLoading = true;
        this.collectionMenu = [];
        this.selectedMenu = [];
        this.currentMenuItemId = '';

        const scrollTimeout = this.activeMenuOrder !== toc?.order ? 1000 : 700;
        this.activeMenuOrder = toc?.order || 'default';

        if (toc?.children?.length) {
          this.recursiveInitializeSelectedMenu(toc.children);
          this.collectionTitle = toc.text || '';
          this.collectionMenu = toc.children;
          this.isLoading = false;
          this.updateHighlightedMenuItem(scrollTimeout);
        }

        this.sortOptions = this.setSortOptions(this.collectionID);
      }
    );
  }

  ngOnDestroy() {
    this.tocSubscr?.unsubscribe();
  }

  private updateHighlightedMenuItem(scrollTimeout: number = 600) {
    const itemId = this.getItemId();
    this.currentMenuItemId = itemId;
    if (this.routeUrlSegments[2].path === 'text') {
      const item = this.recursiveFindMenuItem(this.collectionMenu, itemId);
      if (item && !this.selectedMenu.includes(item.itemId || item.nodeId)) {
        this.selectedMenu.push(item.itemId || item.nodeId);
      }
    }
    this.scrollHighlightedMenuItemIntoView(itemId, scrollTimeout);
  }

  private getItemId(): string {
    let itemId = '';
    itemId += this.routeUrlSegments[1]?.path ? `${this.routeUrlSegments[1].path}` : '';
    itemId += this.routeUrlSegments[3]?.path ? `_${this.routeUrlSegments[3].path}` : '';
    itemId += this.routeUrlSegments[4]?.path ? `_${this.routeUrlSegments[4].path}` : '';

    itemId += this.routeQueryParams.position ? `;${this.routeQueryParams.position}` : '';
    return itemId;
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
          this.selectedMenu.push(result.itemId || result.nodeId);
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
      array[i]["nodeId"] = (parentNodeId ? parentNodeId + '-' : 'n') + (i+1);
      if (array[i]["collapsed"] === false) {
        if (array[i]["itemId"]) {
          this.selectedMenu.push(array[i]["itemId"]);
        } else {
          this.selectedMenu.push(array[i]["nodeId"]);
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
              ? 'toc_' + itemId
              : 'toc_' + this.routeUrlSegments[2].path;
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
    addOrRemoveValueInArray(this.selectedMenu, menuItem.itemId || menuItem.nodeId);
  }

  async setActiveMenuSorting(event: any) {
    if (this.activeMenuOrder !== event.detail.value) {
      this.tocService.setCurrentCollectionToc(
        this.collectionID, event.detail.value
      );
    }
  }

}
