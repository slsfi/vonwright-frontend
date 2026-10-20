import type { MockedObject } from 'vitest';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { config } from '@config';
import { Ebook } from '@models/ebook.models';
import { EbookPage } from './ebook.page';

describe('EbookPage', () => {
  let originalEbooks: Ebook[];
  let routeParams$: BehaviorSubject<Params>;
  let router: MockedObject<Pick<Router, 'navigate'>>;

  beforeEach(async () => {
    originalEbooks = config.ebooks ?? [];
    config.ebooks = [
      { title: 'Book one', filename: 'book-one.pdf' },
      { title: 'Book two', filename: 'book-two.epub' }
    ];
    routeParams$ = new BehaviorSubject<Params>({ type: 'pdf', name: 'book-one' });
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [EbookPage],
      providers: [
        { provide: ActivatedRoute, useValue: { params: routeParams$ } },
        { provide: Router, useValue: router },
        { provide: RESPONSE_INIT, useValue: null }
      ]
    })
      .overrideTemplate(
        EbookPage,
        '@let ebookType = this.ebookType(); @let filename = this.filename(); <span>{{ filename }}|{{ ebookType }}</span>'
      )
      .compileComponents();
  });

  afterEach(() => {
    config.ebooks = originalEbooks;
  });

  it('updates ebook state when route parameters change on the reused component', async () => {
    const fixture = TestBed.createComponent(EbookPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('book-one.pdf|pdf');

    routeParams$.next({ type: 'epub', name: 'book-two' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('book-two.epub|epub');

    routeParams$.next({ type: 'pdf', name: 'missing' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('|pdf');
    expect(fixture.componentInstance.filename()).toBe('');
  });

  it('redirects the legacy route and unsubscribes when destroyed', () => {
    routeParams$.next({ filename: 'book-one.pdf' });
    const fixture = TestBed.createComponent(EbookPage);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledTimes(1);

    expect(router.navigate).toHaveBeenCalledWith(
      ['/ebook', 'pdf', 'book-one'],
      { replaceUrl: true }
    );

    fixture.destroy();
    router.navigate.mockClear();
    routeParams$.next({ filename: 'book-two.epub' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sets HTTP 301 for a legacy ebook redirect during SSR', () => {
    const response: ResponseInit = { status: 200 };
    TestBed.overrideProvider(RESPONSE_INIT, { useValue: response });
    routeParams$.next({ filename: 'book-one.pdf' });

    const fixture = TestBed.createComponent(EbookPage);
    fixture.detectChanges();

    expect(response.status).toBe(301);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/ebook', 'pdf', 'book-one'],
      { replaceUrl: true }
    );
  });

  it.each([
    { type: 'pdf', name: 'book-one' },
    { filename: 'book-without-extension' },
    { filename: 'book-with-empty-extension.' }
  ])('keeps the server response unchanged when no redirect is needed: %j', params => {
    const response: ResponseInit = { status: 200 };
    TestBed.overrideProvider(RESPONSE_INIT, { useValue: response });
    routeParams$.next(params);

    const fixture = TestBed.createComponent(EbookPage);
    fixture.detectChanges();

    expect(response.status).toBe(200);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
