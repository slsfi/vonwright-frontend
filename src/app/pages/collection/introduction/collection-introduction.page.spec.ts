import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { BehaviorSubject, Subject, of } from 'rxjs';

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
  let params$: BehaviorSubject<Params>;
  let queryParams$: BehaviorSubject<Params>;
  let firstIntroduction$: Subject<any>;
  let secondIntroduction$: Subject<any>;
  let tooltipResult$: Subject<string>;
  let collectionContentService: jasmine.SpyObj<CollectionContentService>;
  let parserService: jasmine.SpyObj<HtmlParserService>;
  let scrollService: jasmine.SpyObj<ScrollService>;
  let tooltipService: jasmine.SpyObj<TooltipService>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ collectionID: '203' });
    queryParams$ = new BehaviorSubject<Params>({});
    firstIntroduction$ = new Subject<any>();
    secondIntroduction$ = new Subject<any>();
    tooltipResult$ = new Subject<string>();
    collectionContentService = jasmine.createSpyObj<CollectionContentService>(
      'CollectionContentService',
      ['getIntroduction']
    );
    collectionContentService.getIntroduction.and.callFake(id =>
      id === '203' ? firstIntroduction$ : secondIntroduction$
    );
    parserService = jasmine.createSpyObj<HtmlParserService>(
      'HtmlParserService',
      ['getSearchMatchesFromQueryParams', 'insertSearchMatchTags']
    );
    parserService.getSearchMatchesFromQueryParams.and.callFake(query =>
      Array.isArray(query) ? query : [query]
    );
    parserService.insertSearchMatchTags.and.callFake(
      (text, matches) => `${text}|${(matches ?? []).join(',')}`
    );
    scrollService = jasmine.createSpyObj<ScrollService>(
      'ScrollService',
      ['scrollElementIntoView', 'scrollToFirstSearchMatch', 'scrollToHTMLElement']
    );
    tooltipService = jasmine.createSpyObj<TooltipService>(
      'TooltipService',
      ['getFootnoteTooltip', 'getSemanticDataObjectTooltip', 'getTooltipProperties']
    );
    tooltipService.getFootnoteTooltip.and.returnValue(of('Footnote'));
    tooltipService.getSemanticDataObjectTooltip.and.returnValue(tooltipResult$);
    tooltipService.getTooltipProperties.and.returnValue({
      left: '10px',
      maxWidth: '320px',
      scaleValue: 1,
      top: '20px'
    });

    const collectionsService = jasmine.createSpyObj<CollectionsService>(
      'CollectionsService',
      ['getCollectionAndPublicationByLegacyId', 'getLegacyIdByCollectionId']
    );
    collectionsService.getCollectionAndPublicationByLegacyId.and.returnValue(of([]));
    collectionsService.getLegacyIdByCollectionId.and.callFake(id =>
      of([{ legacy_id: `legacy-${id}` }])
    );
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

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
    const scrollToPos = spyOn<any>(component, 'scrollToPos');
    fixture.detectChanges();

    queryParams$.next({ position: 'section-2' });

    expect(collectionContentService.getIntroduction).toHaveBeenCalledTimes(1);
    expect(scrollToPos).toHaveBeenCalledOnceWith(100);
  });

  it('clears the search-match retry interval when the Ionic page leaves', async () => {
    queryParams$.next({ q: 'match' });
    scrollService.scrollToFirstSearchMatch.and.returnValue(101);
    const clearIntervalSpy = spyOn(window, 'clearInterval').and.callThrough();
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
