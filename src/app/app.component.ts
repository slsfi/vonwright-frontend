import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params, PRIMARY_OUTLET, Router, UrlSegment, UrlTree } from '@angular/router';
import { IonApp, IonProgressBar, IonRouterOutlet, IonSpinner } from '@ionic/angular';

import { CollectionSideMenuComponent } from '@components/menus/collection-side/collection-side-menu.component';
import { MainSideMenuComponent } from '@components/menus/main-side/main-side-menu.component';
import { TopMenuComponent } from '@components/menus/top/top-menu.component';
import { StaticHtmlComponent } from '@components/static-html/static-html.component';
import { config } from '@config';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { DocumentHeadService } from '@services/document-head.service';
import { PlatformService } from '@services/platform.service';
import { RouterNavigationSourceService } from '@services/router-navigation-source.service';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    IonApp,
    IonProgressBar,
    IonRouterOutlet,
    IonSpinner,
    CollectionSideMenuComponent,
    MainSideMenuComponent,
    StaticHtmlComponent,
    TopMenuComponent
  ]
})
export class AppComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly headService = inject(DocumentHeadService);
  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);
  private readonly routerNavigationSource = inject(RouterNavigationSourceService);
  private readonly tocService = inject(CollectionTableOfContentsService);

  readonly enableCollectionSideMenuSSR: boolean = config.app?.ssr?.collectionSideMenu ?? false;
  readonly prebuiltCollectionMenus: boolean = config.app?.prebuild?.staticCollectionMenus ?? true;
  readonly enableRouterLoadingBar: boolean = config.app?.enableRouterLoadingBar ?? false;
  readonly authEnabled: boolean = config?.app?.auth?.enabled === true;

  readonly mobileMode = this.platformService.isMobile();
  readonly collectionID = signal('');
  readonly collSideMenuUrlSegments = signal<UrlSegment[]>([]);
  readonly collSideMenuQueryParams = signal<Params>({});
  readonly currentRouterUrl = signal('');
  readonly currentUrlSegments = signal<UrlSegment[]>([]);
  readonly loadingBarHidden = signal(false);
  readonly mountMainSideMenu = signal(false);
  readonly showCollectionSideMenu = signal(false);
  readonly showSideNav = signal(!this.mobileMode);

  private appIsStarting = true;
  private loadingBarHideTimer: ReturnType<typeof setTimeout> | undefined;
  private previousRouterUrl = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.clearLoadingBarHideTimer());
  }

  ngOnInit(): void {
    // Set Open Graph meta tags that are common for all routes.
    // og:title is set by this.headService.setTitle
    this.headService.setCommonOpenGraphTags();

    this.routerNavigationSource.get(this.router).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((url: string) => {
      this.previousRouterUrl = this.currentRouterUrl();
      this.currentRouterUrl.set(url);
      const currentUrlTree: UrlTree = this.router.parseUrl(url);
      const currentUrlSegments = currentUrlTree?.root?.children[PRIMARY_OUTLET]?.segments ?? [];
      this.currentUrlSegments.set(currentUrlSegments);

      // Check if a collection page in order to show collection side
      // menu instead of main side menu.
      if (currentUrlSegments[0]?.path === 'collection') {
        const newCollectionID = currentUrlSegments[1]?.path || '';
        
        if (this.collectionID() !== newCollectionID) {
          this.collectionID.set(newCollectionID);
          this.tocService.setCurrentCollectionToc(newCollectionID);
        }

        this.collSideMenuUrlSegments.set(currentUrlSegments);
        this.collSideMenuQueryParams.set(currentUrlTree.queryParams);
        this.showCollectionSideMenu.set(true);
      } else {
        // If the app is started on a collection-page the main side menu
        // is not immediately created in order to increase performance.
        // Once the user leaves the collection pages the side menu gets
        // created and stays mounted. It is hidden with css if the user
        // visits a collection page and the collection side menu is
        // displayed.
        this.mountMainSideMenu.set(true);
        this.showCollectionSideMenu.set(false);
        // Clear the collection TOC loaded in the collection side menu
        // to prevent the previous TOC from flashing in view when
        // entering another collection.
        if (this.collectionID()) {
          this.collectionID.set('');
          this.tocService.setCurrentCollectionToc('');
        }
      }

      // Hide side menu if:
      // 1. navigating to a new url in mobile mode (changes to
      //    queryParams disregarded).
      // 2. app is starting on the home page in desktop mode.
      if (
        (
          this.mobileMode &&
          url.split('?')[0] !== this.previousRouterUrl.split('?')[0]
        ) ||
        (
          this.appIsStarting &&
          currentUrlSegments.length === 0 &&
          !this.mobileMode
        )
      ) {
        this.showSideNav.set(false);
      }

      // Open side menu if:
      // 1. user navigated to a collection page from the content page
      // 2. queryParams contains menu=open
      if (
        (
          currentUrlSegments[0]?.path === 'collection' &&
          this.previousRouterUrl === '/content'
        ) ||
        currentUrlTree.queryParams?.menu === 'open'
      ) {
        this.showSideNav.set(true);
      }

      if (this.appIsStarting) {
        this.appIsStarting = false;
      }

      this.setTitleForTopMenuPages(currentUrlSegments[0]?.path || '');

      if (url === '/') {
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

      this.headService.setLinks(url);
      this.headService.setOpenGraphURLProperty(url);
    });
  }

  toggleSideNav(): void {
    this.showSideNav.update(show => !show);
  }

  hideLoadingBar(hide: boolean): void {
    this.clearLoadingBarHideTimer();

    if (hide && isBrowser()) {
      this.loadingBarHideTimer = setTimeout(() => {
        this.loadingBarHideTimer = undefined;
        this.loadingBarHidden.set(true);
      }, 700);
    } else {
      this.loadingBarHidden.set(hide);
    }
  }

  private clearLoadingBarHideTimer(): void {
    if (this.loadingBarHideTimer !== undefined) {
      clearTimeout(this.loadingBarHideTimer);
      this.loadingBarHideTimer = undefined;
    }
  }

  private setTitleForTopMenuPages(routeBasePath?: string): void {
    switch (routeBasePath) {
      case 'content':
        this.headService.setTitle([$localize`:@@TopMenu.Content:Innehåll`]);
        return;
      case 'search':
        this.headService.setTitle([$localize`:@@TopMenu.Search:Sök`]);
        return;
      case 'register':
        this.headService.setTitle([$localize`:@@Register.Title:Skapa användarkonto`]);
        return;
      case 'forgot-password':
        this.headService.setTitle([$localize`:@@ForgotPassword.Title:Glömt lösenordet?`]);
        return;
      case 'change-password':
        this.headService.setTitle([$localize`:@@ForgotPassword.ChangeTitle:Ändra lösenord`]);
        return;
      case 'reset-password':
        this.headService.setTitle([$localize`:@@ResetPassword.Title:Nytt lösenord`]);
        return;
      case 'verify-email':
        this.headService.setTitle([$localize`:@@VerifyEmail.Title:Verifiera e-postadress`]);
        return;
      default:
        !routeBasePath && this.headService.setTitle();
        return;
    }
  }

}
