import { ChangeDetectionStrategy, Component, LOCALE_ID, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, UrlSegment } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

import { config } from '@config';
import { Article } from '@models/article.models';
import { Collection } from '@models/collection.models';
import { MediaCollection } from '@models/media-collection.models';
import { fromCollectionToMainMenuNode, fromMdToMainMenuNode, fromMediaCollectionToMainMenuNode, MainMenuGroupNode, MainMenuNode, MdMenuNodeApiResponse } from '@models/menu.models';
import { ArrayIncludesPipe } from '@pipes/array-includes.pipe';
import { ParentChildPagePathPipe } from '@pipes/parent-child-page-path.pipe';
import { CollectionsService } from '@services/collections.service';
import { DocumentHeadService } from '@services/document-head.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { addOrRemoveValueInNewArray, sortArrayOfObjectsAlphabetically, splitFilename } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
// Because pure pipes are used in the template to check included items in
// `selectedMenu`, the array has to be recreated every time it changes, otherwise
// the changes won't be reflected in the view.
@Component({
  selector: 'main-side-menu',
  templateUrl: './main-side-menu.component.html',
  styleUrls: ['./main-side-menu.component.scss'],
  imports: [
    NgTemplateOutlet, IonicModule, RouterLink, ArrayIncludesPipe,
    ParentChildPagePathPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainSideMenuComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private readonly collectionsService = inject(CollectionsService);
  private readonly headService = inject(DocumentHeadService);
  private readonly mdcontentService = inject(MarkdownService);
  private readonly mediaCollectionService = inject(MediaCollectionService);
  private readonly activeLocale = inject(LOCALE_ID);

  readonly urlSegments = input<UrlSegment[]>([]);

  readonly mainMenu = signal<MainMenuNode[]>([]);
  readonly selectedMenu = signal<string[]>([]);
  readonly highlightedNodeId = signal<string>('');

  // Config flag: expand root items on first load
  private readonly defaultExpanded = config.component?.mainSideMenu?.defaultExpanded ?? false;

  // List of paths to pages that are accessed from the top menu. The HTML document
  // title for these is NOT set by this component, but by app.component.ts.
  private readonly topMenuItems: readonly string[] = ['/', '/content', '/search'];

  // Menu Observable to signal
  private readonly menuDataSig = toSignal<MainMenuNode[] | null>(
    this.getMenuData() as Observable<MainMenuNode[]>,
    { initialValue: null }
  );

  // Keep a tiny readiness flag (used to mirror ngOnInit→ngOnChanges behavior)
  private readonly menuReady = signal(false);


  // ─────────────────────────────────────────────────────────────────────────────
  // Effects: load menu, then react to route changes to highlight
  // ─────────────────────────────────────────────────────────────────────────────

  // Load/shape menu
  private readonly loadEffect = effect(() => {
    const menu = this.menuDataSig();
    if (!menu) {
      return;
    }

    // If configured, expand all root items that have children
    const initialSelected = this.defaultExpanded
        ? menu.reduce<string[]>((acc, item) => {
            if (item?.children && item.nodeId) {
              acc.push(item.nodeId);
            }
            return acc;
          }, [])
        : [];

    this.selectedMenu.set(initialSelected);
    this.mainMenu.set(menu);
    this.menuReady.set(true);  // signals first menu load is done
  });

  // Update highlighted menu item: run after menu is ready and when URL changes
  private readonly highlightEffect = effect(() => {
    const segs = this.urlSegments();             // track route changes
    const ready = this.menuReady();              // track readiness
    const hasMenu = this.mainMenu().length > 0;  // track menu availability
    if (!ready || !hasMenu) {
      return;
    }

    untracked(() => this.updateHighlightedMenuItem());
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // Data building
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build the menu.
   * @returns Array of menu items.
   */
  private getMenuData(): Observable<MainMenuNode[]> {
    // The order of the functions in the array which is fed to forkJoin
    // determines the order of the menu items in the menu.
    return forkJoin(this.getMenuItemsArray()).pipe(
      map((res: MainMenuGroupNode[]) => {
        const menu: MainMenuNode[] = [];

        // Filter out menu groups that have no data, i.e. are not supposed
        // to be in the menu according to the config or are empty because
        // of a loading error.
        for (let i = 0; i < res.length; i++) {
          const group: MainMenuGroupNode = res[i];
          if (group.menuData?.length) {
            for (let x = 0; x < group.menuData.length; x++) {
              // Add the menu type to the menu data
              group.menuData[x].menuType = group.menuType;
              menu.push(group.menuData[x]);
            }
          }
        }

        // Add unique ids to each node in the menu.
        this.recursiveAddNodeIdsToMenu(menu);
        return menu;
      })
    );
  }

  /**
   * Returns an array of observables with only those menu items that
   * have been enabled in the config, in the order specified in the
   * config.
   */
  private getMenuItemsArray(): Observable<MainMenuGroupNode>[] {
    // Get enabled menu items from config, and prepend with the home
    // menu item, which is forced to always be shown.
    let enabledPages = {
      home: true,
      ...(config.component?.mainSideMenu?.items ?? {})
    };
    enabledPages.home = true;

    const menuItemGetters: Record<string, () => Observable<MainMenuGroupNode>> = {
      home: () => this.getHomePageMenuItem(),
      about: () => this.getAboutPagesMenu(),
      articles: () => this.getArticlePagesMenu(),
      ebooks: () => this.getEbookPagesMenu(),
      collections: () => this.getCollectionPagesMenu(),
      mediaCollections: () => this.getMediaCollectionPagesMenu(),
      indexKeywords: () => this.getIndexPageMenuItem('keywords'),
      indexPersons: () => this.getIndexPageMenuItem('persons'),
      indexPlaces: () => this.getIndexPageMenuItem('places'),
      indexWorks: () => this.getIndexPageMenuItem('works'),
      search: () => this.getSearchPageMenuItem()
    };

    return Object.entries(enabledPages)
          .filter(([key, isEnabled]) => isEnabled && menuItemGetters.hasOwnProperty(key))
          .map(([key]) => menuItemGetters[key]());
  }

  private getHomePageMenuItem(): Observable<MainMenuGroupNode> {
    const menuData: MainMenuNode[] = [{
      id: '',
      title: $localize`:@@MainSideMenu.Home:Hem`,
      parentPath: '/'
    }];
    return of({ menuType: 'home', menuData });
  }

  private getAboutPagesMenu(): Observable<MainMenuGroupNode> {
    return this.mdcontentService.getMenuTree(
      this.activeLocale, '03'
    ).pipe(
      map((res: MdMenuNodeApiResponse | null) => {
        if (!res) {
          return { menuType: 'about', menuData: [] };
        }

        const menuDataNode: MainMenuNode = fromMdToMainMenuNode(res, '/about');
        return { menuType: 'about', menuData: [menuDataNode] };
      }),
      catchError((error: any) => {
        console.error(error);
        return of({ menuType: 'about', menuData: [] });
      })
    );
  }

  private getArticlePagesMenu(): Observable<MainMenuGroupNode> {
    if (!config.articles?.length) {
      return of({ menuType: 'article', menuData: [] });
    }

    return this.mdcontentService.getMenuTree(
      this.activeLocale, '04'
    ).pipe(
      map((res: MdMenuNodeApiResponse | null) => {
        if (!res) {
          return { menuType: 'article', menuData: [] };
        }

        this.recursivelyMapArticleData(res, (config.articles as Article[]));
        const menuDataNode: MainMenuNode = fromMdToMainMenuNode(res, '/article');
        const menuData: MainMenuNode[] = config.component?.mainSideMenu?.ungroupArticles
              ? menuDataNode.children ?? []
              : [menuDataNode]

        return { menuType: 'article', menuData };
      }),
      catchError((error: any) => {
        console.error(error);
        return of({ menuType: 'article', menuData: [] });
      })
    );
  }

  private getEbookPagesMenu(): Observable<MainMenuGroupNode> {
    let menuData: MainMenuNode[] = [];
    if (config.ebooks?.length) {
      config.ebooks.forEach((ebook: any) => {
        const filenameparts = splitFilename(ebook.filename);
        menuData.push({
          id: filenameparts.name,
          title: ebook.title,
          parentPath: `/ebook/${filenameparts.extension}`
        });
      });
      if (menuData.length > 1) {
        menuData = [{
          title: $localize`:@@MainSideMenu.Ebooks:E-böcker`,
          children: menuData
        }];
      }
    }
    return of({ menuType: 'ebook', menuData });
  }

  private getCollectionPagesMenu(): Observable<MainMenuGroupNode> {
    if (!config.collections?.order?.length) {
      return of({ menuType: 'collection', menuData: [] });
    }

    return this.collectionsService.getCollections().pipe(
      map((res: Collection[]) => {
        const groups: Collection[][] = this.groupCollections(res);
        let menu: MainMenuNode[] = [];
        const groupTitles = [
          $localize`:@@MainSideMenu.CollectionsGroup1:Innehåll`,
          $localize`:@@MainSideMenu.CollectionsGroup2:Innehåll 2`,
          $localize`:@@MainSideMenu.CollectionsGroup3:Innehåll 3`,
          $localize`:@@MainSideMenu.CollectionsGroup4:Innehåll 4`,
          $localize`:@@MainSideMenu.CollectionsGroup5:Innehåll 5`
        ];
        for (let i = 0; i < groups.length; i++) {
          const groupTitle = groupTitles[i] ?? 'Error: out of category translations';
          if (groups[i].length > 1) {
            // The group contains several collections.
            menu.push({
              title: groupTitle,
              children: groups[i].map(
                (c: Collection) => fromCollectionToMainMenuNode(c, '/collection')
              )
            } as MainMenuNode);
          } else {
            // The group contains just one collection, so unwrap it,
            // meaning that the group menu item will not be collapsible,
            // instead linking directly into the one collection in the
            // group.
            const node: MainMenuNode = fromCollectionToMainMenuNode(
              groups[i][0], '/collection'
            );
            node.title = groupTitle;
            menu.push(node);
          }
        }
        return { menuType: 'collection', menuData: menu };
      }),
      catchError((error: any) => {
        console.error(error);
        return of({ menuType: 'collection', menuData: [] });
      })
    );
  }

  private getMediaCollectionPagesMenu(): Observable<MainMenuGroupNode> {
    return this.mediaCollectionService.getMediaCollections(this.activeLocale).pipe(
      map((res: MediaCollection[]) => {
        if (res.length < 1) {
          return { menuType: 'media-collection', menuData: [] };
        }

        sortArrayOfObjectsAlphabetically(res, 'title');
        const menuChildren: MainMenuNode[] = res.map(
          (mc: MediaCollection) => fromMediaCollectionToMainMenuNode(mc, '/media-collection')
        );
        menuChildren.unshift({
          id: '',
          title: $localize`:@@MediaCollection.AllMediaCollections:Alla bildsamlingar`,
          parentPath: '/media-collection'
        });
        const menu = [{
          title: $localize`:@@MainSideMenu.MediaCollections:Bildbank`,
          children: menuChildren
        }];
        return { menuType: 'media-collection', menuData: menu };
      }),
      catchError((error: any) => {
        console.error(error);
        return of({ menuType: 'media-collection', menuData: [] });
      })
    );
  }

  private getIndexPageMenuItem(indexType: string): Observable<MainMenuGroupNode> {
    const indexTitles: Record<string, string> = {
      persons: $localize`:@@MainSideMenu.IndexPersons:Personregister`,
      places: $localize`:@@MainSideMenu.IndexPlaces:Ortregister`,
      keywords: $localize`:@@MainSideMenu.IndexKeywords:Ämnesord`,
      works: $localize`:@@MainSideMenu.IndexWorks:Verkregister`
    };
    const title = indexTitles[indexType];

    return of({
      menuType: indexType,
      menuData: [{ id: '', title, parentPath: `/index/${indexType}` }]
    });
  }

  private getSearchPageMenuItem(): Observable<MainMenuGroupNode> {
    const menuData: MainMenuNode[] = [{
      id: '',
      title: $localize`:@@MainSideMenu.Search:Sök i utgåvan`,
      parentPath: '/search'
    }];
    return of({ menuType: 'search', menuData });
  }

  private groupCollections(collections: Collection[]): Collection[][] {
    const collectionOrder: number[][] = config.collections?.order ?? [];
    if (collectionOrder.length < 1) {
      return [collections];
    }

    // create an empty array with nested empty arrays for each group
    const groupedCollections: Collection[][] = collectionOrder.map(
      () => [] as Collection[]
    );

    collectionOrder.forEach((group: number[], groupIdx: number) => {
      group.forEach((collId: number) => {
        const foundIdx = collections.findIndex(
          (c: Collection) => c.id === collId
        );
        if (foundIdx > -1) {
          groupedCollections[groupIdx].push(collections[foundIdx]);
          //reduce the size of collections for the next iteration
          collections.splice(foundIdx, 1);
        }
      });
    });
    return groupedCollections;
  }

  /**
   * Recursively add nodeId property to each object in the array. nodeId is a
   * string starting with "n" and followed by running numbers. Each new branch
   * is indicated by a dash and the counter is reset. For example: n1-1-2.
   * This way each item gets a unique identifier.
   */
  private recursiveAddNodeIdsToMenu(array: MainMenuNode[], parentNodeId?: string) {
    array.forEach((n: MainMenuNode, i: number) => {
      n.nodeId = (parentNodeId ? parentNodeId + '-' : 'n') + (i+1);
      if (n.children?.length) {
        this.recursiveAddNodeIdsToMenu(n.children, n.nodeId);
      }
    });
  }

  /**
   * Goes through the @param node object and any nested objects declared
   * in `children` properties, and replaces the `id` property with the mapped
   * value of the article `routeName` from the config. Also replaces the `title`
   * property value with the mapped title from the config.
   */
  private recursivelyMapArticleData(node: MdMenuNodeApiResponse, articles: Article[]) {
    if (node.type === "file") {
      const origId = node.id;
      const article = articles.find((article: Article) =>
        (article.id === origId && article.language === this.activeLocale)
      );
      node.id = article?.routeName ?? origId;
      node.title = article?.title ?? node.title;
    } else {
      if (node.children?.length) {
        node.children.forEach((n: MdMenuNodeApiResponse) => {
          this.recursivelyMapArticleData(n, articles);
        });
      }
    }
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Highlighting
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Based on the current page's URL segments in this.urlSegments, finds the
   * corresponding menu item, sets it as highlighted, updates the html-title
   * and expands any collapsed parents in the menu tree.
   */
  private updateHighlightedMenuItem() {
    // Create a path string from all route segments, prefixed with a slash
    // (e.g., '/ebook/pdf/title-of-the-ebook')
    const currentPath = '/' + (this.urlSegments()?.map(s => s.path).join('/') || '');

    const currentItemRoot = this.recursiveFindCurrentMenuItem(this.mainMenu(), currentPath);
    if (!currentItemRoot) {
      this.highlightedNodeId.set('');
    }
  }

  /**
   * Used for recursively looping through the menu items and finding the current page.
   * If found, sets the highlighted menu item and html-title. Returns the root object
   * where the found item recides or undefined if not found. 
   */
  private recursiveFindCurrentMenuItem(
    menu: MainMenuNode[],
    targetPath: string
  ): MainMenuNode | undefined {
    return menu.find((item: MainMenuNode) => {
      let itemPath = item.parentPath;
      if (item.id) {
        itemPath += '/' + item.id;
      }

      if (itemPath === targetPath) {
        // Update highlighted menu item
        if (item.nodeId) {
          this.highlightedNodeId.set(item.nodeId);
        }

        // Update HTML document title
        if (item.parentPath === '/media-collection') {
          this.headService.setTitle([
            String(item.title),
            $localize`:@@MainSideMenu.MediaCollections:Bildbank`
          ]);
        } else if (
          item.parentPath &&
          !this.topMenuItems.includes(item.parentPath) &&
          this.urlSegments()[0]?.path !== 'collection'
        ) {
          // For top menu items the title is set by app.component, and
          // for collections the title is set by the text-changer component
          this.headService.setTitle([String(item.title)]);
        }
        return item;
      } else if (item.children) {
        const result = this.recursiveFindCurrentMenuItem(item.children, targetPath);
        if (result && item.nodeId && !this.selectedMenu().includes(item.nodeId)) {
          this.selectedMenu.set(
            addOrRemoveValueInNewArray(this.selectedMenu(), item.nodeId)
          );
        }
        return result;
      } else {
        return undefined;
      }
    });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // UI handlers
  // ─────────────────────────────────────────────────────────────────────────────

  toggle(menuItem: MainMenuNode) {
    if (menuItem.nodeId) {
      this.selectedMenu.set(
        addOrRemoveValueInNewArray(this.selectedMenu(), menuItem.nodeId)
      );
    }
  }

}
