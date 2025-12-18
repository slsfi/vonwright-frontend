import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { catchError, defaultIfEmpty, filter, forkJoin, map, Observable, of, Subject, Subscription, timeout } from 'rxjs';

import { config } from '@config';
import { OccurrencesAccordionComponent } from '@components/occurrences-accordion/occurrences-accordion.component';
import { NamedEntityService } from '@services/named-entity.service';
import { TooltipService } from '@services/tooltip.service';
import { isEmptyObject } from '@utility-functions';


@Component({
  selector: 'modal-named-entity',
  templateUrl: './named-entity.modal.html',
  styleUrls: ['./named-entity.modal.scss'],
  imports: [AsyncPipe, IonicModule, OccurrencesAccordionComponent, RouterModule]
})
export class NamedEntityModal implements OnDestroy, OnInit {
  private modalCtrl = inject(ModalController);
  private namedEntityService = inject(NamedEntityService);
  private router = inject(Router);
  private tooltipService = inject(TooltipService);

  @Input() id: string = '';
  @Input() type: string = '';

  readonly showAliasAndPrevLastName: boolean = config.modal?.namedEntity?.showAliasAndPrevLastName ?? true;
  readonly showArticleData: boolean = config.modal?.namedEntity?.showArticleData ?? false;
  readonly showCityRegionCountry: boolean = config.modal?.namedEntity?.showCityRegionCountry ?? false;
  readonly showDescriptionLabel: boolean = config.modal?.namedEntity?.showDescriptionLabel ?? false;
  readonly showGalleryOccurrences: boolean = config.modal?.namedEntity?.showGalleryOccurrences ?? false;
  readonly showMediaData: boolean = config.modal?.namedEntity?.showMediaData ?? false;
  readonly showOccupation: boolean = config.modal?.namedEntity?.showOccupation ?? false;
  readonly showOccurrences: boolean = config.modal?.namedEntity?.showOccurrences ?? true;
  readonly showType: boolean = config.modal?.namedEntity?.showType ?? false;
  readonly simpleWorkMetadata: boolean = config.modal?.namedEntity?.useSimpleWorkMetadata ?? false;

  loadingErrorData$: Subject<boolean> = new Subject<boolean>();
  objectData$: Observable<any>;
  routerEventsSubscription: Subscription;

  ngOnInit() {
    this.objectData$ = this.getNamedEntityData(this.type, this.id);

    // Close the modal on route change
    this.routerEventsSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.modalCtrl.getTop().then((modal: any) => {
        modal?.dismiss();
      });
    });
  }

  ngOnDestroy() {
    this.routerEventsSubscription?.unsubscribe();
  }

  ionViewWillLeave() {
    this.routerEventsSubscription?.unsubscribe();
  }

  private getNamedEntityData(type: string, id: string): Observable<any> {
    return forkJoin(
      [
        this.getEntityDetails(type, id),
        this.getEntityMediaData(type, id),
        this.getEntityArticleData(type, id),
        this.getEntityGalleryOccurrences(type, id)
      ]
    ).pipe(
      map((res: any[]) => {
        let emptyData = true;
        for (let i = 0; i < res.length; i++) {
          if (
            (
              Array.isArray(res[i]) && res[i].length
            ) ||
            (
              typeof res[i] === 'object' && res[i] !== null && !isEmptyObject(res[i])
            )
          ) {
            emptyData = false;
          }
        }

        if (emptyData) {
          this.loadingErrorData$.next(true);
          defaultIfEmpty(null);
        } else {
          const data: any = {
            details: res[0],
            media: res[1],
            articles: res[2],
            galleryOccurrences: res[3],
          };

          return data;
        }
      }),
      catchError((error: any) => {
        console.error('Error loading object data', error);
        this.loadingErrorData$.next(true);
        return of(undefined);
      })
    );
  }

  private getEntityDetails(type: string, id: string): Observable<any> {
    if (type !== 'work' || (type === 'work' && this.simpleWorkMetadata)) {
      // Get semantic data object details from the backend API
      return this.namedEntityService.getEntity(type, id).pipe(
        timeout(20000),
        map((data: any) => {
          if (type === 'work') {
            data.description = null;
            data.source = null;
          }

          !data.title && data.full_name ? data.title = data.full_name
            : !data.title && data.name ? data.title = data.name
            : data.title;

          data.year_born_deceased = this.tooltipService.constructYearBornDeceasedString(
            data.date_born, data.date_deceased
          );
          // console.log('data object details: ', data);
          return data;
        }),
        catchError((error: any) => {
          return of({});
        })
      );
    } else {
      // For work manifestations, get semantic data object details from Elasticsearch API
      return this.namedEntityService.getEntityFromElastic(type, id).pipe(
        timeout(20000),
        map((data: any) => {
          if (data?.hits?.hits?.length < 1) {
            return of({});
          }

          data = data.hits.hits[0]['_source'];
          data.id = data['man_id' as keyof typeof data];
          data.description = data['reference' as keyof typeof data];
          if (
            !data.author_data ||
            !data.author_data[0] ||
            !data.author_data[0]['id']
          ) {
            data.author_data = [];
          }
          // console.log('work details: ', data);
          return data;
        }),
        catchError((error: any) => {
          return of({});
        })
      );
    }
  }

  private getEntityMediaData(type: string, id: string): Observable<any> {
    return (!this.showMediaData && of({})) || this.namedEntityService.getEntityMediaData(type, id).pipe(
      timeout(20000),
      map((data: any) => {
        data.imageUrl = data.image_path;
        return data;
      }),
      catchError((error: any) => {
        return of({});
      })
    );
  }

  private getEntityArticleData(type: string, id: string): Observable<any> {
    return (!this.showArticleData && of({})) || this.namedEntityService.getEntityArticleData(type, id).pipe(
      timeout(20000),
      catchError((error: any) => {
        return of({});
      })
    );
  }

  private getEntityGalleryOccurrences(type: string, id: string): Observable<any> {
    return (!this.showGalleryOccurrences && of({})) || this.namedEntityService.getEntityMediaCollectionOccurrences(type, id).pipe(
      timeout(20000),
      catchError((error: any) => {
        return of({});
      })
    );
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'close');
  }

}
