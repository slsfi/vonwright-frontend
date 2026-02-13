import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule } from '@ionic/angular';
import { take } from 'rxjs';

import { config } from '@config';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { OccurrenceCollectionTextPageQueryparamsPipe } from '@pipes/occurrence-collection-text-page-queryparams.pipe';
import { Occurrence } from '@models/occurrence.models';
import { SingleOccurrence } from '@models/single-occurrence.models';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { NamedEntityService } from '@services/named-entity.service';
import { sortArrayOfObjectsAlphabetically } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'occurrences-accordion',
  templateUrl: './occurrences-accordion.component.html',
  styleUrls: ['./occurrences-accordion.component.scss'],
  imports: [IonicModule, RouterModule, CollectionPagePathPipe, OccurrenceCollectionTextPageQueryparamsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OccurrencesAccordionComponent {
  // -----------------------------------------------------------------------------
  // Dependency injection, Input signals, Fields, Local state signals
  // -----------------------------------------------------------------------------
  private namedEntityService = inject(NamedEntityService);
  private tocService = inject(CollectionTableOfContentsService);
  private destroyRef = inject(DestroyRef);

  readonly id = input<number>();
  readonly type = input<string>('');

  readonly simpleWorkMetadata: boolean = config.modal?.namedEntity?.useSimpleWorkMetadata ?? false;
  private latestFetchToken = 0;

  // -----------------------------------------------------------------------------
  // Derived computeds (pure, no side-effects)
  // -----------------------------------------------------------------------------
  readonly groupedTexts = signal<any[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly occurrenceData = computed<any[]>(() => this.groupedTexts());
  readonly showPublishedStatus = computed<number>(() => {
    const type = this.type();
    if (type === 'keyword') {
      return config.page?.index?.keywords?.publishedStatus ?? 2;
    }
    if (type === 'person') {
      return config.page?.index?.persons?.publishedStatus ?? 2;
    }
    if (type === 'place') {
      return config.page?.index?.places?.publishedStatus ?? 2;
    }
    if (type === 'work') {
      return config.page?.index?.works?.publishedStatus ?? 2;
    }
    return 2;
  });

  // -----------------------------------------------------------------------------
  // Constructor: wire side effects (data load)
  // -----------------------------------------------------------------------------
  constructor() {
    effect(() => {
      const id = this.id();
      const type = this.type();

      if (type === 'work' && this.simpleWorkMetadata) {
        this.latestFetchToken++;
        this.groupedTexts.set([]);
        this.isLoading.set(false);
        return;
      }

      if (id && type) {
        this.getOccurrenceData(id);
      } else {
        this.latestFetchToken++;
        this.groupedTexts.set([]);
        this.isLoading.set(false);
      }
    });
  }

  // -----------------------------------------------------------------------------
  // Data loading and transformation
  // -----------------------------------------------------------------------------
  private getOccurrenceData(id: number) {
    this.isLoading.set(true);
    this.groupedTexts.set([]);
    // If occurrences are loading for one type/id pair and inputs change to another pair,
    // a new fetch starts; this token lets us ignore late responses from the older fetch.
    const fetchToken = ++this.latestFetchToken;

    let objectType = this.type();
    if (objectType === 'work') {
      objectType = 'work_manifestation';
    }

    this.namedEntityService.getEntityOccurrences(objectType, String(id)).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (occ: any) => {
        if (fetchToken !== this.latestFetchToken) {
          return;
        }

        const nextGroupedTexts: any[] = [];
        occ.forEach((item: any) => {
          if (item.occurrences?.length) {
            for (const occurence of item.occurrences) {
              this.categorizeOccurrence(occurence, nextGroupedTexts);
            }
          }
        });

        // Sort collection names alphabetically
        sortArrayOfObjectsAlphabetically(nextGroupedTexts, 'name');

        // Replace publication names (from the database) with the names
        // in the collection TOC-file and sort by publication name.
        this.groupedTexts.set(nextGroupedTexts);
        this.updateAndSortPublicationNamesInOccurrenceResults(fetchToken);

        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Error getting occurrence texts', err);
        if (fetchToken === this.latestFetchToken) {
          this.groupedTexts.set([]);
          this.isLoading.set(false);
        }
      }
    });
  }

  private categorizeOccurrence(occurrence: Occurrence, groupedTexts: any[]) {
    if (
      occurrence.publication_id &&
      !occurrence.publication_manuscript_id &&
      !occurrence.publication_comment_id &&
      !occurrence.publication_facsimile_id &&
      !occurrence.publication_version_id
    ) {
      this.setOccurrenceType(occurrence, 'rt', groupedTexts);
    } else {
      if (occurrence.publication_manuscript_id) {
        this.setOccurrenceType(occurrence, 'ms', groupedTexts);
      }
      if (occurrence.publication_version_id) {
        this.setOccurrenceType(occurrence, 'var', groupedTexts);
      }
      if (occurrence.publication_comment_id) {
        this.setOccurrenceType(occurrence, 'com', groupedTexts);
      }
      if (occurrence.publication_facsimile_id) {
        this.setOccurrenceType(occurrence, 'facs', groupedTexts);
      }
    }
  }

  private setOccurrenceType(occ: Occurrence, type: string, groupedTexts: any[]) {
    const newOccurrence = new SingleOccurrence();
    const fileName = occ.original_filename ?? (
      occ.collection_id + '_' + occ.publication_id + '.xml'
    );

    newOccurrence.linkID = fileName?.split('.xml')[0];
    newOccurrence.collectionID = occ.collection_id && occ.publication_id
      ? occ.collection_id + '_' + occ.publication_id
      : newOccurrence.linkID?.split('_' + type)[0];
    newOccurrence.filename = fileName;
    newOccurrence.textType = type;
    newOccurrence.title = occ.name;
    newOccurrence.collectionName = occ.collection_name;
    newOccurrence.displayName = occ.publication_name ? occ.publication_name : occ.collection_name;
    newOccurrence.publication_manuscript_id = occ.publication_manuscript_id;
    newOccurrence.publication_version_id = occ.publication_version_id;
    newOccurrence.publication_facsimile_id = occ.publication_facsimile_id;
    newOccurrence.facsimilePage = occ.publication_facsimile_page;
    newOccurrence.description = occ.description || null;
    this.setOccurrenceTree(newOccurrence, occ, groupedTexts);
  }

  private setOccurrenceTree(newOccurrence: any, occ: any, groupedTexts: any[]) {
    const publishedStatus = this.showPublishedStatus();
    let foundCollection = false;

    for (let i = 0; i < groupedTexts.length; i++) {
      if (groupedTexts[i].collection_id === occ.collection_id) {
        foundCollection = true;
        let foundPublication = false;
        for (let j = 0; j < groupedTexts[i].publications.length; j++) {
          if (groupedTexts[i].publications[j].publication_id === occ.publication_id) {
            groupedTexts[i].publications[j].occurrences.push(newOccurrence);
            foundPublication = true;
            break;
          }
        }
        if (!foundPublication && occ.publication_published >= publishedStatus) {
          const item = {
            publication_id: occ.publication_id,
            name: occ.publication_name,
            occurrences: [newOccurrence]
          };
          groupedTexts[i].publications.push(item);
        }
        break;
      }
    }

    if (!foundCollection) {
      if (occ.collection_name === undefined) {
        occ.collection_name = occ.publication_collection_name;
      }
      if (occ.publication_published >= publishedStatus) {
        const item = {
          collection_id: occ.collection_id,
          name: occ.collection_name,
          hidden: true,
          publications: [
            {
              publication_id: occ.publication_id,
              name: occ.publication_name,
              occurrences: [newOccurrence]
            }
          ]
        };
        groupedTexts.push(item);
      }
    }
  }

  private updateAndSortPublicationNamesInOccurrenceResults(fetchToken: number) {
    // Loop through each collection with occurrence results, get TOC for each collection,
    // then loop through each publication with occurrence results in each collection and
    // update publication names from TOC-files. Finally, sort the publication names.
    this.groupedTexts().forEach((item: any) => {
      if (item.collection_id && item.publications) {
        this.tocService.getFlattenedTableOfContents(item.collection_id).pipe(
          take(1),
          takeUntilDestroyed(this.destroyRef)
        ).subscribe(
          (tocData: any) => {
            if (fetchToken !== this.latestFetchToken) {
              return;
            }

            const nextGroupedTexts = this.groupedTexts().map((currentCollection: any) => {
              if (currentCollection.collection_id !== item.collection_id) {
                return currentCollection;
              }

              const nextPublications = currentCollection.publications.map((pub: any) => {
                const nextPublication = {
                  ...pub,
                  occurrences: [...pub.occurrences]
                };

                const id = currentCollection.collection_id + '_' + nextPublication.publication_id;
                tocData?.children?.forEach((tocItem: any) => {
                  if (id === tocItem['itemId']) {
                    nextPublication.occurrences[0].displayName = String(tocItem['text']);
                    nextPublication.name = String(tocItem['text']);
                  }
                });

                if (nextPublication.occurrences?.length > 1) {
                  sortArrayOfObjectsAlphabetically(nextPublication.occurrences, 'textType');
                }

                return nextPublication;
              });

              if (nextPublications !== undefined) {
                sortArrayOfObjectsAlphabetically(nextPublications, 'name');
              }

              return {
                ...currentCollection,
                publications: nextPublications
              };
            });

            this.groupedTexts.set(nextGroupedTexts);
          }
        );
      }
    });
  }

  // -----------------------------------------------------------------------------
  // Public UI actions (called from template)
  // -----------------------------------------------------------------------------
  toggleList(id: any) {
    const nextGroupedTexts = this.groupedTexts().map((item: any) => {
      if (id !== item.collection_id) {
        return item;
      }

      return {
        ...item,
        hidden: !item.hidden
      };
    });

    this.groupedTexts.set(nextGroupedTexts);
  }

}
