import { ChangeDetectionStrategy, Component, Injector, NgZone, afterRenderEffect, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink, UrlSegment } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { distinctUntilChanged, filter } from 'rxjs';

import { config } from '@config';
import { ArrayIncludesAnyPipe } from '@pipes/array-includes-any.pipe';
import { ArrayIncludesPipe } from '@pipes/array-includes.pipe';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { CollectionPagePositionQueryparamPipe } from '@pipes/collection-page-position-queryparam.pipe';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { ScrollService } from '@services/scroll.service';
import { addOrRemoveValueInNewArray, enableFrontMatterPageOrTextViewType, isBrowser } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
// Because pure pipes are used in the template to check included items in
// `selectedMenu`, the array has to be recreated every time it changes, otherwise
// the changes won't be reflected in the view.
@Component({
  selector: 'collection-side-menu',
  templateUrl: './collection-side-menu.component.html',
  styleUrls: ['./collection-side-menu.component.scss'],
  imports: [
    NgTemplateOutlet, IonicModule, RouterLink,
    ArrayIncludesAnyPipe, ArrayIncludesPipe, CollectionPagePathPipe,
    CollectionPagePositionQueryparamPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionSideMenuComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private readonly injector = inject(Injector);
  private readonly ngZone = inject(NgZone);
  private readonly scrollService = inject(ScrollService);
  private readonly tocService = inject(CollectionTableOfContentsService);

  readonly collectionID = input<string>('');
  readonly routeQueryParams = input<Params>();
  readonly routeUrlSegments = input<UrlSegment[]>();
  readonly sideMenuToggled = input<boolean>(true);

  readonly sortSelectOptions: Record<string, string> = {
    header: $localize`:@@CollectionSideMenu.SortOptions.SelectSorting:Välj sortering för innehållsförteckningen`,
    cssClass: 'custom-select-alert'
  };

  // --- State as signals
  readonly isLoading = signal<boolean>(true);

  readonly activeMenuOrder = signal<string>('');
  readonly collectionMenu = signal<any[]>([]);
  readonly currentMenuItemId = signal<string | null>(null);
  readonly selectedMenu = signal<string[]>([]);  // list of all open menu ids

  readonly menuReady = signal(false);           // true after a TOC load finishes
  readonly menuReadyStamp = signal(0);          // increments after each TOC load
  readonly initialScrollTimeout = signal(600);  // 1000 or 700 on TOC change

  readonly collectionTitle = signal<string>('');
  readonly coverPageName = signal<string>('');
  readonly titlePageName = signal<string>('');
  readonly forewordPageName = signal<string>('');
  readonly introductionPageName = signal<string>('');

  readonly enableCover = signal<boolean>(false);
  readonly enableTitle = signal<boolean>(false);
  readonly enableForeword = signal<boolean>(false);
  readonly enableIntroduction = signal<boolean>(false);

  // --- Derived: sorting options depend only on collectionID
  readonly sortOptions = computed<string[]>(
    () => this.computeSortOptions(this.collectionID())
  );

  // --- TOC as a signal
  private readonly tocSig = toSignal(
    this.tocService.getCurrentCollectionToc().pipe(
      filter((toc: any) => !!toc),
      distinctUntilChanged((prev: any, curr: any) =>
        prev?.collectionId === curr?.collectionId &&
        prev?.order === curr?.order
      )
    ),
    { initialValue: null }
  );


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire data loads, highlighting and scrolling
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.registerFrontmatterPageUpdates();
    this.registerHighlightDispatcher();
    this.registerTocUpdates();
    this.registerScrollOnSideNavToggle();
  }

  private registerFrontmatterPageUpdates() {
    // Keep “frontmatter pages” flags in sync with collectionID
    effect(() => {
      const id = this.collectionID();
      if (!id) {
        return;
      }

      this.updateFrontmatterPages(id);

      // a new collection implies a new TOC soon; gate highlighting until then
      this.menuReady.set(false);
    }, { injector: this.injector });
  }

  private registerHighlightDispatcher() {
    let prevReadyStamp = 0;
    let prevRouteKey = '';

    effect(() => {
      const ready = this.menuReady();
      const readyStamp = this.menuReadyStamp();   // bumps after each TOC load
      const key = this.routeKey();

      if (!ready) {               // menu not ready => do nothing
        prevRouteKey = key;
        prevReadyStamp = readyStamp;
        return;
      }

      if (readyStamp !== prevReadyStamp) {
        // New TOC just loaded: do the one-time initial highlight (1000/700)
        const t = untracked(this.initialScrollTimeout);
        untracked(() => this.updateHighlightedMenuItem(t));
        prevRouteKey = key;
        prevReadyStamp = readyStamp;
        return;
      }

      if (key !== prevRouteKey) {
        // Route-only change (menu already ready): use default 600
        untracked(() => this.updateHighlightedMenuItem());
        prevRouteKey = key;
      }
    }, { injector: this.injector });
  }

  private registerTocUpdates() {
    // React to TOC updates
    effect(() => {
      const toc: any | null = this.tocSig();
      if (!toc) {
        return;
      }

      this.isLoading.set(true);

      // reset state for new menu
      this.collectionMenu.set([]);
      this.selectedMenu.set([]);
      this.currentMenuItemId.set('');

      // compute initial scroll timeout based on order change
      const scrollTimeout = untracked(this.activeMenuOrder) !== toc.order ? 1000 : 700;
      this.activeMenuOrder.set(toc.order || 'default');
      this.initialScrollTimeout.set(scrollTimeout);

      // set title and labels
      this.collectionTitle.set(toc.text || '');
      this.coverPageName.set(
        toc.coverPageName || $localize`:@@CollectionCover.Cover:Omslag`
      );
      this.titlePageName.set(
        toc.titlePageName || $localize`:@@CollectionTitle.TitlePage:Titelblad`
      );
      this.forewordPageName.set(
        toc.forewordPageName || $localize`:@@CollectionForeword.Foreword:Förord`
      );
      this.introductionPageName.set(
        toc.introductionPageName || $localize`:@@CollectionIntroduction.Introduction:Inledning`
      );

      // set menu tree + initial open nodes
      if (toc.children?.length) {
        const selected = this.recursiveInitializeSelectedMenu(toc.children, []);
        this.selectedMenu.set(selected);
        this.collectionMenu.set(toc.children);
      }

      this.isLoading.set(false);

      // signal that menu is ready and bump the “clock” for this TOC load
      this.menuReady.set(true);
      this.menuReadyStamp.update(n => n + 1);
    }, { injector: this.injector });
  }

  private registerScrollOnSideNavToggle() {
    let prevToggled = true;
    // Whenever the side menu becomes visible, scroll current item into view
    afterRenderEffect({
      write: () => {
        const toggled = this.sideMenuToggled();
        if (toggled && !prevToggled && untracked(this.menuReady)) {
          this.scrollHighlightedMenuItemIntoView(
            untracked(() => this.getItemId()), 200
          );
        }
        prevToggled = toggled;
      }
    }, { injector: this.injector })
  }

  private updateFrontmatterPages(collectionID: string) {
    this.enableCover.set(
      enableFrontMatterPageOrTextViewType('cover', collectionID, config)
    );
    this.enableTitle.set(
      enableFrontMatterPageOrTextViewType('title', collectionID, config)
    );
    this.enableForeword.set(
      enableFrontMatterPageOrTextViewType('foreword', collectionID, config)
    );
    this.enableIntroduction.set(
      enableFrontMatterPageOrTextViewType('introduction', collectionID, config)
    );
  }

  private routeKey(): string {
    const segs = this.routeUrlSegments();
    const pos  = this.routeQueryParams()?.position;
    return (segs?.map(s => s.path).join('/') ?? '') + ';' + (pos ?? '');
  }

  private updateHighlightedMenuItem(scrollTimeout: number = 600) {
    // Remove previously highlighted menu item from selectedMenu if present
    const selectedMenu = this.selectedMenu();
    const currentId = this.currentMenuItemId();
    if (currentId && selectedMenu.includes(currentId)) {
      this.selectedMenu.set(selectedMenu.filter(id => id !== currentId));
    }

    // Resolve new selected item and it's menu path
    let itemId = this.getItemId();

    if (this.routeUrlSegments()?.[2]?.path === 'text') {
      const collectionMenu = this.collectionMenu();
      // Try full itemId first
      let path = this.findPathToItem(collectionMenu, itemId);

      // If not found, try without the position part
      if (!path) {
        const idParts = itemId.split(';');
        if (idParts[1]) {
          itemId = idParts[0];
          path = this.findPathToItem(collectionMenu, itemId);
        }
      }

      // Open all branches in the path (union into a *new* array for
      // OnPush + pure pipes)
      if (path?.length) {
        const set = new Set(this.selectedMenu());
        for (const id of path) {
          if (id) {
            set.add(id);
          }
        }
        this.selectedMenu.set(Array.from(set));
      }
    }

    // Update currently selected menu item
    this.currentMenuItemId.set(itemId);
    this.scrollHighlightedMenuItemIntoView(itemId, scrollTimeout);
  }

  private getItemId(): string {
    const seg = this.routeUrlSegments();
    const pageType = seg?.[2]?.path ?? undefined;

    if (seg?.[2]?.path === 'text') {
      const textItemId = [
        seg?.[1]?.path,
        seg?.[3]?.path,
        seg?.[4]?.path
      ].filter(Boolean).join('_');

      const qp = this.routeQueryParams();
      return qp?.position ? `${textItemId};${qp.position}` : textItemId;
    } else {
      return pageType ?? 'cover';
    }
  }

  private getSelectableId(item: any): string | undefined {
    return item?.itemId || item?.nodeId;
  }

  /**
   * Depth-first search that returns the *path* of ids to open from root to the
   * matched item. Each element in the path is item.itemId (if present) else item.nodeId.
   * Returns null if not found. No side effects.
   */
  private findPathToItem(array: any[] | undefined, searchItemId: string): string[] | null {
    if (!Array.isArray(array) || !searchItemId) return null;

    for (const item of array) {
      const selfId = this.getSelectableId(item);
      if (item?.itemId === searchItemId) {
        return selfId ? [selfId] : [];
      }
      const children = item?.children as any[] | undefined;
      if (children?.length) {
        const childPath = this.findPathToItem(children, searchItemId);
        if (childPath) {
          return selfId ? [selfId, ...childPath] : childPath;
        }
      }
    }
    return null;
  }

  /**
   * Recursively add `nodeId` property to each object in the given array (in-place).
   * `nodeId` is a string starting with "n" and followed by incremental numbers.
   * Each new branch is indicated by a dash and the counter is reset.
   * For example: n1-1-2. This way each item gets a unique identifier.
   * The method returns a new array of the given `accMenu` menu items containing
   * any items with `collapsed` property set to `false`.
   */
  private recursiveInitializeSelectedMenu(
    array: any[],
    accMenu: string[],
    parentNodeId?: string
  ): string[] {
    for (let i = 0; i < array.length; i++) {
      array[i]["nodeId"] = (parentNodeId ? `${parentNodeId}-` : 'n') + (i+1);

      if (array[i]["collapsed"] === false) {
        const selectedId = array[i]["itemId"] || array[i]["nodeId"];
        accMenu = addOrRemoveValueInNewArray(accMenu, selectedId);
      }

      if (array[i]["children"]?.length) {
        accMenu = this.recursiveInitializeSelectedMenu(
          array[i]["children"], accMenu, array[i]["nodeId"]
        );
      }
    }
    return accMenu;
  }

  private scrollHighlightedMenuItemIntoView(itemId: string, timeout: number = 600) {
    if (!isBrowser()) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        const container = document.querySelector<HTMLElement>('.side-navigation');
        const target = document.querySelector<HTMLElement>(
          `collection-side-menu [data-id="toc_${itemId}"] .menu-highlight`
        );
        if (container && target) {
          this.scrollService.scrollElementIntoView(
            target, 'center', 0, 'smooth', container
          );
        }
      }, timeout);
    });
  }

  private computeSortOptions(collectionID: string) {
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


  // ─────────────────────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────────────────────

  toggle(menuItem: any) {
    const id = menuItem.itemId || menuItem.nodeId;
    this.selectedMenu.set(addOrRemoveValueInNewArray(this.selectedMenu(), id));
  }

  async setActiveMenuSorting(event: any) {
    if (this.activeMenuOrder() !== event.detail.value) {
      this.tocService.setCurrentCollectionToc(
        this.collectionID(), event.detail.value
      );
    }
  }

}
