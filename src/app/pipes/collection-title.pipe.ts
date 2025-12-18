import { inject, Pipe, PipeTransform } from '@angular/core';
import { distinctUntilChanged, map, Observable, of, shareReplay } from 'rxjs';

import { Collection } from '@models/collection.models';
import { CollectionsService } from '@services/collections.service';


/**
 * Returns an Observable of the collection title for a given ID.
 * Use with the `async` pipe in templates.
 *
 * - Caches the fetched collection list (`shareReplay(1)`), so multiple
 *   usages across the app won’t refetch.
 * - Builds a Map<id, title> once and looks up by the provided ID.
 * - Emits the provided fallback if the ID is missing or not found.
 *
 * Usage:
 * ```html
 * {{ collectionId | collectionName | async }}   <!-- "Undefined" by default -->
 * {{ collectionId | collectionName : '—' | async }}  <!-- custom fallback -->
 * ```
 */
@Pipe({ name: 'collectionTitle' })
export class CollectionTitlePipe implements PipeTransform {
  private readonly collectionService = inject(CollectionsService);

  // One fetch shared across all consumers.
  private readonly collections$: Observable<Collection[]> =
    this.collectionService.getCollections().pipe(shareReplay(1));

  // Build a reusable Map once.
  private readonly collectionMap$: Observable<Map<string, string>> =
    this.collections$.pipe(
      map(list => new Map(list.map(c => [String(c.id), c.title]))),
      shareReplay(1)
    );

  /**
   * Transform a collection ID into an Observable of its display name
   * (title).
   *
   * @param collectionId The collection identifier (string/number/null/undefined).
   * @param fallback The string to emit if the ID is missing or not found. Defaults to "Undefined".
   */
  transform(
    collectionId?: string | number | null,
    fallback: string = 'Undefined'
  ): Observable<string> {
    if (collectionId === null || collectionId === undefined || collectionId === '') {
      return of(fallback);
    }
    const id = String(collectionId);
    return this.collectionMap$.pipe(
      map(map_ => map_.get(id) ?? fallback),
      distinctUntilChanged()
    );
  }
}
