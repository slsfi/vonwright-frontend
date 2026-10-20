import type { MockedObject } from 'vitest';
import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { config } from '@config';
import { CollectionContentService } from '@services/collection-content.service';
import { CollectionsService } from '@services/collections.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import {
  BrowserRouteStateSourceService,
  RouteStateSourceService
} from '@services/route-state-source.service';
import { ScrollService } from '@services/scroll.service';
import { TooltipService } from '@services/tooltip.service';
import { ViewOptionsService } from '@services/view-options.service';
import { CollectionIntroductionPage } from './collection-introduction.page';

describe('CollectionIntroductionPage', () => {
  let originalViewOptions: typeof config.page.introduction.viewOptions;
  let params$: BehaviorSubject<Params>;
  let queryParams$: BehaviorSubject<Params>;
  let firstIntroduction$: Subject<any>;
  let secondIntroduction$: Subject<any>;
  let tooltipResult$: Subject<string>;
  let collectionContentService: MockedObject<Pick<CollectionContentService, 'getIntroduction'>>;
  let parserService: MockedObject<Pick<
    HtmlParserService,
    'getSearchMatchesFromQueryParams'
    | 'insertSearchMatchTags'
  >>;
  let scrollService: MockedObject<Pick<
    ScrollService,
    'scrollElementIntoView'
    | 'scrollToFirstSearchMatch'
    | 'scrollToHTMLElement'
  >>;
  let tooltipService: MockedObject<Pick<
    TooltipService,
    'getFootnoteTooltip'
    | 'getSemanticDataObjectTooltip'
    | 'getTooltipProperties'
  >>;

  beforeEach(async () => {
    originalViewOptions = config.page.introduction.viewOptions;
    params$ = new BehaviorSubject<Params>({ collectionID: '203' });
    queryParams$ = new BehaviorSubject<Params>({});
    firstIntroduction$ = new Subject<any>();
    secondIntroduction$ = new Subject<any>();
    tooltipResult$ = new Subject<string>();
    collectionContentService = {
      getIntroduction: vi.fn().mockName('CollectionContentService.getIntroduction')
    };
    collectionContentService.getIntroduction.mockImplementation(id =>
      id === '203' ? firstIntroduction$ : secondIntroduction$
    );
    parserService = {
      getSearchMatchesFromQueryParams: vi.fn().mockName('HtmlParserService.getSearchMatchesFromQueryParams'),
      insertSearchMatchTags: vi.fn().mockName('HtmlParserService.insertSearchMatchTags')
    };
    parserService.getSearchMatchesFromQueryParams.mockImplementation(query =>
      Array.isArray(query) ? query : [query]
    );
    parserService.insertSearchMatchTags.mockImplementation(
      (text, matches) => `${text}|${(matches ?? []).join(',')}`
    );
    scrollService = {
      scrollElementIntoView: vi.fn().mockName('ScrollService.scrollElementIntoView'),
      scrollToFirstSearchMatch: vi.fn().mockName('ScrollService.scrollToFirstSearchMatch'),
      scrollToHTMLElement: vi.fn().mockName('ScrollService.scrollToHTMLElement')
    };
    tooltipService = {
      getFootnoteTooltip: vi.fn().mockName('TooltipService.getFootnoteTooltip'),
      getSemanticDataObjectTooltip: vi.fn().mockName('TooltipService.getSemanticDataObjectTooltip'),
      getTooltipProperties: vi.fn().mockName('TooltipService.getTooltipProperties')
    };
    tooltipService.getFootnoteTooltip.mockReturnValue(of('Footnote'));
    tooltipService.getSemanticDataObjectTooltip.mockReturnValue(tooltipResult$);
    tooltipService.getTooltipProperties.mockReturnValue({
      left: '10px',
      maxWidth: '320px',
      scaleValue: 1,
      top: '20px'
    });

    const collectionsService: MockedObject<Pick<
      CollectionsService,
      'getCollectionAndPublicationByLegacyId'
      | 'getLegacyIdByCollectionId'
    >> = {
      getCollectionAndPublicationByLegacyId: vi.fn().mockName('CollectionsService.getCollectionAndPublicationByLegacyId'),
      getLegacyIdByCollectionId: vi.fn().mockName('CollectionsService.getLegacyIdByCollectionId')
    };
    collectionsService.getCollectionAndPublicationByLegacyId.mockReturnValue(of([]));
    collectionsService.getLegacyIdByCollectionId.mockImplementation(id =>
      of([{ legacy_id: `legacy-${id}` }])
    );
    const router: MockedObject<Pick<Router, 'navigate'>> = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [CollectionIntroductionPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: params$,
            queryParams: queryParams$,
            snapshot: { params: { collectionID: '203' }, queryParams: {} }
          }
        },
        { provide: CollectionContentService, useValue: collectionContentService },
        { provide: CollectionsService, useValue: collectionsService },
        { provide: HtmlParserService, useValue: parserService },
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: ModalController, useValue: {} },
        { provide: PlatformService, useValue: { isMobile: () => false } },
        { provide: PopoverController, useValue: {} },
        { provide: RouteStateSourceService, useClass: BrowserRouteStateSourceService },
        { provide: Router, useValue: router },
        { provide: ScrollService, useValue: scrollService },
        { provide: TooltipService, useValue: tooltipService },
        {
          provide: ViewOptionsService,
          useValue: {
            show: signal({ personInfo: true, placeInfo: true, workInfo: true }),
            textsize: signal('medium')
          }
        }
      ]
    })
      .overrideTemplate(
        CollectionIntroductionPage,
        `
          @let activeComponent = this.activeComponent();
          @let showSeparateIntroToc = this.showSeparateIntroToc();
          @let text = this.text();
          @let textLoading = this.textLoading();
          @let textMenu = this.textMenu();
          @let tocMenuOpen = this.tocMenuOpen();
          @let toolTipPosition = this.toolTipPosition();
          @let toolTipText = this.toolTipText();
          <span class="active">{{ activeComponent }}</span>
          <span class="loading">{{ textLoading }}</span>
          <span class="text">{{ text }}</span>
          <span class="toc">{{ showSeparateIntroToc }}|{{ tocMenuOpen }}|{{ textMenu }}</span>
          <span class="tooltip">{{ toolTipText }}|{{ toolTipPosition.top }}</span>
        `
      )
      .compileComponents();
  });

  afterEach(() => {
    config.page.introduction.viewOptions = originalViewOptions;
  });

  it.each([undefined, {}, { personInfo: true }])('offers paragraph numbering with omitted settings: %j', viewOptions => {
    config.page.introduction.viewOptions = viewOptions;
    const page = TestBed.createComponent(CollectionIntroductionPage).componentInstance;

    expect(page.viewOptionsTogglesIntro['paragraphNumbering']).toBe(true);
    expect(page.viewOptionsTogglesIntro['comments']).toBe(false);
  });

  it('preserves explicit introduction options while keeping reading-text-only options hidden', () => {
    config.page.introduction.viewOptions = { paragraphNumbering: false, personInfo: true, comments: true };
    const page = TestBed.createComponent(CollectionIntroductionPage).componentInstance;

    expect(page.viewOptionsTogglesIntro['paragraphNumbering']).toBe(false);
    expect(page.viewOptionsTogglesIntro['personInfo']).toBe(true);
    expect(page.viewOptionsTogglesIntro['comments']).toBe(false);
  });

  it('renders content and reloads a reused page while cancelling the stale request', async () => {
    const fixture = TestBed.createComponent(CollectionIntroductionPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading').textContent).toContain('true');
    firstIntroduction$.next({
      content: '<div data-id="content"><a>First TOC</a></div><p>First introduction</p>'
    });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.loading').textContent).toContain('false');
    expect(fixture.nativeElement.querySelector('.text').textContent).toContain('First introduction');
    expect(fixture.nativeElement.querySelector('.text').textContent).not.toContain('First TOC');
    expect(fixture.nativeElement.querySelector('.toc').textContent).toContain(
      'true|true|<a>First TOC</a>'
    );

    params$.next({ collectionID: '204' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.loading').textContent).toContain('true');
    expect(fixture.nativeElement.querySelector('.text').textContent.trim()).toBe('');

    firstIntroduction$.next({ content: '<p>Stale introduction</p>' });
    secondIntroduction$.next({ content: '<p>Second introduction</p>' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.text').textContent).toContain('Second introduction');
    expect(fixture.nativeElement.querySelector('.text').textContent).not.toContain('Stale introduction');
    expect(fixture.nativeElement.querySelector('.toc').textContent).toContain('false|false|');

    fixture.componentInstance.ionViewWillLeave();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.active').textContent).toContain('false');
  });

  it('handles a position-only route change without reloading the introduction', () => {
    const fixture = TestBed.createComponent(CollectionIntroductionPage);
    const component = fixture.componentInstance;
    const scrollToPos = vi.spyOn(component as unknown as { scrollToPos(timeout?: number): void }, 'scrollToPos').mockReturnValue(undefined);
    fixture.detectChanges();

    queryParams$.next({ position: 'section-2' });

    expect(collectionContentService.getIntroduction).toHaveBeenCalledTimes(1);
    expect(scrollToPos).toHaveBeenCalledTimes(1);
    expect(scrollToPos).toHaveBeenCalledWith(100);
  });

  it('clears the search-match retry interval when the Ionic page leaves', async () => {
    queryParams$.next({ q: 'match' });
    scrollService.scrollToFirstSearchMatch.mockReturnValue(101);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const fixture = TestBed.createComponent(CollectionIntroductionPage);
    fixture.detectChanges();

    firstIntroduction$.next({ content: '<p>Introduction</p>' });
    await fixture.whenStable();

    expect((fixture.componentInstance as any).intervalTimerId).toBe(101);

    fixture.componentInstance.ionViewWillLeave();

    expect(clearIntervalSpy).toHaveBeenCalledWith(101);
    expect((fixture.componentInstance as any).intervalTimerId).toBeUndefined();
  });

  it('renders an asynchronously loaded tooltip without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(CollectionIntroductionPage);
    fixture.detectChanges();
    const target = document.createElement('span');

    fixture.componentInstance.showSemanticDataObjectTooltip('42', 'person', target);
    tooltipResult$.next('Tooltip content');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.tooltip').textContent).toContain(
      'Tooltip content|20px'
    );
  });
});
