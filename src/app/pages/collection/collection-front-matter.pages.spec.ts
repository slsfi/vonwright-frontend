import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';

import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { MarkdownService } from '@services/markdown.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';
import { CollectionCoverPage } from './cover/collection-cover.page';
import { CollectionForewordPage } from './foreword/collection-foreword.page';
import { CollectionTitlePage } from './title/collection-title.page';

describe('Collection front-matter pages', () => {
  describe('CollectionCoverPage', () => {
    let params$: BehaviorSubject<Params>;
    let firstCover$: Subject<string>;
    let secondCover$: Subject<string>;
    let markdownService: jasmine.SpyObj<MarkdownService>;

    beforeEach(async () => {
      params$ = new BehaviorSubject<Params>({ collectionID: '203' });
      firstCover$ = new Subject<string>();
      secondCover$ = new Subject<string>();
      markdownService = jasmine.createSpyObj<MarkdownService>('MarkdownService', ['getMdContent']);
      markdownService.getMdContent.and.callFake(fileID =>
        fileID.endsWith('-203') ? firstCover$ : secondCover$
      );

      await TestBed.configureTestingModule({
        imports: [CollectionCoverPage],
        providers: [
          { provide: ActivatedRoute, useValue: { params: params$ } },
          { provide: LOCALE_ID, useValue: 'sv' },
          { provide: MarkdownService, useValue: markdownService },
          { provide: PlatformService, useValue: { isMobile: () => false } }
        ]
      })
        .overrideTemplate(
          CollectionCoverPage,
          `
            @let activeComponent = this.activeComponent();
            <span class="active">{{ activeComponent }}</span>
            @if ((coverData$ | async); as coverData) {
              <span class="cover">{{ coverData.image_src }}|{{ coverData.image_alt }}</span>
            }
          `
        )
        .compileComponents();
    });

    it('renders lifecycle and route-reuse updates without a manual change-detection pass', async () => {
      const fixture = TestBed.createComponent(CollectionCoverPage);
      fixture.detectChanges();

      firstCover$.next('![First cover](assets/first.jpg)');
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.cover').textContent).toContain(
        'assets/first.jpg|First cover'
      );

      fixture.componentInstance.ionViewWillLeave();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.active').textContent).toContain('false');

      params$.next({ collectionID: '204' });
      expect(markdownService.getMdContent).toHaveBeenCalledTimes(1);
      fixture.componentInstance.ionViewWillEnter();
      await fixture.whenStable();
      secondCover$.next('![Second cover](assets/second.jpg)');
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.cover').textContent).toContain(
        'assets/second.jpg|Second cover'
      );
    });
  });

  describe('CollectionTitlePage', () => {
    let params$: BehaviorSubject<Params>;
    let queryParams$: BehaviorSubject<Params>;
    let firstTitle$: Subject<any>;
    let secondTitle$: Subject<any>;
    let collectionContentService: jasmine.SpyObj<CollectionContentService>;
    let parserService: jasmine.SpyObj<HtmlParserService>;
    let scrollService: jasmine.SpyObj<ScrollService>;

    beforeEach(async () => {
      params$ = new BehaviorSubject<Params>({ collectionID: '203' });
      queryParams$ = new BehaviorSubject<Params>({ q: 'match' });
      firstTitle$ = new Subject<any>();
      secondTitle$ = new Subject<any>();
      collectionContentService = jasmine.createSpyObj<CollectionContentService>(
        'CollectionContentService',
        ['getTitle']
      );
      collectionContentService.getTitle.and.callFake(id =>
        id === '203' ? firstTitle$ : secondTitle$
      );
      parserService = jasmine.createSpyObj<HtmlParserService>(
        'HtmlParserService',
        ['getSearchMatchesFromQueryParams', 'insertSearchMatchTags']
      );
      parserService.getSearchMatchesFromQueryParams.and.returnValue(['match']);
      parserService.insertSearchMatchTags.and.callFake(
        (text, matches) => `${text}|${(matches ?? []).join(',')}`
      );
      scrollService = jasmine.createSpyObj<ScrollService>(
        'ScrollService',
        ['scrollToFirstSearchMatch']
      );
      scrollService.scrollToFirstSearchMatch.and.returnValues(101, 102);

      await TestBed.configureTestingModule({
        imports: [CollectionTitlePage],
        providers: [
          { provide: ActivatedRoute, useValue: { params: params$, queryParams: queryParams$ } },
          { provide: CollectionContentService, useValue: collectionContentService },
          { provide: HtmlParserService, useValue: parserService },
          { provide: LOCALE_ID, useValue: 'sv' },
          { provide: MarkdownService, useValue: {} },
          { provide: ModalController, useValue: {} },
          { provide: PlatformService, useValue: { isMobile: () => false } },
          { provide: PopoverController, useValue: {} },
          { provide: ScrollService, useValue: scrollService },
          { provide: ViewOptionsService, useValue: {} }
        ]
      })
        .overrideTemplate(
          CollectionTitlePage,
          `
            @let activeComponent = this.activeComponent();
            <span class="active">{{ activeComponent }}</span>
            <span class="text">{{ text$ | async }}</span>
          `
        )
        .compileComponents();
    });

    it('renders searched content and replacement collection content after route reuse', async () => {
      const clearIntervalSpy = spyOn(window, 'clearInterval').and.callThrough();
      const fixture = TestBed.createComponent(CollectionTitlePage);
      fixture.detectChanges();

      firstTitle$.next({ content: '<p>First title</p>' });
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.text').textContent).toContain(
        '<p>First title</p>|match'
      );
      expect(scrollService.scrollToFirstSearchMatch).toHaveBeenCalled();
      expect((fixture.componentInstance as any).intervalTimerId).toBe(101);

      params$.next({ collectionID: '204' });
      secondTitle$.next({ content: '<p>Second title</p>' });
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.text').textContent).toContain(
        '<p>Second title</p>|match'
      );
      expect(clearIntervalSpy).toHaveBeenCalledWith(101);
      expect((fixture.componentInstance as any).intervalTimerId).toBe(102);

      fixture.componentInstance.ionViewWillLeave();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.active').textContent).toContain('false');
      expect(clearIntervalSpy).toHaveBeenCalledWith(102);
      expect((fixture.componentInstance as any).intervalTimerId).toBeUndefined();
    });
  });

  describe('CollectionForewordPage', () => {
    let params$: BehaviorSubject<Params>;
    let queryParams$: BehaviorSubject<Params>;
    let firstForeword$: Subject<any>;
    let secondForeword$: Subject<any>;
    let collectionContentService: jasmine.SpyObj<CollectionContentService>;

    beforeEach(async () => {
      params$ = new BehaviorSubject<Params>({ collectionID: '203' });
      queryParams$ = new BehaviorSubject<Params>({});
      firstForeword$ = new Subject<any>();
      secondForeword$ = new Subject<any>();
      collectionContentService = jasmine.createSpyObj<CollectionContentService>(
        'CollectionContentService',
        ['getForeword']
      );
      collectionContentService.getForeword.and.callFake(id =>
        id === '203' ? firstForeword$ : secondForeword$
      );
      const parserService = jasmine.createSpyObj<HtmlParserService>(
        'HtmlParserService',
        ['getSearchMatchesFromQueryParams', 'insertSearchMatchTags']
      );
      parserService.insertSearchMatchTags.and.callFake(text => text);

      await TestBed.configureTestingModule({
        imports: [CollectionForewordPage],
        providers: [
          { provide: ActivatedRoute, useValue: { params: params$, queryParams: queryParams$ } },
          { provide: CollectionContentService, useValue: collectionContentService },
          { provide: HtmlParserService, useValue: parserService },
          { provide: LOCALE_ID, useValue: 'sv' },
          { provide: ModalController, useValue: {} },
          { provide: PlatformService, useValue: { isMobile: () => false } },
          { provide: PopoverController, useValue: {} },
          { provide: ScrollService, useValue: { scrollToFirstSearchMatch: () => undefined } },
          { provide: ViewOptionsService, useValue: {} }
        ]
      })
        .overrideTemplate(
          CollectionForewordPage,
          `
            @let activeComponent = this.activeComponent();
            <span class="active">{{ activeComponent }}</span>
            <span class="text">{{ text$ | async }}</span>
          `
        )
        .compileComponents();
    });

    it('renders content reloaded for a new collection without a manual change-detection pass', async () => {
      const fixture = TestBed.createComponent(CollectionForewordPage);
      fixture.detectChanges();

      firstForeword$.next({ content: '<p>First foreword</p>' });
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.text').textContent).toContain(
        '<p>First foreword</p>'
      );

      params$.next({ collectionID: '204' });
      secondForeword$.next({ content: '<p>Second foreword</p>' });
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.text').textContent).toContain(
        '<p>Second foreword</p>'
      );
    });
  });
});
