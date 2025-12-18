import { Component, LOCALE_ID, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';
import { PlatformService } from '@services/platform.service';


@Component({
  selector: 'page-cover',
  templateUrl: './collection-cover.page.html',
  styleUrls: ['./collection-cover.page.scss'],
  standalone: false
})
export class CollectionCoverPage implements OnInit {
  private mdService = inject(MarkdownService);
  private platformService = inject(PlatformService);
  private route = inject(ActivatedRoute);
  private activeLocale = inject(LOCALE_ID);

  _activeComponent: boolean = true;
  collectionID: string = '';
  coverData$: Observable<any>;
  mobileMode: boolean = false;

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    this.coverData$ = this.route.params.pipe(
      tap(({collectionID}) => {
        this.collectionID = collectionID;
      }),
      switchMap(({collectionID}) => {
        return this.getCoverDataFromMdContent(
          `${this.activeLocale}-08-${collectionID}`
        );
      })
    );
  }

  ionViewWillEnter() {
    this._activeComponent = true;
  }

  ionViewWillLeave() {
    this._activeComponent = false;
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
