import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { catchError, forkJoin, from, map, mergeMap, Observable, of, toArray } from 'rxjs';

import { config } from '@config';
import { ContentItem } from '@models/content-item.model';
import { ParentChildPagePathPipe } from '@pipes/parent-child-page-path.pipe';
import { CollectionsService } from '@services/collections.service';
import { MarkdownContentService } from '@services/markdown-content.service';


@Component({
  standalone: true,
  selector: 'content-grid',
  templateUrl: './content-grid.component.html',
  styleUrls: ['./content-grid.component.scss'],
  imports: [AsyncPipe, NgFor, NgIf, IonicModule, RouterLink, ParentChildPagePathPipe]
})
export class ContentGridComponent implements OnInit {
  availableEbooks: any[] = [];
  collectionSortOrder: any[] = [];
  contentItems$: Observable<ContentItem[]>;
  includeEbooks: boolean = false;
  includeMediaCollection: boolean = false;
  showTitles: boolean = true;

  constructor(
    private collectionsService: CollectionsService,
    private mdContentService: MarkdownContentService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.availableEbooks = config.ebooks ?? [];
    this.collectionSortOrder = config.collections?.order ?? [];
    this.includeEbooks = config.component?.contentGrid?.includeEbooks ?? false;
    this.includeMediaCollection = config.component?.contentGrid?.includeMediaCollection ?? false;
    this.showTitles = config.component?.contentGrid?.showTitles ?? true;
  }

  ngOnInit() {
    this.contentItems$ = forkJoin(
      [
        this.getEbooks(),
        this.getCollections(),
        this.getMediaCollection()
      ]
    ).pipe(
      map((res: any[]) => {
        const items = res.flat();
        // Add 'thumb' to end of cover image filenames
        items.forEach(item => {
          const lastIndex = item.imageURL?.lastIndexOf('.') ?? -1;
          if (lastIndex > -1) {
            item.imageURL = item.imageURL.substring(0, lastIndex) + '_thumb' + item.imageURL.substring(lastIndex);
          }
        });
        return items;
      })
    );
  }

  private getEbooks(): Observable<ContentItem[]> {
    let itemsList: ContentItem[] = [];
    if (this.includeEbooks && this.availableEbooks.length) {
      this.availableEbooks.forEach((ebook: any) => {
        const ebookItem = new ContentItem(ebook);
        itemsList.push(ebookItem);
      });
    }
    return of(itemsList);
  }

  private getCollections(): Observable<ContentItem[]> {
    // Adapted from https://stackoverflow.com/a/55517145
    // First get list of collections, then for each collection,
    // get it's cover image URL and alt-text and append this information
    // to the collection data
    return this.collectionsService.getCollections().pipe(
      mergeMap((collectionsList: any[]) =>
        // 'from' emits each collection separately
        from(collectionsList).pipe(
          // load cover info for each collection (mergeMap fetches in
          // parallell, to fetch sequentially you'd use concatMap)
          mergeMap(
            (collection: any) => 
              this.mdContentService.getMdContent(`${this.activeLocale}-08-${collection.id}`).pipe(
                // add image alt-text and cover URL from response to collection data
                map((coverRes: any) => ({
                  ...collection,
                  imageAltText: coverRes.content.match(/!\[(.*?)\]\(.*?\)/)[1] || undefined,
                  imageURL: coverRes.content.match(/!\[.*?\]\((.*?)\)/)[1] || undefined
                })),
                catchError((error: any) => {
                  // error getting collection cover URL, so add collection with placeholder cover image
                  return of({
                    ...collection,
                    imageAltText: 'Collection cover image',
                    imageURL: 'assets/images/collection-cover-placeholder.jpg'
                  });
                })
              ),
          ),
          map((collection: any) => {
            return new ContentItem(collection);
          }),
          // collect all collections into an array
          toArray(),
          // sort array of collections
          map((collectionItemsList: ContentItem[]) => {
            if (
              this.collectionSortOrder.length &&
              this.collectionSortOrder[0].length
            )  {
              return this.sortCollectionsList(collectionItemsList, this.collectionSortOrder);
            } else {
              return collectionItemsList;
            }
          })
        )
      ),
      catchError((error: any) => {
        console.error('Error loading collections data', error);
        return of([]);
      })
    );
  }

  private getMediaCollection(): Observable<ContentItem[]> {
    let itemsList: ContentItem[] = [];
    if (this.includeMediaCollection) {
      const ebookItem = new ContentItem(
        {
          id: 'media-collection',
          imageAltText: config.component?.contentGrid?.mediaCollectionCoverAltTexts?.[this.activeLocale] ?? $localize`:@@MainSideMenu.MediaCollections:Bildbank`,
          imageURL: config.component?.contentGrid?.mediaCollectionCoverURL ?? '',
          title: $localize`:@@MainSideMenu.MediaCollections:Bildbank`,
          type: 'media-collection'
        }
      );
      itemsList.push(ebookItem);
    }
    return of(itemsList);
  }

  private sortCollectionsList(collectionsList: ContentItem[], sortList: any[]): ContentItem[] {
    let collectionOrderList: any[] = [];
    let orderedCollectionsList: ContentItem[] = [];
    
    for (let i = 0; i < sortList.length; i++) {
      collectionOrderList = collectionOrderList.concat(sortList[i]);
    }

    for (const id of collectionOrderList) {
      for (let x = 0; x < collectionsList.length; x++) {
        if (collectionsList[x].id && String(collectionsList[x].id) === String(id)) {
          orderedCollectionsList.push(collectionsList[x]);
          break;
        }
      }
    }

    return orderedCollectionsList;
  }

  trackById(index: number | string, item: any) {
    return item.id;
  }

}
