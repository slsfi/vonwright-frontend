import { Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { catchError, Observable, of, Subject } from 'rxjs';

import { CollectionContentService } from '@services/collection-content.service';


@Component({
  selector: 'text-metadata',
  templateUrl: './metadata.component.html',
  styleUrls: ['./metadata.component.scss'],
  imports: [AsyncPipe, IonicModule]
})
export class MetadataComponent implements OnInit {
  @Input() textItemID: string = '';

  loadingError$: Subject<boolean> = new Subject<boolean>();
  metadata$: Observable<any>;

  constructor(
    private collectionContentService: CollectionContentService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.metadata$ = this.collectionContentService.getMetadata(
      this.textItemID.split('_')[1] || '0', this.activeLocale
    ).pipe(
      catchError((error) => {
        console.error('Error loading metadata', error);
        this.loadingError$.next(true);
        return of();
      })
    );
  }

}
