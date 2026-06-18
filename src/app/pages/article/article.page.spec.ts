import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';

import { config } from '@config';
import { Article } from '@models/article.models';
import { MarkdownService } from '@services/markdown.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ArticlePage } from './article.page';

describe('ArticlePage', () => {
  let originalArticles: Article[];
  let routeParams$: BehaviorSubject<Params>;
  let route: Partial<ActivatedRoute>;
  let router: jasmine.SpyObj<Pick<Router, 'navigate'>>;
  let markdownService: jasmine.SpyObj<Pick<MarkdownService, 'getParsedMdContent'>>;

  const translatedArticles: Article[] = [
    {
      id: '04-01',
      language: 'sv',
      routeName: 'om-tove-jansson',
      title: 'Om Tove Jansson',
      enableTOC: false,
      downloadOptions: []
    },
    {
      id: '04-01',
      language: 'en',
      routeName: 'about-tove-jansson',
      title: 'About Tove Jansson',
      enableTOC: false,
      downloadOptions: []
    }
  ];

  beforeEach(async () => {
    originalArticles = config.articles ?? [];
    config.articles = translatedArticles;
    routeParams$ = new BehaviorSubject<Params>({ name: 'about-tove-jansson' });
    route = {
      params: routeParams$.asObservable(),
      fragment: of(null)
    };
    router = jasmine.createSpyObj<Pick<Router, 'navigate'>>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    markdownService = jasmine.createSpyObj<Pick<MarkdownService, 'getParsedMdContent'>>(
      'MarkdownService',
      ['getParsedMdContent']
    );
    markdownService.getParsedMdContent.and.returnValue(of('<p>Article</p>'));

    await TestBed.configureTestingModule({
      declarations: [ArticlePage],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: LOCALE_ID, useValue: 'en' },
        { provide: MarkdownService, useValue: markdownService },
        { provide: ModalController, useValue: {} },
        { provide: PlatformService, useValue: { isMobile: () => false } },
        { provide: PopoverController, useValue: {} },
        { provide: Router, useValue: router },
        { provide: ScrollService, useValue: { scrollElementIntoView: jasmine.createSpy('scrollElementIntoView') } }
      ]
    })
      .overrideTemplate(ArticlePage, '')
      .compileComponents();
  });

  afterEach(() => {
    config.articles = originalArticles;
  });

  it('loads the article when the route name matches the active locale', () => {
    const fixture = TestBed.createComponent(ArticlePage);
    const component = fixture.componentInstance;
    const values: Array<string | null> = [];

    fixture.detectChanges();
    const subscription = component.markdownText$.subscribe(value => values.push(value));

    expect(component.article?.id).toBe('04-01');
    expect(component.article?.language).toBe('en');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(markdownService.getParsedMdContent).toHaveBeenCalledOnceWith(
      'en-04-01',
      jasmine.any(String)
    );
    expect(values).toEqual(['<p>Article</p>']);

    subscription.unsubscribe();
  });

  it('redirects to the active-locale route when the route name belongs to another locale', () => {
    routeParams$.next({ name: 'om-tove-jansson' });
    const fixture = TestBed.createComponent(ArticlePage);
    const component = fixture.componentInstance;
    const values: Array<string | null> = [];

    fixture.detectChanges();
    const subscription = component.markdownText$.subscribe(value => values.push(value));

    expect(component.article?.id).toBe('04-01');
    expect(component.article?.language).toBe('en');
    expect(router.navigate).toHaveBeenCalledOnceWith(['..', 'about-tove-jansson'], {
      relativeTo: route as ActivatedRoute,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
      replaceUrl: true
    });
    expect(markdownService.getParsedMdContent).not.toHaveBeenCalled();
    expect(values).toEqual([null]);

    subscription.unsubscribe();
  });
});
