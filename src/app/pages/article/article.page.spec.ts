import type { MockedObject } from 'vitest';
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
  let routeFragment$: BehaviorSubject<string | null>;
  let route: Partial<ActivatedRoute>;
  let router: MockedObject<Pick<Router, 'navigate'>>;
  let markdownService: MockedObject<Pick<MarkdownService, 'getParsedMdContent'>>;

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
    },
    {
      id: '04-02',
      language: 'en',
      routeName: 'another-article',
      title: 'Another article',
      enableTOC: true,
      downloadOptions: []
    }
  ];

  beforeEach(async () => {
    originalArticles = config.articles ?? [];
    config.articles = translatedArticles;
    routeParams$ = new BehaviorSubject<Params>({ name: 'about-tove-jansson' });
    routeFragment$ = new BehaviorSubject<string | null>(null);
    route = {
      params: routeParams$.asObservable(),
      fragment: routeFragment$.asObservable()
    };
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);
    markdownService = {
      getParsedMdContent: vi.fn().mockName('MarkdownService.getParsedMdContent')
    };
    markdownService.getParsedMdContent.mockImplementation(
      (fileId: string) => of(`<p>${fileId}</p>`)
    );

    await TestBed.configureTestingModule({
      imports: [ArticlePage],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: LOCALE_ID, useValue: 'en' },
        { provide: MarkdownService, useValue: markdownService },
        { provide: ModalController, useValue: {} },
        { provide: PlatformService, useValue: { isMobile: () => false } },
        { provide: PopoverController, useValue: {} },
        { provide: Router, useValue: router },
        { provide: ScrollService, useValue: { scrollElementIntoView: vi.fn().mockName('scrollElementIntoView') } }
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

    expect(component.article()?.id).toBe('04-01');
    expect(component.article()?.language).toBe('en');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(markdownService.getParsedMdContent).toHaveBeenCalledTimes(1);
    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith(
      'en-04-01',
      expect.any(String)
    );
    expect(values).toEqual(['<p>en-04-01</p>']);

    subscription.unsubscribe();
  });

  it('redirects to the active-locale route when the route name belongs to another locale', () => {
    routeParams$.next({ name: 'om-tove-jansson' });
    const fixture = TestBed.createComponent(ArticlePage);
    const component = fixture.componentInstance;
    const values: Array<string | null> = [];

    fixture.detectChanges();
    const subscription = component.markdownText$.subscribe(value => values.push(value));

    expect(component.article()?.id).toBe('04-01');
    expect(component.article()?.language).toBe('en');
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['..', 'about-tove-jansson'], {
      relativeTo: route as ActivatedRoute,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
      replaceUrl: true
    });
    expect(markdownService.getParsedMdContent).not.toHaveBeenCalled();
    expect(values).toEqual([null]);

    subscription.unsubscribe();
  });

  it('updates article state when the route changes on the reused component', () => {
    const fixture = TestBed.createComponent(ArticlePage);
    const component = fixture.componentInstance;
    const values: Array<string | null> = [];

    fixture.detectChanges();
    const subscription = component.markdownText$.subscribe(value => values.push(value));
    routeParams$.next({ name: 'another-article' });

    expect(component.article()?.id).toBe('04-02');
    expect(component.enableTOC()).toBe(true);
    expect(component.tocMenuOpen()).toBe(true);
    expect(values).toEqual(['<p>en-04-01</p>', '<p>en-04-02</p>']);

    subscription.unsubscribe();
  });

  it('removes its click listener and pending scroll retry when destroyed', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const fixture = TestBed.createComponent(ArticlePage);
    fixture.detectChanges();
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#section');
    fixture.nativeElement.appendChild(anchor);
    const dispatchFragmentClick = () => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();
      anchor.dispatchEvent(event);
    };

    dispatchFragmentClick();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ fragment: 'section' }));

    router.navigate.mockClear();
    routeFragment$.next('missing-section');
    fixture.destroy();
    dispatchFragmentClick();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
