import { Component, LOCALE_ID, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { config } from '@config';
import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'page-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
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
  searchQuery: string = '';

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
    if (this.searchQuery) {
      this.router.navigate(
        ['/search'],
        { queryParams: { query: this.searchQuery } }
      );
      this.searchQuery = '';
    }
  }

  clearSearchQuery() {
    this.searchQuery = '';
  }

}
