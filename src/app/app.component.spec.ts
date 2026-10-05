import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { DocumentHeadService } from '@services/document-head.service';
import { PlatformService } from '@services/platform.service';
import { RouterNavigationSourceService } from '@services/router-navigation-source.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let navigationUrls: Subject<string>;
  let mobileMode: boolean;
  let headService: jasmine.SpyObj<DocumentHeadService>;
  let tocService: jasmine.SpyObj<CollectionTableOfContentsService>;

  beforeEach(async () => {
    navigationUrls = new Subject<string>();
    mobileMode = false;
    headService = jasmine.createSpyObj<DocumentHeadService>('DocumentHeadService', [
      'setCommonOpenGraphTags',
      'setLinks',
      'setMetaTag',
      'setOpenGraphDescriptionProperty',
      'setOpenGraphURLProperty',
      'setTitle'
    ]);
    tocService = jasmine.createSpyObj<CollectionTableOfContentsService>(
      'CollectionTableOfContentsService',
      ['setCurrentCollectionToc']
    );

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: DocumentHeadService, useValue: headService },
        { provide: CollectionTableOfContentsService, useValue: tocService },
        { provide: PlatformService, useValue: { isMobile: () => mobileMode } },
        {
          provide: RouterNavigationSourceService,
          useValue: { get: () => navigationUrls.asObservable() }
        }
      ]
    })
      .overrideTemplate(AppComponent, `
        <span id="current-url">{{ currentRouterUrl() }}</span>
        <span id="collection-id">{{ collectionID() }}</span>
        <span id="query-position">{{ collSideMenuQueryParams()['position'] ?? '' }}</span>
        <span id="loading-bar-hidden">{{ loadingBarHidden() }}</span>
        <div id="main-side-menu" [class.mounted]="mountMainSideMenu()"></div>
        <div id="collection-side-menu" [class.visible]="showCollectionSideMenu()"></div>
        <div id="side-nav" [class.visible]="showSideNav()"></div>
      `)
      .compileComponents();
  });

  async function createComponent(): Promise<AppComponent> {
    fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  function element(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector) as HTMLElement;
  }

  it('creates the app with desktop side navigation visible', async () => {
    const component = await createComponent();

    expect(component).toBeTruthy();
    expect(component.mobileMode).toBeFalse();
    expect(component.showSideNav()).toBeTrue();
    expect(element('#side-nav').classList).toContain('visible');
  });

  it('updates collection route state and the DOM after navigation', async () => {
    mobileMode = true;
    const component = await createComponent();

    navigationUrls.next('/content');
    await fixture.whenStable();
    navigationUrls.next('/collection/203/introduction?position=2');
    await fixture.whenStable();

    expect(component.currentRouterUrl()).toBe('/collection/203/introduction?position=2');
    expect(component.currentUrlSegments().map(segment => segment.path))
      .toEqual(['collection', '203', 'introduction']);
    expect(component.collectionID()).toBe('203');
    expect(component.collSideMenuQueryParams()['position']).toBe('2');
    expect(component.showCollectionSideMenu()).toBeTrue();
    expect(component.showSideNav()).toBeTrue();
    expect(tocService.setCurrentCollectionToc).toHaveBeenCalledOnceWith('203');
    expect(element('#current-url').textContent).toContain(
      '/collection/203/introduction?position=2'
    );
    expect(element('#collection-id').textContent).toContain('203');
    expect(element('#query-position').textContent).toContain('2');
    expect(element('#collection-side-menu').classList).toContain('visible');
    expect(element('#side-nav').classList).toContain('visible');
  });

  it('mounts the main menu and clears collection state after leaving a collection', async () => {
    const component = await createComponent();

    navigationUrls.next('/collection/203/introduction');
    await fixture.whenStable();
    navigationUrls.next('/search?query=motiv');
    await fixture.whenStable();

    expect(component.collectionID()).toBe('');
    expect(component.showCollectionSideMenu()).toBeFalse();
    expect(component.mountMainSideMenu()).toBeTrue();
    expect(tocService.setCurrentCollectionToc.calls.allArgs()).toEqual([['203'], ['']]);
    expect(element('#collection-id').textContent?.trim()).toBe('');
    expect(element('#collection-side-menu').classList).not.toContain('visible');
    expect(element('#main-side-menu').classList).toContain('mounted');
    expect(headService.setLinks).toHaveBeenCalledWith('/search?query=motiv');
    expect(headService.setOpenGraphURLProperty)
      .toHaveBeenCalledWith('/search?query=motiv');
  });

  it('closes the mobile menu on path changes but not query-param changes', async () => {
    mobileMode = true;
    const component = await createComponent();

    navigationUrls.next('/search?query=motiv');
    await fixture.whenStable();
    component.toggleSideNav();
    await fixture.whenStable();
    expect(element('#side-nav').classList).toContain('visible');

    navigationUrls.next('/search?query=topelius');
    await fixture.whenStable();
    expect(component.showSideNav()).toBeTrue();
    expect(element('#side-nav').classList).toContain('visible');

    navigationUrls.next('/content');
    await fixture.whenStable();
    expect(component.showSideNav()).toBeFalse();
    expect(element('#side-nav').classList).not.toContain('visible');
  });

  it('updates the loading bar after its delay and cancels stale hide timers', async () => {
    const component = await createComponent();
    jasmine.clock().install();

    try {
      component.hideLoadingBar(true);
      jasmine.clock().tick(699);
      expect(component.loadingBarHidden()).toBeFalse();

      jasmine.clock().tick(1);
      await fixture.whenStable();
      expect(component.loadingBarHidden()).toBeTrue();
      expect(element('#loading-bar-hidden').textContent).toContain('true');

      component.hideLoadingBar(false);
      await fixture.whenStable();
      component.hideLoadingBar(true);
      component.hideLoadingBar(false);
      jasmine.clock().tick(700);
      await fixture.whenStable();

      expect(component.loadingBarHidden()).toBeFalse();
      expect(element('#loading-bar-hidden').textContent).toContain('false');
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
