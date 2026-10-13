import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { clearTranslations, loadTranslations } from '@angular/localize';
import { provideRouter, UrlSegment } from '@angular/router';
import { of } from 'rxjs';

import { config } from '@config';
import { MdMenuNodeApiResponse } from '@models/menu.models';
import { AUTH_ENABLED } from '@tokens/auth.tokens';
import { CollectionsService } from '@services/collections.service';
import { DocumentHeadService } from '@services/document-head.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { MainSideMenuComponent } from './main-side-menu.component';

describe('MainSideMenuComponent', () => {
  let originalMenuItems: Record<string, boolean>;
  let originalUngroupIndices: boolean | undefined;
  let originalDefaultExpanded: boolean | undefined;

  beforeEach(async () => {
    clearTranslations();
    // Cover every message used by these fixtures before overriding individual labels.
    loadTranslations({
      'MainSideMenu.Account': 'Användarkonto',
      'MainSideMenu.AriaLabel': 'Sekundär meny',
      'MainSideMenu.Articles': 'Artiklar',
      'MainSideMenu.Home': 'Hem',
      'MainSideMenu.IndexKeywords': 'Ämnesord',
      'MainSideMenu.IndexPersons': 'Personregister',
      'MainSideMenu.IndexPlaces': 'Ortregister',
      'MainSideMenu.IndexWorks': 'Verkregister',
      'MainSideMenu.Indices': 'Register',
      'MainSideMenu.Login': 'Logga in',
      'MainSideMenu.Search': 'Sök i utgåvan',
      'MainSideMenu.TermsOfUse': 'Användarvillkor'
    });
    originalMenuItems = { ...config.component!.mainSideMenu!.items };
    originalUngroupIndices = config.component!.mainSideMenu!.ungroupIndices;
    originalDefaultExpanded = config.component!.mainSideMenu!.defaultExpanded;
    config.component!.mainSideMenu!.ungroupIndices = false;
    config.component!.mainSideMenu!.defaultExpanded = false;
    config.component!.mainSideMenu!.items = {
      indexPersons: true,
      search: true
    };

    await TestBed.configureTestingModule({
      imports: [MainSideMenuComponent],
      providers: [
        provideRouter([]),
        { provide: AUTH_ENABLED, useValue: false },
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: CollectionsService, useValue: { getCollections: () => of([]) } },
        { provide: DocumentHeadService, useValue: { setTitle: vi.fn().mockName('setTitle') } },
        { provide: MarkdownService, useValue: { getMenuTree: () => of(null) } },
        { provide: MediaCollectionService, useValue: { getMediaCollections: () => of([]) } }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    clearTranslations();
    config.component!.mainSideMenu!.items = originalMenuItems;
    config.component!.mainSideMenu!.ungroupIndices = originalUngroupIndices;
    config.component!.mainSideMenu!.defaultExpanded = originalDefaultExpanded;
  });

  describe('article menu', () => {
    let originalArticles: typeof config.articles;
    let originalUngroupArticles: boolean | undefined;

    beforeEach(() => {
      originalArticles = config.articles;
      originalUngroupArticles = config.component!.mainSideMenu!.ungroupArticles;
      config.component!.mainSideMenu!.ungroupArticles = false;
      config.component!.mainSideMenu!.items = { articles: true };
      config.articles = [
        { id: '04-01', language: 'sv', routeName: 'first-article', title: 'Configured article title' },
        { id: '04-02-01', language: 'sv', routeName: 'second-article' }
      ];

      const articleTree: MdMenuNodeApiResponse = {
        basename: '04', fullpath: '', id: '04', path: '', route: '', type: 'directory',
        title: 'Backend article root title',
        children: [
          {
            basename: '01', fullpath: '', id: '04-01', path: '', route: '', type: 'file',
            title: 'Backend first article title'
          },
          {
            basename: '02', fullpath: '', id: '04-02', path: '', route: '', type: 'directory',
            title: 'Backend nested group title',
            children: [{
              basename: '01', fullpath: '', id: '04-02-01', path: '', route: '', type: 'file',
              title: 'Backend second article title'
            }]
          }
        ]
      };
      vi.spyOn(TestBed.inject(MarkdownService), 'getMenuTree').mockReturnValue(of(articleTree));
    });

    afterEach(() => {
      config.articles = originalArticles;
      config.component!.mainSideMenu!.ungroupArticles = originalUngroupArticles;
    });

    it.each([false, undefined])('uses the app label for the article wrapper when ungroupArticles is %s', async (setting) => {
      config.component!.mainSideMenu!.ungroupArticles = setting;
      const fixture = TestBed.createComponent(MainSideMenuComponent);
      await fixture.whenStable();

      const group = fixture.componentInstance.mainMenu().find(item => item.menuType === 'article')!;
      expect(group.title).toBe('Artiklar');
      expect(group.children?.map(item => item.title))
        .toEqual(['Configured article title', 'Backend nested group title']);
      expect(group.children?.[1].children?.[0].title).toBe('Backend second article title');
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('button.submenu-label')?.textContent?.trim()).toBe('Artiklar');
      expect(Array.from(element.querySelectorAll('a[href^="/article/"]'), link => link.getAttribute('href')))
        .toEqual(['/article/first-article', '/article/second-article']);
      expect(TestBed.inject(MarkdownService).getMenuTree).toHaveBeenCalledWith('sv', '04');
    });

    it.each(['Articles', 'Artikkelit'])('uses the translated article wrapper label %s', async (label) => {
      const warn = vi.spyOn(console, 'warn');
      loadTranslations({ 'MainSideMenu.Articles': label });
      const fixture = TestBed.createComponent(MainSideMenuComponent);
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('button.submenu-label').textContent.trim()).toBe(label);
      expect(warn).not.toHaveBeenCalled();
    });

    it('keeps article entries at the root when ungroupArticles is true', async () => {
      config.component!.mainSideMenu!.ungroupArticles = true;
      const fixture = TestBed.createComponent(MainSideMenuComponent);
      await fixture.whenStable();

      expect(fixture.componentInstance.mainMenu().map(item => item.title))
        .toEqual(['Hem', 'Configured article title', 'Backend nested group title']);
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('button.submenu-label')?.textContent?.trim()).toBe('Backend nested group title');
      expect(Array.from(element.querySelectorAll('a[href^="/article/"]'), link => link.getAttribute('href')))
        .toEqual(['/article/first-article', '/article/second-article']);
    });

    it('expands the article wrapper and retains the article title on navigation', async () => {
      const fixture = TestBed.createComponent(MainSideMenuComponent);
      fixture.componentRef.setInput('urlSegments', [
        new UrlSegment('article', {}),
        new UrlSegment('first-article', {})
      ]);
      await fixture.whenStable();

      const group = fixture.componentInstance.mainMenu().find(item => item.menuType === 'article')!;
      expect(fixture.componentInstance.expandedMenuIds()).toContain(group.nodeId);
      expect(fixture.componentInstance.highlightedNodeId()).toBe(group.children?.[0].nodeId);
      expect(fixture.nativeElement.querySelector('a.menu-highlight').getAttribute('href')).toBe('/article/first-article');
      expect(TestBed.inject(DocumentHeadService).setTitle).toHaveBeenCalledWith(['Configured article title']);
    });
  });

  it.each([false, undefined])('groups multiple indices when ungroupIndices is %s', async (setting) => {
    if (setting === undefined) {
      delete config.component!.mainSideMenu!.ungroupIndices;
    } else {
      config.component!.mainSideMenu!.ungroupIndices = setting;
    }
    config.component!.mainSideMenu!.items = {
      indexWorks: true,
      search: true,
      indexPersons: true,
      indexPlaces: true,
      indexKeywords: true,
      termsOfUse: true
    };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;

    expect(component.mainMenu().map(item => item.menuType))
      .toEqual(['home', 'indices', 'search', 'terms']);
    const group = component.primaryMenu().find(item => item.menuType === 'indices')!;
    expect(group.title).toBe('Register');
    expect(group.parentPath).toBeUndefined();
    expect(group.children?.map(item => item.parentPath))
      .toEqual(['/index/works', '/index/persons', '/index/places', '/index/keywords']);
    expect(group.children?.map(item => item.menuType))
      .toEqual(['works', 'persons', 'places', 'keywords']);
    expect(new Set(group.children?.map(item => item.nodeId)).size).toBe(4);
    expect(component.secondaryMenu().map(item => item.menuType)).toEqual(['terms']);

    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('button.submenu-label')!;
    const groupElement = button.closest('li')!;
    expect(button.textContent?.trim()).toBe('Register');
    expect(groupElement.getAttribute('aria-expanded')).toBe('false');
    expect(Array.from(groupElement.querySelectorAll('a'), link => link.getAttribute('href')))
      .toEqual(['/index/works', '/index/persons', '/index/places', '/index/keywords']);

    button.click();
    await fixture.whenStable();
    expect(groupElement.getAttribute('aria-expanded')).toBe('true');
    expect(groupElement.querySelector('ul')?.classList.contains('open')).toBe(true);
  });

  it('keeps multiple indices as separate links when ungroupIndices is true', async () => {
    config.component!.mainSideMenu!.ungroupIndices = true;
    config.component!.mainSideMenu!.items = {
      indexPersons: true,
      indexKeywords: false,
      search: true,
      indexPlaces: true
    };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.mainMenu().map(item => item.parentPath))
      .toEqual(['/', '/index/persons', '/index/places', '/search']);
    expect(fixture.nativeElement.querySelector('button.submenu-label')).toBeNull();
  });

  it('does not create a group when all indices are disabled', async () => {
    config.component!.mainSideMenu!.items = {
      indexPersons: false,
      indexPlaces: false,
      indexKeywords: false,
      indexWorks: false
    };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.mainMenu().map(item => item.menuType))
      .toEqual(['home']);
    expect(fixture.nativeElement.querySelector('button.submenu-label')).toBeNull();
  });

  it.each([false, undefined])('groups a single index when ungroupIndices is %s', async (setting) => {
    config.component!.mainSideMenu!.ungroupIndices = setting;
    config.component!.mainSideMenu!.items = { indexPersons: true, indexPlaces: false };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.mainMenu().map(item => item.menuType)).toEqual(['home', 'indices']);
    const group = fixture.componentInstance.mainMenu().find(item => item.menuType === 'indices')!;
    expect(group.title).toBe('Register');
    expect(group.children?.map(item => item.parentPath)).toEqual(['/index/persons']);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('button.submenu-label')?.textContent?.trim()).toBe('Register');
    expect(element.querySelector('li[aria-haspopup="menu"] a')?.getAttribute('href')).toBe('/index/persons');
  });

  it('keeps a single index as a direct link when ungroupIndices is true', async () => {
    config.component!.mainSideMenu!.ungroupIndices = true;
    config.component!.mainSideMenu!.items = { indexPersons: true };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.mainMenu().map(item => item.parentPath)).toEqual(['/', '/index/persons']);
    expect(fixture.nativeElement.querySelector('button.submenu-label')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/index/persons"]')).not.toBeNull();
  });

  it.each([false, true])('positions the index block at the first enabled index when ungroupIndices is %s', async (setting) => {
    config.component!.mainSideMenu!.ungroupIndices = setting;
    config.component!.mainSideMenu!.items = {
      indexKeywords: false,
      search: true,
      indexPlaces: true,
      indexPersons: true
    };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.mainMenu().map(item => item.parentPath))
      .toEqual(setting ? ['/', '/search', '/index/places', '/index/persons'] : ['/', '/search', undefined]);
    const element: HTMLElement = fixture.nativeElement;
    expect(Array.from(element.querySelectorAll('a[href^="/index/"]'), link => link.getAttribute('href')))
      .toEqual(['/index/places', '/index/persons']);
  });

  it('honours defaultExpanded for the index group', async () => {
    config.component!.mainSideMenu!.defaultExpanded = true;
    config.component!.mainSideMenu!.items = { indexPersons: true, indexPlaces: true };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    const group = fixture.componentInstance.mainMenu().find(item => item.menuType === 'indices')!;
    expect(fixture.componentInstance.expandedMenuIds()).toContain(group.nodeId);
    expect(fixture.nativeElement.querySelector('li[aria-haspopup="menu"]').getAttribute('aria-expanded'))
      .toBe('true');
  });

  it('expands the group and highlights the active index on navigation', async () => {
    config.component!.mainSideMenu!.items = { indexPersons: true, indexPlaces: true };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();
    fixture.componentRef.setInput('urlSegments', [
      new UrlSegment('index', {}),
      new UrlSegment('places', {})
    ]);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const group = component.mainMenu().find(item => item.menuType === 'indices')!;
    const places = group.children!.find(item => item.menuType === 'places')!;

    expect(component.expandedMenuIds()).toContain(group.nodeId);
    expect(component.highlightedNodeId()).toBe(places.nodeId);
    expect(fixture.nativeElement.querySelector('a.menu-highlight').getAttribute('href')).toBe('/index/places');
    expect(TestBed.inject(DocumentHeadService).setTitle).toHaveBeenCalledWith(['Ortregister']);
  });

  it.each(['Indices', 'Hakemistot'])('uses the translated group label %s', async (label) => {
    const warn = vi.spyOn(console, 'warn');
    loadTranslations({ 'MainSideMenu.Indices': label });
    config.component!.mainSideMenu!.items = { indexPersons: true, indexPlaces: true };
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('button.submenu-label').textContent.trim()).toBe(label);
    expect(warn).not.toHaveBeenCalled();
  });

  it('updates the highlighted item when navigation changes', async () => {
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('urlSegments', [new UrlSegment('search', {})]);
    await fixture.whenStable();

    const searchItem = component.mainMenu().find(item => item.menuType === 'search');
    expect(searchItem).toBeDefined();
    expect(component.highlightedNodeId()).toBe(searchItem!.nodeId as string);

    fixture.componentRef.setInput('urlSegments', [
      new UrlSegment('index', {}),
      new UrlSegment('persons', {})
    ]);
    await fixture.whenStable();

    const group = component.mainMenu().find(item => item.menuType === 'indices');
    const personsItem = group?.children?.find(item => item.menuType === 'persons');
    expect(personsItem).toBeDefined();
    expect(component.highlightedNodeId()).toBe(personsItem!.nodeId as string);
    expect(component.expandedMenuIds()).toContain(group!.nodeId);
  });
});
