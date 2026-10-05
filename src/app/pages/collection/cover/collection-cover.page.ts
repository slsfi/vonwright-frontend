import { AsyncPipe } from '@angular/common';
import { Component, LOCALE_ID, OnInit, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonSpinner, IonToolbar } from '@ionic/angular';
import { catchError, combineLatest, filter, map, Observable, of, switchMap } from 'rxjs';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { MarkdownService } from '@services/markdown.service';
import { PlatformService } from '@services/platform.service';


@Component({
  selector: 'page-cover',
  templateUrl: './collection-cover.page.html',
  styleUrls: ['./collection-cover.page.scss'],
  imports: [AsyncPipe, IonContent, IonHeader, IonSpinner, IonToolbar, TextChangerComponent]
})
export class CollectionCoverPage implements OnInit {
  private mdService = inject(MarkdownService);
  private platformService = inject(PlatformService);
  private route = inject(ActivatedRoute);
  private activeLocale = inject(LOCALE_ID);

  readonly activeComponent = signal(true);
  coverData$: Observable<any>;
  readonly mobileMode = this.platformService.isMobile();
  private readonly active$ = toObservable(this.activeComponent);

  ngOnInit() {
    this.coverData$ = combineLatest([this.route.params, this.active$]).pipe(
      filter(([, active]) => active),
      switchMap(([{collectionID}]) => {
        return this.getCoverDataFromMdContent(
          `${this.activeLocale}-08-${collectionID}`
        );
      })
    );
  }

  ionViewWillEnter() {
    this.activeComponent.set(true);
  }

  ionViewWillLeave() {
    this.activeComponent.set(false);
  }

  private getCoverDataFromMdContent(fileID: string): Observable<any> {
    return this.mdService.getMdContent(fileID).pipe(
      map((md: string) => {
        // Extract image url and alt-text from markdown content.
        const m = md.match(/!\[(.*?)\]\((.*?)\)/);
        const image_alt = m?.[1] || 'Collection cover image';
        const image_src = m?.[2] || 'assets/images/collection-cover-placeholder.jpg';

        return { image_alt, image_src };
      }),
      catchError((e: any) => {
        console.error('Error loading markdown content for cover image', e);
        return of({
          image_alt: 'Cover image',
          image_src: 'assets/images/collection-cover-placeholder.jpg'
        });
      })
    );
  }

}
