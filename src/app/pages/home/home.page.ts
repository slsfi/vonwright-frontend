import { AsyncPipe } from '@angular/common';
import { Component, LOCALE_ID, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSearchbar } from '@ionic/angular';
import { Observable } from 'rxjs';

import { ContentGridComponent } from '@components/content-grid/content-grid.component';
import { config } from '@config';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'page-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    AsyncPipe,
    ContentGridComponent,
    FormsModule,
    IonButton,
    IonContent,
    IonIcon,
    IonSearchbar,
    TrustHtmlPipe
  ]
})
export class HomePage implements OnInit {
  private mdService = inject(MarkdownService);
  private router = inject(Router);
  private activeLocale = inject(LOCALE_ID);

  readonly imageAltText: string = config.page?.home?.bannerImage?.altTexts?.[this.activeLocale] ?? 'image';
  readonly imageHeight: number | null = config.page?.home?.bannerImage?.intrinsicSize?.height ?? null;
  readonly imageOnRight: boolean = config.page?.home?.portraitOrientationSettings?.imagePlacement?.onRight ?? false;
  readonly imageOrientationPortrait: boolean = config.page?.home?.bannerImage?.orientationPortrait ?? false;
  readonly imageSources: any[] = config.page?.home?.bannerImage?.alternateSources ?? [];
  readonly imageURL: string = config.page?.home?.bannerImage?.URL ?? 'assets/images/home-page-banner.jpg';
  readonly imageURLStyle: string = `url(${this.imageURL})`;
  readonly imageWidth: number | null = config.page?.home?.bannerImage?.intrinsicSize?.width ?? null;
  readonly portraitImageObjectPosition: string | null = config.page?.home?.portraitOrientationSettings?.imagePlacement?.squareCroppedVerticalOffset ? '50% ' + config.page?.home?.portraitOrientationSettings?.imagePlacement?.squareCroppedVerticalOffset : null;
  readonly showContentGrid: boolean = config.page?.home?.showContentGrid ?? false;
  readonly showFooter: boolean = config.page?.home?.showFooter ?? false;
  readonly showSearchbar: boolean = config.page?.home?.showSearchbar ?? false;
  readonly siteHasSubtitle: boolean = $localize`:@@Site.Subtitle:Webbplatsens undertitel` ? true : false;
  readonly titleOnImage: boolean = config.page?.home?.portraitOrientationSettings?.siteTitleOnImageOnSmallScreens ?? false;

  descriptionText$: Observable<string | null>;
  footerText$: Observable<string | null>;
  readonly searchQuery = signal('');

  ngOnInit() {
    this.descriptionText$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-01'
    );
    if (this.showFooter) {
      this.footerText$ = this.mdService.getParsedMdContent(
        this.activeLocale + '-06'
      );
    }
  }

  submitSearchQuery() {
    const searchQuery = this.searchQuery();
    if (searchQuery) {
      this.router.navigate(
        ['/search'],
        { queryParams: { query: searchQuery } }
      );
      this.searchQuery.set('');
    }
  }

  clearSearchQuery() {
    this.searchQuery.set('');
  }

  setSearchQuery(searchQuery: string) {
    this.searchQuery.set(searchQuery);
  }

}
