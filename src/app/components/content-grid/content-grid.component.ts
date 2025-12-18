import { Component, LOCALE_ID, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { catchError, filter, forkJoin, from, map, mergeMap, Observable, of, toArray } from 'rxjs';

import { config } from '@config';
import { Article } from '@models/article.models';
import { Collection } from '@models/collection.models';
import { ContentItem } from '@models/content-item.models';
import { ParentChildPagePathPipe } from '@pipes/parent-child-page-path.pipe';
import { CollectionsService } from '@services/collections.service';
import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'content-grid',
  templateUrl: './content-grid.component.html',
  styleUrls: ['./content-grid.component.scss'],
  imports: [AsyncPipe, IonicModule, RouterLink, ParentChildPagePathPipe]
})
export class ContentGridComponent implements OnInit {
  private collectionsService = inject(CollectionsService);
  private mdService = inject(MarkdownService);
  private activeLocale = inject(LOCALE_ID);

  readonly availableArticles: Article[] = config.articles ?? [];
  readonly availableEbooks: any[] = config.ebooks ?? [];
  readonly flattenedCollectionSortOrder: number[] = ((config.collections?.order as number[][]) ?? []).flat();
  readonly includeArticles: boolean = config.component?.contentGrid?.includeArticles ?? false;
  readonly includeEbooks: boolean = config.component?.contentGrid?.includeEbooks ?? false;
  readonly includeMediaCollection: boolean = config.component?.contentGrid?.includeMediaCollection ?? false;
  readonly showTitles: boolean = config.component?.contentGrid?.showTitles ?? true;

  contentItems$: Observable<ContentItem[]>;

  ngOnInit() {
    this.contentItems$ = forkJoin(
      [
        this.getArticles(),
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

  private getArticles(): Observable<ContentItem[]> {
    let itemsList: ContentItem[] = [];
    if (this.includeArticles && this.availableArticles.length) {
      this.availableArticles.forEach((article: Article) => {
        if (article.language === this.activeLocale) {
          const item = new ContentItem(article);
          itemsList.push(item);
        }
      });
    }
    return of(itemsList);
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
    // get it's cover image URL and alt-text (if they pass the filter
    // which checks that they are included in the collections in config)
    // and append this information to the collection data
    return this.collectionsService.getCollections().pipe(
      mergeMap((collectionsList: Collection[]) =>
        // 'from' emits each collection separately
        from(collectionsList).pipe(
          // Filter collections to include only those with IDs in
          // this.flattenedCollectionSortOrder, which comes from config
          filter((collection: Collection) =>
            this.flattenedCollectionSortOrder.includes(collection.id)
          ),
          // load cover info for each collection that passes the filter
          // (mergeMap fetches in parallell, to fetch sequentially you'd
          // use concatMap)
          mergeMap((collection: Collection) => 
            this.mdService.getMdContent(
              `${this.activeLocale}-08-${collection.id}`
            ).pipe(
              // add image alt-text and cover URL from response to
              // collection data
              map((md: string) => {
                // try to capture first image from the Markdown: ![alt](url)
                const m = md.match(/!\[(.*?)\]\((.*?)\)/);
                const imageAltText = m?.[1] || undefined;
                const imageURL = m?.[2] || undefined;

                return {
                  ...collection,
                  imageAltText,
                  imageURL,
                };
              }),
              catchError((error: any) => {
                // error getting collection cover URL, so add collection
                // with placeholder cover image
                return of({
                  ...collection,
                  imageAltText: 'Collection cover image',
                  imageURL: 'assets/images/collection-cover-placeholder.jpg'
                });
              })
            ),
          ),
          map((collection: Collection) => {
            return new ContentItem(collection);
          }),
          // collect all collections into an array
          toArray(),
          // sort array of collections to correspond to the collection
          // order specified in config
          map((collectionItemsList: ContentItem[]) => {
            if (this.flattenedCollectionSortOrder.length > 0)  {
              return this.sortCollectionsList(
                collectionItemsList, this.flattenedCollectionSortOrder
              );
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

  private sortCollectionsList(collectionsList: ContentItem[], flattenedSortList: number[]): ContentItem[] {
    let orderedCollectionsList: ContentItem[] = [];

    for (const id of flattenedSortList) {
      for (let x = 0; x < collectionsList.length; x++) {
        if (collectionsList[x].id && String(collectionsList[x].id) === String(id)) {
          orderedCollectionsList.push(collectionsList[x]);
          break;
        }
      }
    }

    return orderedCollectionsList;
  }

}
