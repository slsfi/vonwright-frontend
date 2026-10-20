import type { MockedObject } from 'vitest';
import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { CollectionContentService } from '@services/collection-content.service';
import { CollectionTextViewsQueryParamSyncService } from '@services/collection-text-views-query-param-sync.service';
import { CollectionsService } from '@services/collections.service';
import { DocumentHeadService } from '@services/document-head.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import {
  BrowserRouteStateSourceService,
  RouteStateSourceService
} from '@services/route-state-source.service';
import { ScrollService } from '@services/scroll.service';
import { TooltipService } from '@services/tooltip.service';
import { ViewOptionsService } from '@services/view-options.service';
import { CollectionTextPage } from './collection-text.page';

describe('CollectionTextPage', () => {
  let params$: BehaviorSubject<Params>;
  let queryParams$: BehaviorSubject<Params>;
  let mobileMode: boolean;
  let tooltipResult$: Subject<string>;
  let collectionsService: MockedObject<Pick<
    CollectionsService,
    'getCollectionAndPublicationByLegacyId'
    | 'getLegacyIdByPublicationId'
  >>;
  let parserService: MockedObject<Pick<HtmlParserService, 'getSearchMatchesFromQueryParams'>>;
  let tooltipService: MockedObject<Pick<
    TooltipService,
    'getCommentTooltip'
    | 'getFootnoteTooltip'
    | 'getSemanticDataObjectTooltip'
    | 'getTooltipProperties'
  >>;
  let viewsQueryParamSync: MockedObject<Pick<CollectionTextViewsQueryParamSyncService, 'update'>>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({
      collectionID: '203',
      publicationID: '20217',
      chapterID: 'ch1'
    });
    queryParams$ = new BehaviorSubject<Params>({ q: 'first-match' });
    mobileMode = false;
    tooltipResult$ = new Subject<string>();

    collectionsService = {
      getCollectionAndPublicationByLegacyId: vi.fn().mockName('CollectionsService.getCollectionAndPublicationByLegacyId'),
      getLegacyIdByPublicationId: vi.fn().mockName('CollectionsService.getLegacyIdByPublicationId')
    };
    collectionsService.getCollectionAndPublicationByLegacyId.mockReturnValue(of([]));
    collectionsService.getLegacyIdByPublicationId.mockImplementation(publicationID =>
      of([{ legacy_id: `legacy-${publicationID}` }])
    );

    parserService = {
      getSearchMatchesFromQueryParams: vi.fn().mockName('HtmlParserService.getSearchMatchesFromQueryParams')
    };
    parserService.getSearchMatchesFromQueryParams.mockImplementation(query =>
      Array.isArray(query) ? query : [query]
    );

    tooltipService = {
      getCommentTooltip: vi.fn().mockName('TooltipService.getCommentTooltip'),
      getFootnoteTooltip: vi.fn().mockName('TooltipService.getFootnoteTooltip'),
      getSemanticDataObjectTooltip: vi.fn().mockName('TooltipService.getSemanticDataObjectTooltip'),
      getTooltipProperties: vi.fn().mockName('TooltipService.getTooltipProperties')
    };
    tooltipService.getSemanticDataObjectTooltip.mockReturnValue(tooltipResult$);
    tooltipService.getTooltipProperties.mockReturnValue({
      left: '12px',
      maxWidth: '320px',
      scaleValue: 1,
      top: '24px'
    });

    viewsQueryParamSync = {
      update: vi.fn().mockName('CollectionTextViewsQueryParamSyncService.update')
    };

    const collectionContentService = {
      activeCollectionTextMobileModeView: undefined,
      previousReadViewTextId: '',
      readViewTextId: '',
      recentCollectionTextViews: []
    };
    const scrollService: MockedObject<Pick<
      ScrollService,
      'findElementInColumnByAttribute'
      | 'scrollElementIntoView'
      | 'scrollLastViewIntoView'
      | 'scrollToComment'
      | 'scrollToCommentLemma'
      | 'scrollToHTMLElement'
      | 'scrollToVariant'
    >> = {
      findElementInColumnByAttribute: vi.fn().mockName('ScrollService.findElementInColumnByAttribute'),
      scrollElementIntoView: vi.fn().mockName('ScrollService.scrollElementIntoView'),
      scrollLastViewIntoView: vi.fn().mockName('ScrollService.scrollLastViewIntoView'),
      scrollToComment: vi.fn().mockName('ScrollService.scrollToComment'),
      scrollToCommentLemma: vi.fn().mockName('ScrollService.scrollToCommentLemma'),
      scrollToHTMLElement: vi.fn().mockName('ScrollService.scrollToHTMLElement'),
      scrollToVariant: vi.fn().mockName('ScrollService.scrollToVariant')
    };

    await TestBed.configureTestingModule({
      imports: [CollectionTextPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: params$,
            queryParams: queryParams$,
            snapshot: {
              params: params$.value,
              queryParams: queryParams$.value
            }
          }
        },
        { provide: CollectionContentService, useValue: collectionContentService },
        { provide: CollectionsService, useValue: collectionsService },
        { provide: CollectionTextViewsQueryParamSyncService, useValue: viewsQueryParamSync },
        {
          provide: DocumentHeadService,
          useValue: { getCurrentPageTitle: () => of('Collection text') }
        },
        { provide: HtmlParserService, useValue: parserService },
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: ModalController, useValue: {} },
        { provide: PlatformService, useValue: { isMobile: () => mobileMode } },
        { provide: PopoverController, useValue: {} },
        { provide: RouteStateSourceService, useClass: BrowserRouteStateSourceService },
        { provide: ScrollService, useValue: scrollService },
        { provide: TooltipService, useValue: tooltipService },
        {
          provide: ViewOptionsService,
          useValue: {
            selectedVariationType: signal('all'),
            show: signal({
              abbreviations: true,
              comments: true,
              emendations: true,
              normalisations: true,
              personInfo: true,
              placeInfo: true,
              workInfo: true
            }),
            textsize: signal('medium')
          }
        }
      ]
    })
      .overrideTemplate(
        CollectionTextPage,
        `
          @let activeComponent = this.activeComponent();
          @let activeMobileModeViewIndex = this.activeMobileModeViewIndex();
          @let searchMatches = this.searchMatches();
          @let textKey = this.textKey();
          @let toolTipPosition = this.toolTipPosition();
          @let toolTipText = this.toolTipText();
          @let views = this.views();
          <span class="active">{{ activeComponent }}</span>
          <span class="mobile">{{ mobileMode }}|{{ activeMobileModeViewIndex }}</span>
          <span class="key">{{ textKey.collectionID }}|{{ textKey.publicationID }}|{{ textKey.chapterID }}|{{ textKey.textItemID }}</span>
          <span class="matches">{{ searchMatches.join(',') }}</span>
          <span class="views">@for (view of views; track view.uid) { {{ view.type }}:{{ view.uid }}; }</span>
          <span class="tooltip">{{ toolTipText }}|{{ toolTipPosition.top }}</span>
        `
      )
      .compileComponents();
  });

  it('renders route state and refreshes a cached page only after it re-enters', async () => {
    const fixture = TestBed.createComponent(CollectionTextPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.key').textContent).toContain(
      '203|20217|ch1|203_20217_ch1'
    );
    expect(fixture.nativeElement.querySelector('.matches').textContent).toContain('first-match');
    expect(fixture.nativeElement.querySelector('.views').textContent).toContain('readingtext:');
    expect(collectionsService.getLegacyIdByPublicationId).toHaveBeenCalledTimes(1);
    expect(collectionsService.getLegacyIdByPublicationId).toHaveBeenCalledWith('20217');

    fixture.componentInstance.ionViewWillLeave();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.active').textContent).toContain('false');

    params$.next({ collectionID: '204', publicationID: '20322' });
    queryParams$.next({ q: 'second-match' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.key').textContent).toContain(
      '203|20217|ch1|203_20217_ch1'
    );

    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.key').textContent).toContain(
      '204|20322||204_20322'
    );
    expect(fixture.nativeElement.querySelector('.matches').textContent).toContain('second-match');
  });

  it('renders asynchronous tooltip results without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(CollectionTextPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const target = document.createElement('span');
    (fixture.componentInstance as any).showSemanticDataObjectTooltip(
      '42',
      'person',
      target
    );
    tooltipResult$.next('Tooltip content');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.tooltip').textContent).toContain(
      'Tooltip content|24px'
    );
  });

  it('renders added, reordered, and removed view combinations from signal state', async () => {
    const fixture = TestBed.createComponent(CollectionTextPage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.addView('variants');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.views').textContent).toContain('variants:');

    const variantsIndex = fixture.componentInstance.views().findIndex(
      view => view.type === 'variants'
    );
    fixture.componentInstance.moveViewLeft(variantsIndex);
    await fixture.whenStable();
    expect(fixture.componentInstance.views()[variantsIndex - 1].type).toBe('variants');

    fixture.componentInstance.removeView(variantsIndex - 1);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.views').textContent).not.toContain('variants:');
    expect(viewsQueryParamSync.update).toHaveBeenCalled();
  });

  it('updates the active mobile view through signal state', async () => {
    mobileMode = true;
    const fixture = TestBed.createComponent(CollectionTextPage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.setActiveMobileModeViewType(undefined, 'comments');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.mobile').textContent).toContain('true|1');
  });
});
