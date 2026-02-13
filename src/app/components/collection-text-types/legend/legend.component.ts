import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, LOCALE_ID, NgZone, Renderer2, afterRenderEffect, computed, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { IonicModule } from '@ionic/angular';
import { catchError, Observable, of, switchMap, tap } from 'rxjs';

import { TextKey } from '@models/collection.models';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { MarkdownService } from '@services/markdown.service';
import { ScrollService } from '@services/scroll.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'text-legend',
  templateUrl: './legend.component.html',
  styleUrls: ['./legend.component.scss'],
  imports: [IonicModule, TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegendComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private mdService = inject(MarkdownService);
  private ngZone = inject(NgZone);
  private renderer2 = inject(Renderer2);
  private scrollService = inject(ScrollService);
  private activeLocale = inject(LOCALE_ID);

  readonly textKey = input.required<TextKey>();
  readonly scrollToElementId = input<string>();

  private readonly staticMdLegendFolderNumber: string = '13';
  private unlistenClickEvents?: () => void;

  private mdContent = signal<string | null>(null);
  private statusMessage = signal<string | null>(null);


  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computeds (pure, no side-effects)
  // ─────────────────────────────────────────────────────────────────────────────
  html = computed<string | undefined>(() => {
    const message = this.statusMessage();
    if (message) {
      return message;
    }

    const md = this.mdContent();
    if (md === null) {
      return undefined;
    }

    // Parse markdown → HTML.
    return this.mdService.parseMd(md);
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: data load, after-render DOM work, cleanup
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.loadMdContent();
    this.registerAfterRenderEffects();
    this.registerCleanup();
  }

  private loadMdContent() {
    // Load Markdown content when textKey changes
    toObservable(this.textKey).pipe(
      // reset state before each load
      tap(() => {
        this.mdContent.set(null);
        this.statusMessage.set(null);
      }),
      switchMap(tk => this.loadLegend$(tk)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((md: string) => {
      // If an error message is already set, keep it; else set content.
      if (!this.statusMessage()) {
        this.mdContent.set(md);
      }
    });
  }

  private registerAfterRenderEffects() {
    // Attach listeners (once) & perform initial scroll after render
    afterRenderEffect({
      earlyRead: () => {
        // Signal reads here define dependencies for re-running the effect
        const htmlReady = this.html();
        const targetId  = this.scrollToElementId();

        // DOM reads here: is the target element present yet?
        const targetEl = (htmlReady && targetId)
          ? this.findLegendTarget(targetId)
          : null;

        return targetEl;
      },
      write: (targetEl) => {
        const scrollTarget = targetEl();

        // Attach listeners once after first render
        if (!this.unlistenClickEvents) {
          untracked(() => this.setUpTextListeners());
        }

        if (!scrollTarget) {
          return;
        }

        this.scrollService.scrollElementIntoView(scrollTarget, 'top');
      }
    }, { injector: this.injector });
  }

  private registerCleanup() {
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.unlistenClickEvents?.();
      this.unlistenClickEvents = undefined;
    });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Data load with fallbacks
  // ─────────────────────────────────────────────────────────────────────────────
  private loadLegend$(tk: TextKey): Observable<string> {
    const base = `${this.activeLocale}-${this.staticMdLegendFolderNumber}-${tk.collectionID}`;
    const primary   = `${base}-${tk.publicationID}`;
    const fallback1 = `${base}`;
    const fallback2 = `${this.activeLocale}-${this.staticMdLegendFolderNumber}-00`;

    const fetch = (id: string) => this.mdService.getMdContent(id);

    return fetch(primary).pipe(
      catchError(() => fetch(fallback1)),
      catchError(() => fetch(fallback2)),
      catchError(err => {
        console.error(err);
        this.statusMessage.set($localize`:@@Legend.None:Inga teckenförklaringar tillgängliga.`);
        return of('');
      })
    );
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Event handling
  // ─────────────────────────────────────────────────────────────────────────────
  private setUpTextListeners() {
    if (this.unlistenClickEvents) {
      return;
    }

    const host: HTMLElement = this.elementRef.nativeElement;

    /* CLICK EVENTS */
    this.unlistenClickEvents = this.ngZone.runOutsideAngular(() =>
      this.renderer2.listen(host, 'click', (event) => {
        try {
          const clickedElem = event.target as HTMLElement | null;
          const targetHref = clickedElem?.getAttribute('href');

          if (!targetHref?.startsWith('#')) {
            return;
          }

          // Same-legend fragment → prevent default & scroll into view
          event.preventDefault();

          // Find the nearest <text-legend> container
          let containerElem: HTMLElement | null = clickedElem;
          while (containerElem && containerElem.tagName !== 'TEXT-LEGEND') {
            containerElem = containerElem.parentElement;
          }

          if (containerElem) {
            const targetElem = containerElem.querySelector<HTMLElement>(
              `[data-id="${targetHref.slice(1)}"]`
            );
            this.scrollService.scrollElementIntoView(targetElem, 'top');
          }
        } catch (e) {
          console.error(e);
        }
      })
    );
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // DOM helper
  // ─────────────────────────────────────────────────────────────────────────────
  private findLegendTarget(targetId: string): HTMLElement | null {
    const legends = document.querySelectorAll(
      'page-text:not([ion-page-hidden]):not(.ion-page-hidden) text-legend'
    );
    const last = legends[legends.length - 1] as HTMLElement | undefined;
    return last?.querySelector<HTMLElement>(`[data-id="${targetId}"]`) ?? null;
  }

}
