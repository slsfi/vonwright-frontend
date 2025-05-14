import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
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
  descriptionText$: Observable<string | null>;
  footerText$: Observable<string | null>;
  imageAltText: string = '';
  imageOnRight: boolean = false;
  imageOrientationPortrait: boolean = false;
  imageSources: any[] = [];
  imageURL: string = '';
  imageURLStyle: string = '';
  imageHeight: number | null = null;
  imageWidth: number | null = null;
  portraitImageObjectPosition: string | null = null;
  searchQuery: string = '';
  showContentGrid: boolean = false;
  showFooter: boolean = false;
  showSearchbar: boolean = false;
  siteHasSubtitle: boolean = false;
  titleOnImage: boolean = false;

  constructor(
    private mdService: MarkdownService,
    private router: Router,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.imageAltText = config.page?.home?.bannerImage?.altTexts?.[this.activeLocale] ?? 'image';
    this.imageOnRight = config.page?.home?.portraitOrientationSettings?.imagePlacement?.onRight ?? false;
    this.imageOrientationPortrait = config.page?.home?.bannerImage?.orientationPortrait ?? false;
    this.imageURL = config.page?.home?.bannerImage?.URL ?? 'assets/images/home-page-banner.jpg';
    this.imageURLStyle = `url(${this.imageURL})`;
    this.showContentGrid = config.page?.home?.showContentGrid ?? false;
    this.showFooter = config.page?.home?.showFooter ?? false;
    this.showSearchbar = config.page?.home?.showSearchbar ?? false;
    this.titleOnImage = config.page?.home?.portraitOrientationSettings?.siteTitleOnImageOnSmallScreens ?? false;
    this.imageHeight = config.page?.home?.bannerImage?.intrinsicSize?.height ?? null;
    this.imageWidth = config.page?.home?.bannerImage?.intrinsicSize?.width ?? null;
    this.imageSources = config.page?.home?.bannerImage?.alternateSources ?? [];

    if (config.page?.home?.portraitOrientationSettings?.imagePlacement?.squareCroppedVerticalOffset) {
      this.portraitImageObjectPosition = '50% ' + config.page?.home?.portraitOrientationSettings?.imagePlacement?.squareCroppedVerticalOffset;
    }

    // Only show subtitle if translation for it not missing
    if ($localize`:@@Site.Subtitle:Webbplatsens undertitel`) {
      this.siteHasSubtitle = true;
    } else {
      this.siteHasSubtitle = false;
    }
  }

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
    }
  }

  clearSearchQuery() {
    this.searchQuery = '';
  }

}
