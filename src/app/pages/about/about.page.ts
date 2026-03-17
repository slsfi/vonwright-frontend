import { Component, ElementRef, LOCALE_ID, NgZone, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { combineLatest, distinctUntilChanged, map, Observable, of, Subscription, switchMap } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';
import { ScrollService } from '@services/scroll.service';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'page-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: false
})
export class AboutPage implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef);
  private mdService = inject(MarkdownService);
  private ngZone = inject(NgZone);
  private renderer2 = inject(Renderer2);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private scrollService = inject(ScrollService);
  private activeLocale = inject(LOCALE_ID);

  markdownText$: Observable<string | null>;

  private fragmentSubscription?: Subscription;
  private unlistenClickEvents?: () => void;

  ngOnInit() {
    if (isBrowser()) {
      this.setUpTextListeners();

      this.fragmentSubscription = this.route.fragment.subscribe(fragment => {
        if (fragment) {
          this.scrollToFragment(fragment);
        }
      });
    }

    const loadErrorMessage = '<p>' + $localize`:@@About.LoadingError:Sidans innehåll kunde inte laddas.` + '</p>';
    const parentRouteData$ = this.route.parent ? this.route.parent.data : of({} as Data);

    this.markdownText$ = combineLatest([
      this.route.params,
      this.route.data,
      parentRouteData$
    ]).pipe(
      map(([params, routeData, parentRouteData]) => {
        return params['id'] ?? routeData['backendPageId'] ?? parentRouteData['backendPageId'] ?? null;
      }),
      distinctUntilChanged(),
      switchMap((id: string | null) => {
        if (!id) {
          return of(loadErrorMessage);
        }

        return this.mdService.getParsedMdContent(
          this.activeLocale + '-' + id,
          loadErrorMessage
        );
      })
    );
  }

  ngOnDestroy() {
    this.unlistenClickEvents?.();
    this.fragmentSubscription?.unsubscribe();
  }

  /**
   * Listen for click events so we can intercept clicks on fragment links to
   * positions on the same page, and smoothly scroll the position into view.
   */
  private setUpTextListeners() {
    const nElement: HTMLElement = this.elementRef.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      /* CLICK EVENTS */
      this.unlistenClickEvents = this.renderer2.listen(nElement, 'click', (event) => {
        try {
          const eventTarget = event.target as HTMLElement;
          if (
            eventTarget.hasAttribute('href') &&
            eventTarget.getAttribute('href')?.startsWith('#')
          ) {
            // Link to a position on the same page, find the link target
            // and scroll the position into view using the URL fragment.
            event.preventDefault();
            const targetElemId = eventTarget.getAttribute('href')?.slice(1);
            if (!targetElemId) {
              return;
            }

            this.router.navigate([], {
              fragment: targetElemId,
              queryParamsHandling: 'preserve',
              relativeTo: this.route,
              replaceUrl: false,
            });
          }
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  private scrollToFragment(targetElemId: string, delayMs: number = 500) {
    if (!isBrowser()) return;

    this.ngZone.runOutsideAngular(() => {
      let attemptsLeft = 10;

      const tryScroll = () => {
        if (attemptsLeft-- < 1) return;

        const scrollTargetElem = document.querySelector(
          'page-about:not([ion-page-hidden]):not(.ion-page-hidden) [id="' + targetElemId + '"]'
        );
        const scrollContainerElem = document.querySelector(
          'page-about:not([ion-page-hidden]):not(.ion-page-hidden) ion-content'
        )?.shadowRoot?.querySelector('[part="scroll"]');

        if (scrollTargetElem && scrollContainerElem) {
          this.scrollService.scrollElementIntoView(
            scrollTargetElem as HTMLElement, 'top', 0, 'smooth', scrollContainerElem as HTMLElement
          );
        } else {
          setTimeout(tryScroll, delayMs);
        }
      };

      tryScroll();
    });
  }

}
