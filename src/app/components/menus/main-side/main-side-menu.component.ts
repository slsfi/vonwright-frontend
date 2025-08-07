import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input,
  LOCALE_ID, OnChanges, OnInit
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, UrlSegment } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

import { config } from '@config';
import { ArrayIncludesPipe } from '@pipes/array-includes.pipe';
import { ParentChildPagePathPipe } from '@pipes/parent-child-page-path.pipe';
import { CollectionsService } from '@services/collections.service';
import { DocumentHeadService } from '@services/document-head.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { addOrRemoveValueInNewArray, sortArrayOfObjectsAlphabetically, splitFilename } from '@utility-functions';

/**
 * * This component uses ChangeDetectionStrategy.OnPush so change detection has to
 * * be manually triggered in the component whenever the `selectedMenu` array changes.
 * * Because a pure pipe is used in the template to check included items in
 * * `selectedMenu`, the array has to be recreated every time it changes, otherwise
 * * the changes won't be reflected in the view.
 */
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
export class MainSideMenuComponent implements OnInit, OnChanges {
  @Input() urlSegments: UrlSegment[] = [];

  ebooksList: any[] = [];
  highlightedMenu: string = '';
  mainMenu: any[] = [];
  selectedMenu: string[] = [];
  topMenuItems: string[] = [
    '/',
    '/content',
    '/search'
  ]; // app.component handles setting html-title for these

  constructor(
    private cdr: ChangeDetectorRef,
    private collectionsService: CollectionsService,
    private headService: DocumentHeadService,
    private mdcontentService: MarkdownService,
    private mediaCollectionService: MediaCollectionService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.ebooksList = config.ebooks ?? [];

    if (this.ebooksList) {
      this.ebooksList.forEach((ebook: any) => {
        const filenameparts = splitFilename(ebook.filename);
        ebook.id = filenameparts.name;
      });
    }
  }

  ngOnInit() {
    this.getMenuData().subscribe(
      (menu: any[]) => {
        if (config.component?.mainSideMenu?.defaultExpanded ?? false) {
          // Add root menu items to selectedMenu array if the main menu
          // should be expanded by default when initialised.
          menu.forEach((item: any) => {
            if (item.children) {
              this.selectedMenu.push(item.nodeId);
            }
          });
        }
        this.mainMenu = menu;
        this.updateHighlightedMenuItem();
      }
    );
  }

  ngOnChanges() {
    if (this.mainMenu?.length) {
      this.updateHighlightedMenuItem();
    }
  }

  private getMenuData(): Observable<any> {
    // The order of the functions in the array which is fed to forkJoin
    // determines the order of the menu items in the menu.
    return forkJoin(this.getMenuItemsArray()).pipe(
      map((res: any[]) => {
        let menu: any[] = [];

        // Filter out menu groups that have no data, i.e. are not supposed
        // to be in the menu according to the config or are empty because
        // of a loading error.
        for (let i = 0; i < res.length; i++) {
          if (res[i].menuData && res[i].menuData.length) {
            for (let x = 0; x < res[i].menuData.length; x++) {
              // Add the menu type to the menu data
              res[i].menuData[x].menuType = res[i].menuType;
              menu.push(res[i].menuData[x]);
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
  private getMenuItemsArray(): Observable<any>[] {
    // Get enabled menu items from config, and prepend with the home
    // menu item, which is forced to always be shown.
    let enabledPages = {
      home: true,
      ...(config.component?.mainSideMenu?.items ?? {})
    };
    enabledPages.home = true;

    const menuItemGetters: Record<string, () => Observable<any>> = {
      home: () => this.getHomePageMenuItem(),
      about: () => this.getAboutPagesMenu(),
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

  private getHomePageMenuItem(): Observable<any> {
    const menuData: any[] = [{ id: '', title: $localize`:@@MainSideMenu.Home:Hem`, parentPath: '/' }];
    return of({ menuType: 'home', menuData });
  }

  private getAboutPagesMenu(): Observable<any> {
    return this.mdcontentService.getMenuTree(
      this.activeLocale, '03'
    ).pipe(
      map((res: any) => {
        res = [res];
        this.recursivelyAddParentPagePath(res, '/about');
        return { menuType: 'about', menuData: res };
      }),
      catchError((error: any) => {
        console.error(error);
        return of({ menuType: 'about', menuData: [] });
      })
    );
  }

  private getEbookPagesMenu(): Observable<any> {
    let menuData: any[] = [];
    if (this.ebooksList.length) {
      this.ebooksList.forEach(ebook => {
        const filenameparts = splitFilename(ebook.filename);
        menuData.push({
          id: filenameparts.name,
          title: ebook.title,
          parentPath: `/ebook/${filenameparts.extension}`
        });
      });
      if (this.ebooksList.length > 1) {
        menuData = [{
          title: $localize`:@@MainSideMenu.Ebooks:E-böcker`,
          children: menuData
        }];
      }
    }
    return of({ menuType: 'ebook', menuData });
  }

  private getCollectionPagesMenu(): Observable<any> {
    if (config.collections?.order?.length) {
      return this.collectionsService.getCollections().pipe(
        map((res: any) => {
          this.recursivelyAddParentPagePath(res, '/collection');
          res = this.groupCollections(res);
          let menu = [];
          const groupTitles = [
            $localize`:@@MainSideMenu.CollectionsGroup1:Innehåll`,
            $localize`:@@MainSideMenu.CollectionsGroup2:Innehåll 2`,
            $localize`:@@MainSideMenu.CollectionsGroup3:Innehåll 3`,
            $localize`:@@MainSideMenu.CollectionsGroup4:Innehåll 4`,
            $localize`:@@MainSideMenu.CollectionsGroup5:Innehåll 5`
          ];
          for (let i = 0; i < res.length; i++) {
            const title = groupTitles[i] ?? 'Error: out of category translations';
            if (res[i].length > 1) {
              // The group contains several collections.
              menu.push({ title, children: res[i] });
            } else {
              // The group contains just one collection, so unwrap it,
              // meaning that the group menu item will not be collapsible,
              // instead linking directly into the one collection in the
              // group.
              res[i][0].name = title;
              res[i][0].title = title;
              menu.push(res[i][0]);
            }
          }
          return { menuType: 'collection', menuData: menu };
        }),
        catchError((error: any) => {
          console.error(error);
          return of({ menuType: 'collection', menuData: [] });
        })
      );
    } else {
      return of({ menuType: 'collection', menuData: [] });
    }
  }

  private getMediaCollectionPagesMenu(): Observable<any> {
    return this.mediaCollectionService.getMediaCollections(this.activeLocale).pipe(
      map((res: any) => {
        if (res?.length > 0) {
          sortArrayOfObjectsAlphabetically(res, 'title');
          this.recursivelyAddParentPagePath(res, '/media-collection');
          res.unshift({ id: '', title: $localize`:@@MediaCollection.AllMediaCollections:Alla bildsamlingar`, parentPath: '/media-collection' });
          res = [{ title: $localize`:@@MainSideMenu.MediaCollections:Bildbank`, children: res }];
        } else {
          res = [];
        }
        return { menuType: 'media-collection', menuData: res };
      }),
      catchError((error: any) => {
        console.error(error);
        return of({ menuType: 'media-collection', menuData: [] });
      })
    );
  }

  private getIndexPageMenuItem(indexType: string): Observable<any> {
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

  private getSearchPageMenuItem(): Observable<any> {
    const menuData: any[] = [{ id: '', title: $localize`:@@MainSideMenu.Search:Sök i utgåvan`, parentPath: '/search' }];
    return of({ menuType: 'search', menuData });
  }

  private groupCollections(collections: any) {
    if (config.collections?.order) {
      let collectionsList = config.collections.order.map(() => []);

      config.collections.order.forEach((array: number[], index: number) => {
        array.forEach((item: number) => {
          const collectionIndex = collections.findIndex((collection: any) => collection.id === item);
          if (collectionIndex > -1) {
            collectionsList[index].push(collections[collectionIndex]);
            //reduce the size of collections for the next iteration
            collections.splice(collectionIndex, 1);
          }
        });
      });
      return collectionsList;
    } else {
      return collections;
    }
  }

  /**
   * Goes through every object in @param array, including nested objects declared
   * as in 'children' properties, and adds a new property 'parentPath'
   * with the value of @param parentPath.
   */
  private recursivelyAddParentPagePath(array: any[], parentPath: string) {
    for (let i = 0; i < array.length; i++) {
      array[i]["parentPath"] = parentPath;
      if (array[i]["children"] && array[i]["children"].length) {
        this.recursivelyAddParentPagePath(array[i]["children"], parentPath);
      }
    }
  }

  /**
   * Recursively add nodeId property to each object in the array. nodeId is a
   * string starting with "n" and followed by running numbers. Each new branch
   * is indicated by a dash and the counter is reset. For example: n1-1-2.
   * This way each item gets a unique identifier.
   */
  private recursiveAddNodeIdsToMenu(array: any[], parentNodeId?: string) {
    for (let i = 0; i < array.length; i++) {
      array[i]["nodeId"] = (parentNodeId ? parentNodeId + '-' : 'n') + (i+1);
      if (array[i]["children"] && array[i]["children"].length) {
        this.recursiveAddNodeIdsToMenu(array[i]["children"], array[i]["nodeId"]);
      }
    }
  }

  /**
   * Based on the current page's URL segments in this.urlSegments, finds the
   * corresponding menu item, sets it as highlighted, updates the html-title
   * and expands any collapsed parents in the menu tree.
   */
  private updateHighlightedMenuItem() {
    // Create a path string from all route segments, prefixed with a slash
    // (e.g., '/ebook/pdf/title-of-the-ebook')
    const currentPath = '/' + (this.urlSegments?.map(segment => segment.path).join('/') || '');

    const currentItemRoot = this.recursiveFindCurrentMenuItem(this.mainMenu, currentPath);
    if (!currentItemRoot) {
      this.highlightedMenu = '';
    }
    this.cdr.markForCheck();
  }

  /**
   * Used for recursively looping through the menu items and finding the current page.
   * If found, sets the highlighted menu item and html-title. Returns the root object
   * where the found item recides or undefined if not found. 
   */
  private recursiveFindCurrentMenuItem(array: any[], stringForComparison: string): any {
    return array.find(item => {
      let itemPath = item.parentPath;
      if (item.id) {
        itemPath += '/' + item.id;
      }
      if (itemPath === stringForComparison) {
        this.highlightedMenu = item.nodeId;
        if (item.parentPath === '/media-collection') {
          this.headService.setTitle([String(item.title), $localize`:@@MainSideMenu.MediaCollections:Bildbank`]);
        } else if (
          !this.topMenuItems.includes(item.parentPath) &&
          this.urlSegments[0]?.path !== 'collection'
        ) {
          // For top menu items the title is set by app.component, and
          // for collections the title is set by the text-changer component
          this.headService.setTitle([String(item.title)]);
        }
        return item;
      } else if (item.children) {
        const result = this.recursiveFindCurrentMenuItem(item.children, stringForComparison);
        if (result && !this.selectedMenu.includes(item.nodeId)) {
          this.selectedMenu = addOrRemoveValueInNewArray(this.selectedMenu, item.nodeId);
        }
        return result;
      } else {
        return undefined;
      }
    });
  }

  toggle(menuItem: any) {
    this.selectedMenu = addOrRemoveValueInNewArray(this.selectedMenu, menuItem.nodeId);
    this.cdr.markForCheck();
  }

}
