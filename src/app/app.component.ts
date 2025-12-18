import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Params, PRIMARY_OUTLET, Router, UrlSegment, UrlTree } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { DocumentHeadService } from '@services/document-head.service';
import { PlatformService } from '@services/platform.service';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent implements OnDestroy, OnInit {
  private headService = inject(DocumentHeadService);
  private platformService = inject(PlatformService);
  private router = inject(Router);
  private tocService = inject(CollectionTableOfContentsService);

  readonly enableCollectionSideMenuSSR: boolean = config.app?.ssr?.collectionSideMenu ?? false;
  readonly enableRouterLoadingBar: boolean = config.app?.enableRouterLoadingBar ?? false;

  appIsStarting: boolean = true;
  collectionID: string = '';
  collSideMenuUrlSegments: UrlSegment[];
  collSideMenuQueryParams: Params;
  currentRouterUrl: string = '';
  currentUrlSegments: UrlSegment[] = [];
  loadingBarHidden: boolean = false;
  mobileMode: boolean = true;
  mountMainSideMenu: boolean = false;
  previousRouterUrl: string = '';
  routerEventsSubscription: Subscription;
  showCollectionSideMenu: boolean = false;
  showSideNav: boolean = false;

  ngOnInit(): void {
    this.mobileMode = this.platformService.isMobile();
    // Side menu is shown by default in desktop mode but not in
    // mobile mode.
    this.showSideNav = !this.mobileMode;

    // Set Open Graph meta tags that are common for all routes.
    // og:title is set by this.headService.setTitle
    this.headService.setCommonOpenGraphTags();

    this.routerEventsSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.previousRouterUrl = this.currentRouterUrl;
      this.currentRouterUrl = event.url;
      const currentUrlTree: UrlTree = this.router.parseUrl(event.url);
      this.currentUrlSegments = currentUrlTree?.root?.children[PRIMARY_OUTLET]?.segments;

      // Check if a collection page in order to show collection side
      // menu instead of main side menu.
      if (this.currentUrlSegments?.[0]?.path === 'collection') {
        const newCollectionID = this.currentUrlSegments[1]?.path || '';
        
        if (this.collectionID !== newCollectionID) {
          this.collectionID = newCollectionID;
          this.tocService.setCurrentCollectionToc(this.collectionID);
        }

        this.collSideMenuUrlSegments = this.currentUrlSegments;
        this.collSideMenuQueryParams = currentUrlTree?.queryParams;
        this.showCollectionSideMenu = true;
      } else {
        // If the app is started on a collection-page the main side menu
        // is not immediately created in order to increase performance.
        // Once the user leaves the collection pages the side menu gets
        // created and stays mounted. It is hidden with css if the user
        // visits a collection page and the collection side menu is
        // displayed.
        this.mountMainSideMenu = true;
        this.showCollectionSideMenu = false;
        // Clear the collection TOC loaded in the collection side menu
        // to prevent the previous TOC from flashing in view when
        // entering another collection.
        this.collectionID = '';
        this.tocService.setCurrentCollectionToc('');
      }

      // Hide side menu if:
      // 1. navigating to a new url in mobile mode (changes to
      //    queryParams disregarded).
      // 2. app is starting on the home page in desktop mode.
      if (
        (
          this.mobileMode &&
          this.currentRouterUrl.split('?')[0] !== this.previousRouterUrl.split('?')[0]
        ) ||
        (
          this.appIsStarting &&
          !this.currentUrlSegments &&
          !this.mobileMode
        )
      ) {
        this.showSideNav = false;
      }

      // Open side menu if:
      // 1. user navigated to a collection page from the content page
      // 2. queryParams contains menu=open
      if (
        (
          this.currentUrlSegments?.[0]?.path === 'collection' &&
          this.previousRouterUrl === '/content'
        ) ||
        currentUrlTree?.queryParams?.menu === 'open'
      ) {
        this.showSideNav = true;
      }

      if (this.appIsStarting) {
        this.appIsStarting = false;
      }

      this.setTitleForTopMenuPages(this.currentUrlSegments?.[0]?.path || '');

      if (this.currentRouterUrl === '/') {
        this.headService.setMetaTag(
          'name',
          'description',
          $localize`:@@Site.MetaDescription.Home:En generell beskrivning av webbplatsen för sökmotorer.`
        );
        this.headService.setOpenGraphDescriptionProperty(
          $localize`:@@Site.MetaDescription.Home:En generell beskrivning av webbplatsen för sökmotorer.`
        );
      } else {
        this.headService.setMetaTag('name', 'description', '');
        this.headService.setOpenGraphDescriptionProperty('');
      }

      this.headService.setLinks(this.currentRouterUrl);
      this.headService.setOpenGraphURLProperty(this.currentRouterUrl);
    });
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
  }

  toggleSideNav() {
    this.showSideNav = !this.showSideNav;
  }

  hideLoadingBar(hide: boolean): void {
    if (hide && isBrowser()) {
      setTimeout(() => {
        this.loadingBarHidden = hide;
      }, 700);
    } else {
      this.loadingBarHidden = hide;
    }
  }

  private setTitleForTopMenuPages(routeBasePath?: string) {
    switch (routeBasePath) {
      case 'content':
        this.headService.setTitle([$localize`:@@TopMenu.Content:Innehåll`]);
        return;
      case 'search':
        this.headService.setTitle([$localize`:@@TopMenu.Search:Sök`]);
        return;
      default:
        !routeBasePath && this.headService.setTitle();
        return;
    }
  }

}
