import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonSpinner, IonToolbar } from '@ionic/angular';
import { catchError, combineLatest, filter, map, Observable, of, switchMap } from 'rxjs';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { CollectionCover } from '@models/collection.models';
import { CollectionCoverService } from '@services/collection-cover.service';
import { PlatformService } from '@services/platform.service';


@Component({
  selector: 'page-cover',
  templateUrl: './collection-cover.page.html',
  styleUrls: ['./collection-cover.page.scss'],
  imports: [AsyncPipe, IonContent, IonHeader, IonSpinner, IonToolbar, TextChangerComponent]
})
export class CollectionCoverPage {
  private collectionCoverService = inject(CollectionCoverService);
  private platformService = inject(PlatformService);
  private route = inject(ActivatedRoute);

  readonly activeComponent = signal(true);
  readonly mobileMode = this.platformService.isMobile();
  private readonly active$ = toObservable(this.activeComponent);

  readonly coverData$: Observable<CollectionCover> = combineLatest([this.route.params, this.active$]).pipe(
    filter(([, active]) => active),
    switchMap(([{collectionID}]) => this.getCoverData(collectionID))
  );

  ionViewWillEnter() {
    this.activeComponent.set(true);
  }

  ionViewWillLeave() {
    this.activeComponent.set(false);
  }

  private getCoverData(collectionID: number | string): Observable<CollectionCover> {
    return this.collectionCoverService.getCoverData(collectionID).pipe(
      map(cover => ({
        imageAltText: cover.imageAltText || 'Collection cover image',
        imageURL: cover.imageURL || 'assets/images/collection-cover-placeholder.jpg'
      })),
      catchError((e: any) => {
        console.error('Error loading markdown content for cover image', e);
        return of({
          imageAltText: 'Cover image',
          imageURL: 'assets/images/collection-cover-placeholder.jpg'
        });
      })
    );
  }

}
