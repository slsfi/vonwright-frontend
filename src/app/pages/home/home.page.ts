import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { catchError, map, Observable, of } from 'rxjs';

import { config } from '@config';
import { MarkdownContentService } from '@services/markdown-content.service';


@Component({
  selector: 'page-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  descriptionText$: Observable<SafeHtml>;
  footerText$: Observable<SafeHtml>;
  imageAltText: string = '';
  imageOnRight: boolean = false;
  imageOrientationPortrait: boolean = false;
  imageURL: string = '';
  imageURLStyle: string = '';
  portraitImageObjectPosition: string | null = null;
  searchQuery: string = '';
  showContentGrid: boolean = false;
  showFooter: boolean = false;
  showSearchbar: boolean = false;
  siteHasSubtitle: boolean = false;
  titleOnImage: boolean = false;

  constructor(
    private mdContentService: MarkdownContentService,
    private router: Router,
    private sanitizer: DomSanitizer,
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
    this.descriptionText$ = this.getMdContent(this.activeLocale + '-01');
    if (this.showFooter) {
      this.footerText$ = this.getMdContent(this.activeLocale + '-06');
    }
  }

  private getMdContent(fileID: string): Observable<SafeHtml> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        return this.sanitizer.bypassSecurityTrustHtml(
          this.mdContentService.getParsedMd(res.content)
        );
      }),
      catchError((e) => {
        console.error(e);
        return of('');
      })
    );
  }

  submitSearchQuery() {
    if (this.searchQuery) {
      this.router.navigate(
        ['/search'],
        {
          queryParams: { query: this.searchQuery }
        }
      );
    }
  }

  clearSearchQuery() {
    this.searchQuery = '';
  }

}
