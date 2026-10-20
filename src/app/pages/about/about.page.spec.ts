import type { MockedObject } from 'vitest';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Data, Params, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';
import { ScrollService } from '@services/scroll.service';
import { AboutPage } from './about.page';

describe('AboutPage', () => {
  let params$: BehaviorSubject<Params>;
  let routeData$: BehaviorSubject<Data>;
  let parentRouteData$: BehaviorSubject<Data>;
  let fragment$: BehaviorSubject<string | null>;
  let markdownService: MockedObject<Pick<MarkdownService, 'getParsedMdContent'>>;
  let router: MockedObject<Pick<Router, 'navigate'>>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({});
    routeData$ = new BehaviorSubject<Data>({});
    parentRouteData$ = new BehaviorSubject<Data>({ backendPageId: '05-01' });
    fragment$ = new BehaviorSubject<string | null>(null);
    markdownService = {
      getParsedMdContent: vi.fn().mockName('MarkdownService.getParsedMdContent')
    };
    markdownService.getParsedMdContent.mockImplementation(
      (fileId: string) => of(`<p>${fileId}</p>`)
    );
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AboutPage],
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' },
        {
          provide: ActivatedRoute,
          useValue: {
            params: params$,
            data: routeData$,
            fragment: fragment$,
            parent: { data: parentRouteData$ }
          }
        },
        { provide: Router, useValue: router },
        { provide: MarkdownService, useValue: markdownService },
        {
          provide: ScrollService,
          useValue: {
            scrollElementIntoView: vi.fn().mockName('ScrollService.scrollElementIntoView')
          } satisfies MockedObject<Pick<ScrollService, 'scrollElementIntoView'>>
        }
      ]
    }).compileComponents();
  });

  it('renders Markdown updates when route data changes on the reused component', async () => {
    const fixture = TestBed.createComponent(AboutPage);
    fixture.detectChanges();

    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith(
      'sv-05-01',
      expect.any(String)
    );
    expect(fixture.nativeElement.textContent).toContain('sv-05-01');

    parentRouteData$.next({ backendPageId: '05-02' });
    await fixture.whenStable();
    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith(
      'sv-05-02',
      expect.any(String)
    );
    expect(fixture.nativeElement.textContent).toContain('sv-05-02');

    params$.next({ id: '03-01' });
    await fixture.whenStable();
    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith(
      'sv-03-01',
      expect.any(String)
    );
    expect(fixture.nativeElement.textContent).toContain('sv-03-01');
  });

  it('removes its click listener and pending scroll retry when destroyed', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const fixture = TestBed.createComponent(AboutPage);
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
    fragment$.next('missing-section');
    fixture.destroy();
    dispatchFragmentClick();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
