import { Component, Input, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { config } from '@config';
import { CollectionPagePathPipe } from '@pipes/collection-page-path.pipe';
import { OccurrenceCollectionTextPageQueryparamsPipe } from '@pipes/occurrence-collection-text-page-queryparams.pipe';
import { Occurrence } from '@models/occurrence.model';
import { SingleOccurrence } from '@models/single-occurrence.model';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { NamedEntityService } from '@services/named-entity.service';
import { sortArrayOfObjectsAlphabetically } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'occurrences-accordion',
  templateUrl: './occurrences-accordion.component.html',
  styleUrls: ['./occurrences-accordion.component.scss'],
  imports: [NgFor, NgIf, IonicModule, RouterModule, CollectionPagePathPipe, OccurrenceCollectionTextPageQueryparamsPipe]
})
export class OccurrencesAccordionComponent implements OnInit {
  @Input() id: number | undefined = undefined;
  @Input() type: string = '';

  groupedTexts: any[] = [];
  isLoading: boolean = true;
  occurrenceData: any[] = [];
  showPublishedStatus: number = 2;
  simpleWorkMetadata: boolean = false;

  constructor(
    private namedEntityService: NamedEntityService,
    private tocService: CollectionTableOfContentsService
  ) {
    this.simpleWorkMetadata = config.modal?.namedEntity?.useSimpleWorkMetadata ?? false;
  }

  ngOnInit() {
    if (this.type === 'keyword') {
      this.showPublishedStatus = config.page?.index?.keywords?.publishedStatus ?? 2;
    } else if (this.type === 'person') {
      this.showPublishedStatus = config.page?.index?.persons?.publishedStatus ?? 2;
    } else if (this.type === 'place') {
      this.showPublishedStatus = config.page?.index?.places?.publishedStatus ?? 2;
    } else if (this.type === 'work') {
      this.showPublishedStatus = config.page?.index?.works?.publishedStatus ?? 2;
    }

    if (this.type === 'work' && this.simpleWorkMetadata) {
      this.isLoading = false;
    } else if (this.id && this.type) {
      this.getOccurrenceData(this.id);
    }
  }

  private getOccurrenceData(id: any) {
    this.isLoading = true;
    let objectType = this.type;
    if (objectType === 'work') {
      objectType = 'work_manifestation';
    }
    this.namedEntityService.getEntityOccurrences(objectType, id).subscribe({
      next: (occ: any) => {
        occ.forEach((item: any) => {
          if (item.occurrences?.length) {
            for (const occurence of item.occurrences) {
              this.categorizeOccurrence(occurence);
            }
          }
        });
        // Sort collection names alphabetically
        sortArrayOfObjectsAlphabetically(this.groupedTexts, 'name');

        // Replace publication names (from the database) with the names
        // in the collection TOC-file and sort by publication name.
        this.updateAndSortPublicationNamesInOccurrenceResults();

        this.occurrenceData = this.groupedTexts;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error getting occurrence texts', err);
        this.isLoading = false;
      }
    });
  }

  private categorizeOccurrence(occurrence: Occurrence) {
    if (
        occurrence.publication_id &&
        !occurrence.publication_manuscript_id &&
        !occurrence.publication_comment_id &&
        !occurrence.publication_facsimile_id &&
        !occurrence.publication_version_id
      ) {
        this.setOccurrenceType(occurrence, 'rt');
    } else {
      if (occurrence.publication_manuscript_id) {
        this.setOccurrenceType(occurrence, 'ms');
      }
      if (occurrence.publication_version_id) {
        this.setOccurrenceType(occurrence, 'var');
      }
      if (occurrence.publication_comment_id) {
        this.setOccurrenceType(occurrence, 'com');
      }
      if (occurrence.publication_facsimile_id) {
        this.setOccurrenceType(occurrence, 'facs')
      }
    }
  }

  private setOccurrenceType(occ: Occurrence, type: string) {
    const newOccurrence = new SingleOccurrence();
    const fileName = occ.original_filename ?? (
      occ.collection_id + '_' + occ.publication_id + '.xml'
    );

    newOccurrence.linkID = fileName?.split('.xml')[0];
    newOccurrence.collectionID = occ.collection_id && occ.publication_id ?
      occ.collection_id + '_' + occ.publication_id
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
    this.setOccurrenceTree(newOccurrence, occ);
  }

  private setOccurrenceTree(newOccurrence: any, occ: any) {
    let foundCollection = false;
    for (let i = 0; i < this.groupedTexts.length; i++) {
      if (this.groupedTexts[i].collection_id === occ.collection_id) {
        foundCollection = true;
        let foundPublication = false;
        for (let j = 0; j < this.groupedTexts[i].publications.length; j++) {
          if (this.groupedTexts[i].publications[j].publication_id === occ.publication_id) {
            this.groupedTexts[i].publications[j].occurrences.push(newOccurrence);
            foundPublication = true;
            break;
          }
        }
        if (!foundPublication && occ.publication_published >= this.showPublishedStatus) {
          const item = {
            publication_id: occ.publication_id,
            name: occ.publication_name,
            occurrences: [newOccurrence]
          };
          this.groupedTexts[i].publications.push(item);
        }
        break;
      }
    }

    if (!foundCollection) {
      if (occ.collection_name === undefined) {
        occ.collection_name = occ.publication_collection_name;
      }
      if (occ.publication_published >= this.showPublishedStatus) {
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
        this.groupedTexts.push(item);
      }
    }
  }

  private updateAndSortPublicationNamesInOccurrenceResults() {
    // Loop through each collection with occurrence results, get TOC for each collection,
    // then loop through each publication with occurrence results in each collection and
    // update publication names from TOC-files. Finally, sort the publication names.
    this.groupedTexts.forEach((item: any) => {
      if (item.collection_id && item.publications) {
        this.tocService.getFlattenedTableOfContents(item.collection_id).subscribe(
          (tocData: any) => {
            item.publications.forEach((pub: any) => {
              const id = item.collection_id + '_' + pub.publication_id;
              tocData.children.forEach((tocItem: any) => {
                if (id === tocItem['itemId']) {
                  pub.occurrences[0].displayName = String(tocItem['text']);
                  pub.name = String(tocItem['text']);
                }
              });
              if (pub.occurrences?.length > 1) {
                sortArrayOfObjectsAlphabetically(pub.occurrences, 'textType');
              }
            });
            if (item.publications !== undefined) {
              sortArrayOfObjectsAlphabetically(item.publications, 'name');
            }
          }
        );
      }
    });
  }

  toggleList(id: any) {
    for (let i = 0; i < this.groupedTexts.length; i++) {
      if (id === this.groupedTexts[i]['collection_id']) {
        this.groupedTexts[i].hidden ? this.groupedTexts[i].hidden = false : this.groupedTexts[i].hidden = true;
      }
    }
  }

}
