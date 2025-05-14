import { Inject, Injectable, LOCALE_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, map, Observable, of } from 'rxjs';

import { config } from '@config';
import { flattenObjectTree, sortArrayOfObjectsAlphabetically, sortArrayOfObjectsNumerically } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class CollectionTableOfContentsService {
  private activeTocOrder: string = '';
  private apiURL: string = '';
  private categoricalTocPrimarySortKey: string = 'date';
  private categoricalTocSecondarySortKey: string = '';
  private currentUnorderedToc: any = {};          // default order current TOC
  private currentUnorderedFlattenedToc: any = {}; // default order flattened current TOC
  private currentToc: any = {};                   // possibly ordered current TOC
  private currentFlattenedToc: any = {};          // possibly ordered, flattened current TOC
  private currentToc$ = new BehaviorSubject<any>(null);
  private currentFlattenedToc$ = new BehaviorSubject<any>(null);
  private multilingualToc: boolean = false;

  constructor(
    private http: HttpClient,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
    this.multilingualToc = config.app?.i18n?.multilingualCollectionTableOfContents ?? false;
    this.categoricalTocPrimarySortKey = config.component?.collectionSideMenu?.categoricalSortingPrimaryKey ?? 'date';
    this.categoricalTocSecondarySortKey = config.component?.collectionSideMenu?.categoricalSortingSecondaryKey ?? '';
  }

  getTableOfContents(id: string): Observable<any> {
    if (this.currentUnorderedToc?.collectionId === id) {
      return of(this.currentUnorderedToc);
    } else if (id) {
      const locale = this.multilingualToc ? '/' + this.activeLocale : '';
      const endpoint = `${this.apiURL}/toc/${id}${locale}`;

      return this.http.get(endpoint).pipe(
        catchError((e: any) => {
          return of({});
        })
      );
    } else {
      return of({});
    }
  }

  getFlattenedTableOfContents(id: string): Observable<any> {
    if (this.currentUnorderedFlattenedToc?.collectionId === id) {
      return of(this.currentUnorderedFlattenedToc);
    } else {
      return this.getTableOfContents(id).pipe(
        map((toc: any) => {
          if (toc?.children?.length) {
            toc = {
              ...toc,
              children: flattenObjectTree(toc, 'children', 'itemId')
            };
          }
          return toc;
        })
      );
    }
  }

  /**
   * Get first TOC item which has 'itemId' property and 'type' property
   * has value other than 'subtitle' and 'section_title'.
   * @param collectionID 
   * @param language optional
   */
  getFirstItem(collectionID: string, language?: string): Observable<any> {
    language = language && this.multilingualToc ? '/' + language : '';
    const endpoint = `${this.apiURL}/toc-first/${collectionID}${language}`;
    return this.http.get(endpoint);
  }

  /**
   * Gets the table of contents for a collection, creates an ordered version
   * of it and emits both flattened and non-flattened versions of it to
   * subscribers. This function should only be called in app.component when
   * the collection changes and in the collection side menu whenever the
   * ordering of the collection TOC changes.
   */
  setCurrentCollectionToc(collectionId: string, order: string = 'default') {
    this.getTableOfContents(collectionId).subscribe((toc: any) => {
      if (toc?.collectionId && (
        collectionId !== this.currentToc?.collectionId ||
        order !== this.activeTocOrder
      )) {
        // Change of collection or order of the TOC

        this.activeTocOrder = order;

        // Scenarios:
        // 1. New collection -> always default order to begin with
        // 2. Same collection, default order
        // 3. Same collection, non-default order

        if (collectionId !== this.currentToc?.collectionId) {
          // 1.
          // Cache the current default-ordered (!) collection side menu TOC
          this.currentToc = {
            ...toc,
            order: order
          };
          this.currentFlattenedToc = {
            ...this.currentToc,
            children: flattenObjectTree(toc, 'children', 'itemId')
          };
          this.currentUnorderedToc = this.currentToc;
          this.currentUnorderedFlattenedToc = this.currentFlattenedToc;
        } else {
          // The collection has not changed, so we can use the stored TOC
          if (order === 'default') {
            // 2.
            // Restore the default ordered TOC
            this.currentToc = this.currentUnorderedToc;
            this.currentFlattenedToc = this.currentUnorderedFlattenedToc;
          } else {
            // 3.
            // Construct ordered TOC
            let orderedToc = [];

            if (
              order === 'alphabetical' &&
              config.component?.collectionSideMenu?.sortableCollectionsAlphabetical?.includes(collectionId)
            ) {
              orderedToc = this.constructAlphabeticalMenu(this.currentUnorderedFlattenedToc.children);
            } else if (
              order === 'chronological' &&
              config.component?.collectionSideMenu?.sortableCollectionsChronological?.includes(collectionId)
            ) {
              orderedToc = this.constructCategoricalMenu(this.currentUnorderedFlattenedToc.children, 'date');
            } else if (
              order === 'categorical' &&
              config.component?.collectionSideMenu?.sortableCollectionsCategorical?.includes(collectionId)
            ) {
              orderedToc = this.constructCategoricalMenu(
                this.currentUnorderedFlattenedToc.children,
                this.categoricalTocPrimarySortKey,
                this.categoricalTocSecondarySortKey
              )
            }

            if (orderedToc.length) {
              // Store original and flattened versions of the ordered TOC
              this.currentToc = {
                ...this.currentToc,
                children: orderedToc,
                order: order
              };

              if (order === 'chronological' || order === 'categorical') {
                orderedToc = flattenObjectTree({children: orderedToc}, 'children', 'itemId');
              }

              this.currentFlattenedToc = {
                ...this.currentFlattenedToc,
                children: orderedToc,
                order: order
              };
            }
          }
        }
      } else {
        this.currentToc = {};
        this.currentFlattenedToc = {};
        this.currentUnorderedToc = {};
        this.currentUnorderedFlattenedToc = {};
      }

      // Emit original and flattened versions of the TOC to subscribers
      this.currentToc$.next(this.currentToc);
      this.currentFlattenedToc$.next(this.currentFlattenedToc);
    });
  }

  getCurrentCollectionToc(): Observable<any> {
    return this.currentToc$.asObservable();
  }

  getCurrentFlattenedCollectionToc(): Observable<any> {
    return this.currentFlattenedToc$.asObservable();
  }

  getStaticTableOfContents(id: string): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'text/html; charset=UTF-8'
    });
    const endpoint = `http://localhost:4201/static-html/collection-toc/${id}_${this.activeLocale}.htm`;

    return this.http.get(endpoint, {headers, responseType: 'text'}).pipe(
      catchError((error) => {
        console.log(`Error loading static html of TOC for collection ${id} in '${this.activeLocale}' locale.`);
        return of('');
      })
    );
  }

  /**
   * Given a flattened collection TOC as the array `flattenedMenuData`,
   * returns a new array where the TOC items have been sorted alphabetically
   * (ascendingly) on the 'text' property of each item.
   */
  private constructAlphabeticalMenu(flattenedMenuData: any[]) {
    const alphabeticalMenu: any[] = [];

    for (const child of flattenedMenuData) {
      if (child.itemId) {
        alphabeticalMenu.push(child);
      }
    }

    sortArrayOfObjectsAlphabetically(alphabeticalMenu, 'text');
    return alphabeticalMenu;
  }

  /**
   * Given a flattened collection TOC as the array `flattenedMenuData`,
   * returns a new array where the TOC items have been sorted according
   * to the `primarySortKey` and (optional) `secondarySortKey` properties.
   */
  private constructCategoricalMenu(
    flattenedMenuData: any[],
    primarySortKey: string,
    secondarySortKey?: string
  ) {
    const orderedList: any[] = [];

    for (const child of flattenedMenuData) {
      if (
        child[primarySortKey] &&
        ((secondarySortKey && child[secondarySortKey]) || !secondarySortKey) &&
        child.itemId
      ) {
        orderedList.push(child);
      }
    }

    if (primarySortKey === 'date') {
      sortArrayOfObjectsNumerically(orderedList, primarySortKey, 'asc');
    } else {
      sortArrayOfObjectsAlphabetically(orderedList, primarySortKey);
    }

    const categoricalMenu: any[] = [];
    let childItems: any[] = [];
    let prevCategory = '';

    for (let i = 0; i < orderedList.length; i++) {
      let currentCategory = orderedList[i][primarySortKey];
      if (primarySortKey === 'date') {
        currentCategory = String(currentCategory).split('-')[0];
      }

      if (prevCategory === '') {
        prevCategory = currentCategory;
        categoricalMenu.push({type: 'subtitle', collapsed: true, text: prevCategory, children: []});
      }

      if (prevCategory !== currentCategory) {
        if (secondarySortKey === 'date') {
          sortArrayOfObjectsNumerically(childItems, secondarySortKey, 'asc');
        } else if (secondarySortKey) {
          sortArrayOfObjectsAlphabetically(childItems, secondarySortKey);
        }
        categoricalMenu[categoricalMenu.length - 1].children = childItems;
        childItems = [];
        prevCategory = currentCategory;
        categoricalMenu.push({type: 'subtitle', collapsed: true, text: prevCategory, children: []});
      }
      childItems.push(orderedList[i]);
    }

    if (childItems.length > 0) {
      if (secondarySortKey === 'date') {
        sortArrayOfObjectsNumerically(childItems, secondarySortKey, 'asc');
      } else if (secondarySortKey) {
        sortArrayOfObjectsAlphabetically(childItems, secondarySortKey);
      }
    }

    if (categoricalMenu.length > 0) {
      categoricalMenu[categoricalMenu.length - 1].children = childItems;
    } else {
      categoricalMenu[0] = {};
      categoricalMenu[0].children = childItems;
    }

    return categoricalMenu;
  }

}
