import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { catchError, forkJoin, from, map, mergeMap, Observable, of, switchMap, toArray } from 'rxjs';

import { config } from '@config';
import { Article } from '@models/article.models';
import { Ebook } from '@models/ebook.models';
import { Collection, CollectionWithCover } from '@models/collection.models';
import { ContentItem } from '@models/content-item.models';
import { ParentChildPagePathPipe } from '@pipes/parent-child-page-path.pipe';
import { CollectionsService } from '@services/collections.service';
import { MarkdownService } from '@services/markdown.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'content-grid',
  templateUrl: './content-grid.component.html',
  styleUrls: ['./content-grid.component.scss'],
  imports: [IonicModule, RouterLink, ParentChildPagePathPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentGridComponent {
  // -----------------------------------------------------------------------------
  // Dependency injection, fields, and local state
  // -----------------------------------------------------------------------------
  private collectionsService = inject(CollectionsService);
  private destroyRef = inject(DestroyRef);
  private mdService = inject(MarkdownService);
  private activeLocale = inject(LOCALE_ID);

  readonly availableArticles: Article[] = config.articles ?? [];
  readonly availableEbooks: Ebook[] = config.ebooks ?? [];
  readonly flattenedCollectionSortOrder: number[] = ((config.collections?.order as number[][]) ?? []).flat();
  readonly includeArticles: boolean = config.component?.contentGrid?.includeArticles ?? false;
  readonly includeEbooks: boolean = config.component?.contentGrid?.includeEbooks ?? false;
  readonly includeMediaCollection: boolean = config.component?.contentGrid?.includeMediaCollection ?? false;
  readonly showTitles: boolean = config.component?.contentGrid?.showTitles ?? true;
  private readonly coverFetchConcurrency = 12;

  contentItems = signal<ContentItem[] | undefined>(undefined);

  // -----------------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------------
  constructor() {
    this.loadContentItems();
  }

  // -----------------------------------------------------------------------------
  // Data loading and mapping
  // -----------------------------------------------------------------------------
  private loadContentItems(): void {
    forkJoin(
      [
        this.getArticles(),
        this.getEbooks(),
        this.getCollections(),
        this.getMediaCollection()
      ]
    ).pipe(
      map((res: ContentItem[][]) => {
        const items = res.flat();
        // Add 'thumb' to end of cover image filenames
        items.forEach(item => {
          const imageURL = item.imageURL;
          const lastIndex = imageURL?.lastIndexOf('.') ?? -1;
          if (imageURL && lastIndex > -1) {
            item.imageURL = imageURL.substring(0, lastIndex) + '_thumb' + imageURL.substring(lastIndex);
          }
        });
        return items;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((items: ContentItem[]) => {
      this.contentItems.set(items);
    });
  }

  private getArticles(): Observable<ContentItem[]> {
    const itemsList = (this.includeArticles && this.availableArticles.length)
      ? this.availableArticles
          .filter((article: Article) => article.language === this.activeLocale)
          .map((article: Article) => new ContentItem(article))
      : [];

    return of(itemsList);
  }

  private getEbooks(): Observable<ContentItem[]> {
    const itemsList = (this.includeEbooks && this.availableEbooks.length)
      ? this.availableEbooks.map((ebook: Ebook) => new ContentItem(ebook))
      : [];

    return of(itemsList);
  }

  private getCollections(): Observable<ContentItem[]> {
    // First get list of collections, then for each filtered collection
    // fetch cover image URL and alt text from markdown content.
    return this.collectionsService.getCollections().pipe(
      switchMap((collectionsList: Collection[]) => {
        const filteredCollections = collectionsList.filter((collection: Collection) =>
          this.flattenedCollectionSortOrder.includes(collection.id)
        );

        if (!filteredCollections.length) {
          return of([]);
        }

        return from(filteredCollections).pipe(
          // Fetch covers in parallel with capped concurrency to avoid
          // overwhelming backend resources on large collection sets.
          mergeMap(
            (collection: Collection) => this.getCollectionWithCover(collection),
            this.coverFetchConcurrency
          ),
          map((collectionWithCover: CollectionWithCover) => new ContentItem(collectionWithCover)),
          toArray(),
          map((collectionItemsList: ContentItem[]) => {
            if (this.flattenedCollectionSortOrder.length > 0) {
              return this.sortCollectionsList(
                collectionItemsList,
                this.flattenedCollectionSortOrder
              );
            }
            return collectionItemsList;
          })
        );
      }),
      catchError((error: unknown) => {
        console.error('Error loading collections data', error);
        return of([]);
      })
    );
  }

  private getCollectionWithCover(collection: Collection): Observable<CollectionWithCover> {
    return this.mdService.getMdContent(
      `${this.activeLocale}-08-${collection.id}`
    ).pipe(
      map((md: string) => {
        const { imageAltText, imageURL } = this.extractFirstMarkdownImage(md);
        return {
          ...collection,
          imageAltText,
          imageURL,
        };
      }),
      catchError(() => {
        // Error getting collection cover data: use placeholder cover image.
        return of({
          ...collection,
          imageAltText: 'Collection cover image',
          imageURL: 'assets/images/collection-cover-placeholder.jpg'
        });
      })
    );
  }

  private extractFirstMarkdownImage(md: string): { imageAltText?: string; imageURL?: string } {
    const m = md.match(/!\[(.*?)\]\((.*?)\)/);
    return {
      imageAltText: m?.[1] || undefined,
      imageURL: m?.[2] || undefined
    };
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
