import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { catchError, filter, forkJoin, map, Observable, of, Subscription, timeout } from 'rxjs';

import { config } from '@config';
import { OccurrencesAccordionComponent } from '@components/occurrences-accordion/occurrences-accordion.component';
import { NamedEntityArticle, NamedEntityDetails, NamedEntityGalleryOccurrence, NamedEntityMedia, NamedEntityModalData, NamedEntityModalDataResponse } from '@models/named-entity.models';
import { NamedEntityService } from '@services/named-entity.service';
import { TooltipService } from '@services/tooltip.service';
import { isEmptyObject } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'modal-named-entity',
  templateUrl: './named-entity.modal.html',
  styleUrls: ['./named-entity.modal.scss'],
  imports: [IonicModule, OccurrencesAccordionComponent, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NamedEntityModal implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, @Input properties, local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);
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

  loadingErrorData = signal(false);
  objectData = signal<NamedEntityModalData | undefined>(undefined);

  private routerEventsSubscription: Subscription | null = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle wiring
  // ─────────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadNamedEntityData();
    this.registerRouterEventsSubscription();
  }

  ionViewWillLeave() {
    this.routerEventsSubscription?.unsubscribe();
    this.routerEventsSubscription = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal data loading and modal behavior
  // ─────────────────────────────────────────────────────────────────────────────
  private loadNamedEntityData() {
    this.getNamedEntityData(this.type, this.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((data: NamedEntityModalData | undefined) => {
      this.objectData.set(data);
    });
  }

  private registerRouterEventsSubscription() {
    // Close the modal on route change
    this.routerEventsSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      void this.dismissTopModal();
    });
  }

  private async dismissTopModal() {
    const modal = await this.modalCtrl.getTop();
    modal?.dismiss();
  }

  private getNamedEntityData(type: string, id: string): Observable<NamedEntityModalData | undefined> {
    return forkJoin(
      [
        this.getEntityDetails(type, id),
        this.getEntityMediaData(type, id),
        this.getEntityArticleData(type, id),
        this.getEntityGalleryOccurrences(type, id)
      ]
    ).pipe(
      map((res: NamedEntityModalDataResponse) => {
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
          this.loadingErrorData.set(true);
          return undefined;
        } else {
          const data: NamedEntityModalData = {
            details: res[0],
            media: res[1],
            articles: Array.isArray(res[2]) ? res[2] : [],
            galleryOccurrences: Array.isArray(res[3]) ? res[3] : [],
          };

          return data;
        }
      }),
      catchError((error: any) => {
        console.error('Error loading object data', error);
        this.loadingErrorData.set(true);
        return of(undefined);
      })
    );
  }

  private getEntityDetails(type: string, id: string): Observable<NamedEntityDetails> {
    if (type !== 'work' || (type === 'work' && this.simpleWorkMetadata)) {
      // Get semantic data object details from the backend API
      return this.namedEntityService.getEntity(type, id).pipe(
        timeout(20000),
        map((data: NamedEntityDetails) => {
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
        catchError(() => {
          return of({});
        })
      );
    } else {
      // For work manifestations, get semantic data object details from Elasticsearch API
      return this.namedEntityService.getEntityFromElastic(type, id).pipe(
        timeout(20000),
        map((data: any): NamedEntityDetails => {
          if (data?.hits?.hits?.length < 1) {
            return {};
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
          return data as NamedEntityDetails;
        }),
        catchError(() => {
          return of({});
        })
      );
    }
  }

  private getEntityMediaData(type: string, id: string): Observable<NamedEntityMedia> {
    if (!this.showMediaData) {
      return of({});
    }

    return this.namedEntityService.getEntityMediaData(type, id).pipe(
      timeout(20000),
      map((data: NamedEntityMedia) => {
        data.imageUrl = data.image_path;
        return data;
      }),
      catchError(() => {
        return of({});
      })
    );
  }

  private getEntityArticleData(type: string, id: string): Observable<NamedEntityArticle[] | Record<string, unknown>> {
    if (!this.showArticleData) {
      return of({});
    }

    return this.namedEntityService.getEntityArticleData(type, id).pipe(
      timeout(20000),
      map((data: any) => data as NamedEntityArticle[]),
      catchError(() => {
        return of({});
      })
    );
  }

  private getEntityGalleryOccurrences(type: string, id: string): Observable<NamedEntityGalleryOccurrence[] | Record<string, unknown>> {
    if (!this.showGalleryOccurrences) {
      return of({});
    }

    return this.namedEntityService.getEntityMediaCollectionOccurrences(type, id).pipe(
      timeout(20000),
      map((data: any) => data as NamedEntityGalleryOccurrence[]),
      catchError(() => {
        return of({});
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────
  cancel() {
    return this.modalCtrl.dismiss(null, 'close');
  }

}
