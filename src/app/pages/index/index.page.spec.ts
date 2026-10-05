import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject, of, Subject } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';
import { NamedEntityService } from '@services/named-entity.service';
import { TooltipService } from '@services/tooltip.service';
import { IndexPage } from './index.page';

describe('IndexPage', () => {
  let params$: BehaviorSubject<Params>;
  let queryParams$: BehaviorSubject<Params>;
  let personsResult$: Subject<any>;
  let placesResult$: Subject<any>;
  let markdownService: jasmine.SpyObj<MarkdownService>;
  let modalController: jasmine.SpyObj<ModalController>;
  let namedEntityService: jasmine.SpyObj<NamedEntityService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ type: 'persons' });
    queryParams$ = new BehaviorSubject<Params>({});
    personsResult$ = new Subject<any>();
    placesResult$ = new Subject<any>();

    markdownService = jasmine.createSpyObj<MarkdownService>(
      'MarkdownService',
      ['getParsedMdContent']
    );
    markdownService.getParsedMdContent.and.callFake(
      (fileId: string) => of(`<p>${fileId}</p>`)
    );
    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['create']);
    namedEntityService = jasmine.createSpyObj<NamedEntityService>(
      'NamedEntityService',
      [
        'getKeywordsFromElastic',
        'getPersons',
        'getPersonsFromElastic',
        'getPlacesFromElastic',
        'getWorksFromElastic'
      ]
    );
    namedEntityService.getPersonsFromElastic.and.returnValue(personsResult$);
    namedEntityService.getPlacesFromElastic.and.returnValue(placesResult$);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [IndexPage],
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' },
        {
          provide: ActivatedRoute,
          useValue: {
            params: params$,
            queryParams: queryParams$,
            snapshot: { queryParams: {} }
          }
        },
        { provide: MarkdownService, useValue: markdownService },
        { provide: ModalController, useValue: modalController },
        { provide: NamedEntityService, useValue: namedEntityService },
        { provide: Router, useValue: router },
        {
          provide: TooltipService,
          useValue: jasmine.createSpyObj<TooltipService>(
            'TooltipService',
            ['constructYearBornDeceasedString']
          )
        }
      ]
    })
      .overrideTemplate(
        IndexPage,
        `
          @let data = this.data();
          @let indexType = this.indexType();
          @let mdContent = this.mdContent();
          @let showLoading = this.showLoading();
          <span class="type">{{ indexType }}</span>
          <span class="markdown">{{ mdContent }}</span>
          <span class="loading">{{ showLoading }}</span>
          <span class="results">{{ data.length }}|{{ data[0]?.full_name || data[0]?.name }}</span>
        `
      )
      .compileComponents();
  });

  it('renders asynchronous results and route changes without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(IndexPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading').textContent).toContain('true');
    expect(fixture.nativeElement.querySelector('.markdown').textContent).toContain('sv-12-02');

    personsResult$.next({
      aggregations: {
        unique_subjects: {
          after_key: { id: 1 },
          buckets: [{ key: { id: 1, full_name: 'Anna Andersson', sort_by_name: 'Andersson' } }]
        }
      }
    });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.loading').textContent).toContain('false');
    expect(fixture.nativeElement.querySelector('.results').textContent).toContain('1|Anna Andersson');

    params$.next({ type: 'places' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.type').textContent).toContain('places');
    expect(fixture.nativeElement.querySelector('.markdown').textContent).toContain('sv-12-03');

    placesResult$.next({
      aggregations: {
        unique_places: {
          after_key: { id: 2 },
          buckets: [{ key: { id: 2, name: 'Helsingfors', sort_by_name: 'Helsingfors' } }]
        }
      }
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.results').textContent).toContain('1|Helsingfors');
  });

  it('applies modal filters and renders the replacement results', async () => {
    const filterResult$ = new Subject<any>();
    const modal = {
      present: jasmine.createSpy('present'),
      onWillDismiss: jasmine.createSpy('onWillDismiss').and.resolveTo({
        data: { isEmpty: false, filterYearMin: 1900 },
        role: 'apply'
      })
    };
    modalController.create.and.resolveTo(modal as any);
    namedEntityService.getPersonsFromElastic.and.returnValues(personsResult$, filterResult$);

    const fixture = TestBed.createComponent(IndexPage);
    fixture.detectChanges();

    await fixture.componentInstance.openFilterModal();
    expect(modal.present).toHaveBeenCalled();
    expect(fixture.componentInstance.filters()).toEqual({ isEmpty: false, filterYearMin: 1900 });
    expect(fixture.componentInstance.showLoading()).toBeTrue();

    filterResult$.next({ aggregations: { unique_subjects: { buckets: [] } } });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.loading').textContent).toContain('false');
  });

  it('adds subsequent works results without mutating the current signal value', async () => {
    const workHit = (id: number, firstName: string, lastName: string, title: string) => ({
      _source: {
        man_id: id,
        title,
        author_data: [{ id, first_name: firstName, last_name: lastName }]
      }
    });
    namedEntityService.getWorksFromElastic.and.returnValues(
      of({ hits: { hits: [workHit(1, 'Zelda', 'Zeta', 'Second work')] } }),
      of({ hits: { hits: [workHit(2, 'Anna', 'Alpha', 'First work')] } })
    );
    params$.next({ type: 'works' });

    const fixture = TestBed.createComponent(IndexPage);
    fixture.detectChanges();
    const firstData = fixture.componentInstance.data();

    fixture.componentInstance.loadMore(null);
    await fixture.whenStable();

    expect(fixture.componentInstance.data()).not.toBe(firstData);
    expect(fixture.componentInstance.data().map(item => item.id)).toEqual([2, 1]);
    expect(firstData.map(item => item.id)).toEqual([1]);
  });

  it('opens a named-entity modal from query parameters and clears the parameter on close', async () => {
    const modal = {
      present: jasmine.createSpy('present'),
      onWillDismiss: jasmine.createSpy('onWillDismiss').and.resolveTo({ role: 'close' })
    };
    modalController.create.and.resolveTo(modal as any);

    const fixture = TestBed.createComponent(IndexPage);
    fixture.detectChanges();
    queryParams$.next({ id: '42' });
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();

    expect(modalController.create).toHaveBeenCalledWith(jasmine.objectContaining({
      componentProps: { id: '42', type: 'person' }
    }));
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { id: null },
      replaceUrl: true
    }));
  });
});
