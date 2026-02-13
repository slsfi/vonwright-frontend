import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, NgZone, Renderer2, afterRenderEffect, computed, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController } from '@ionic/angular';
import { catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';

import { config } from '@config';
import { MathJaxDirective } from '@directives/math-jax.directive';
import { IllustrationModal } from '@modals/illustration/illustration.modal';
import { TextKey } from '@models/collection.models';
import { ReadingText } from '@models/readingtext.models'
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';
import { enableFrontMatterPageOrTextViewType, isFileNotFoundHtml } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'reading-text',
  templateUrl: './reading-text.component.html',
  styleUrls: ['./reading-text.component.scss'],
  imports: [IonicModule, MathJaxDirective, TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReadingTextComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private collectionContentService = inject(CollectionContentService);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private modalController = inject(ModalController);
  private ngZone = inject(NgZone);
  private parserService = inject(HtmlParserService);
  private renderer2 = inject(Renderer2);
  private scrollService = inject(ScrollService);
  viewOptionsService = inject(ViewOptionsService);

  readonly language = input<string>('');
  readonly searchMatches = input<string[]>([]);
  readonly textKey = input.required<TextKey>();
  readonly textPosition = input<string>('');
  readonly openNewIllustrView = output<any>();
  readonly selectedIllustration = output<any>();

  intervalTimerId: number = 0;
  private unlistenClickEvents?: () => void;
  private _lastScrollKey: string | null = null;
  private _lastTextPosition: string | null = null;

  private readingText = signal<ReadingText | null>(null);
  private statusMessage = signal<string | null>(null);

  illustrationsViewAvailable = computed<boolean>(() =>
    enableFrontMatterPageOrTextViewType('text', this.textKey().collectionID, config, 'illustrations')
  );

  
  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computeds (pure, no side-effects)
  // ─────────────────────────────────────────────────────────────────────────────
  textLanguage = computed<string>(() => this.readingText()?.language ?? '');

  // Derived computed that builds the final HTML for the template
  //    - Returns:
  //        undefined  → "loading" (spinner)
  //        string     → final HTML or a user-facing status message
  html = computed<string | undefined>(() => {
    // When status message exists, show that (none/error)
    const message = this.statusMessage();
    if (message) {
      return message;
    }

    // Loading (spinner)
    const data = this.readingText();
    if (data === null) {
      return undefined;
    }

    // Compose final HTML
    const tk = this.textKey(); // collection may affect postprocessing
    const post = this.parserService.postprocessReadingText(data.html, tk.collectionID);
    return this.parserService.insertSearchMatchTags(post, this.searchMatches());
  });

  /** Whether the postprocessed text contains inline-visible illustrations */
  inlineVisibleIllustrations = computed(() =>
    this.parserService.readingTextHasVisibleIllustrations(this.html() ?? '')
  );

  
  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire side-effects (load, outputs, after-render, listeners, cleanup)
  // ─────────────────────────────────────────────────────────────────────────────
  constructor() {
    this.loadReadingtext();
    this.registerAfterRenderEffects();
    this.registerCleanup();
  }

  private loadReadingtext() {
    // Load whenever textKey or language changes
    combineLatest([
      toObservable(this.textKey),
      toObservable(this.language)
    ]).pipe(
      map(([tk, lang]) => ({ tk, lang })),
      tap(() => {
        // reset for a new load
        this.readingText.set(null);
        this.statusMessage.set(null);
        this._lastScrollKey = null;
        // Track last textPosition so we can detect "unset" → scroll to top
        this._lastTextPosition = this.textPosition() || null;
      }),
      switchMap(({ tk, lang }) =>
        this.collectionContentService.getReadingText(tk, lang).pipe(
          // If backend ever sends a "File not found" HTML
          map((rt: ReadingText) => {
            if (!rt?.html || isFileNotFoundHtml(rt.html)) {
              this.statusMessage.set($localize`:@@ReadingText.None:Det finns ingen utskriven lästext, se faksimil.`);
              // Still return object so language is available; UI shows message via statusMessage
              return rt;
            }
            return rt;
          }),
          catchError(err => {
            console.error(err);
            this.statusMessage.set($localize`:@@ReadingText.Error:Ett fel har uppstått. Lästexten kunde inte hämtas.`);
            // Keep reading as null (spinner will stop due to statusMessage)
            return of<ReadingText | null>(null);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(rt => {
      if (rt) {
        this.readingText.set(rt);
      } else if (!this.statusMessage()) {
        // defensive: if we got null without a message, show a generic one
        this.statusMessage.set($localize`:@@ReadingText.Error:Ett fel har uppstått. Lästexten kunde inte hämtas.`);
      }
    });
  }

  private registerAfterRenderEffects() {
    // After-render: attach DOM listeners and perform scrolling when appropriate.
    // Triggers when:
    //  - content finished loading,
    //  - textKey changed,
    //  - textPosition changed,
    //  - searchMatches changed (only when no textPosition).
    afterRenderEffect({
      write: () => {
        const data = this.readingText();           // null (loading) or ReadingText
        const tk = untracked(this.textKey);
        const pos = this.textPosition();
        const matches = this.searchMatches();

        // Only act when content exists
        if (data === null) {
          return;
        }

        // Attach listeners once (browser only) after first render (safe for zoneless)
        if (!this.unlistenClickEvents) {
          untracked(() => this.setUpTextListeners());
        }

        // Detect "pos changed → scroll to anchor" or "pos unset after being set → top"
        const prevPos = this._lastTextPosition;
        this._lastTextPosition = pos || null;

        if (pos) {
          const key = `${tk.textItemID};${pos}`;
          if (this._lastScrollKey !== key) {
            this._lastScrollKey = key;
            this.scrollToTextPosition(pos);
          }
          return;
        }

        // If previously had a pos but now it's empty → scroll to top
        if (prevPos && !pos) {
          this.scrollReadingTextToTop();
          // fall through to maybe handle first-search-match in a new navigation
        }

        // No textPosition: optionally scroll to first search match (once per tk+matches)
        if (matches.length === 0) {
          return;
        }

        const key = `${tk.textItemID}|matches:${matches.join(',')}`;
        if (this._lastScrollKey !== key) {
          this._lastScrollKey = key;

          this.scrollService.scrollToFirstSearchMatch(
            this.elementRef.nativeElement,
            this.intervalTimerId
          );
        }
      }
    }, { injector: this.injector });
  }

  private registerCleanup() {
    // Clean up attached listeners and interval timer on destroy
    this.destroyRef.onDestroy(() => {
      this.unlistenClickEvents?.();
      this.unlistenClickEvents = undefined;
      clearInterval(this.intervalTimerId);
    });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // UI actions
  // ─────────────────────────────────────────────────────────────────────────────

  /** Open a clicked image in a new illustrations view */
  private openIllustrationInNewView(image: any) {
    image.viewType = 'illustrations';
    this.openNewIllustrView.emit(image);
  }

  /** Update the currently selected image in an existing illustrations view */
  private updateSelectedIllustrationImage(image: any) {
    image.viewType = 'illustrations';
    this.selectedIllustration.emit(image);
  }

  /** Open a specific illustration in a modal dialog */
  private async openIllustration(imageNumber: string) {
    const modal = await this.modalController.create({
      component: IllustrationModal,
      componentProps: { 'imageNumber': imageNumber }
    });
    modal.present();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event listeners (outside Angular) + scrolling helpers
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
          const eventTarget = event.target as HTMLElement;

          // Some of the texts, e.g. ordsprak.sls.fi, have links to external sites
          if (
            eventTarget.hasAttribute('href') &&
            !eventTarget.getAttribute('href')?.includes('http')
          ) {
            event.preventDefault();
          }

          let image: { src: string; class: string } | null = null;

          // Check if click on an illustration or icon representing an illustration
          if (eventTarget.classList.contains('doodle') && eventTarget.hasAttribute('src')) {
            // Click on a pictogram ("doodle")
            image = {
              src: this.parserService.getMappedMediaCollectionURL(this.textKey()?.collectionID ?? '')
                  + String((eventTarget as any).dataset['id']).replace('tag_', '') + '.jpg',
              class: 'doodle'
            };
          } else if (this.inlineVisibleIllustrations()) {
            // There are possibly visible illustrations in the read text. Check if click on such an image.
            if (
              eventTarget.classList.contains('est_figure_graphic') &&
              eventTarget.hasAttribute('src')
            ) {
              image = { src: (eventTarget as HTMLImageElement).src, class: 'visible-illustration' };
            }
          } else {
            // Check if click on an icon representing an image which is NOT visible in the reading text
            const prev = eventTarget.previousElementSibling as (HTMLElement | null);
            if (
              prev?.classList.contains('est_figure_graphic') &&
              prev?.hasAttribute('src')
            ) {
              image = { src: (prev as HTMLImageElement).src, class: 'illustration' };
            }
          }

          // Check if we have an image to show in the illustrations-view
          if (image) {
            // Check if we have an illustrations-view open, if not, open and display the clicked image there
            if (document.querySelector(
              'page-text:not([ion-page-hidden]):not(.ion-page-hidden) illustrations'
            )) {
              // Display image in an illustrations-view which is already open
              this.ngZone.run(() => {
                this.updateSelectedIllustrationImage(image);
              });
            } else {
              this.ngZone.run(() => {
                this.openIllustrationInNewView(image);
              });
            }
          }
        } catch (e) {
          console.error(e);
        }

        // Check if click on an icon which links to an illustration that should be opened in a modal
        const target = event.target as HTMLElement;
        const parent = target.parentElement;
        if (
          target.classList.contains('ref_illustration') ||
          parent?.classList.contains('ref_illustration')
        ) {
          const hashNumber = (parent as HTMLAnchorElement)?.hash ?? (target as HTMLAnchorElement)?.hash;
          const imageNumber = hashNumber?.split('#')[1] || '';
          this.ngZone.run(() => {
            this.openIllustration(imageNumber);
          });
        }
      })
    );
  }

  private scrollToTextPosition(targetName: string) {
    // Scroll to textPosition if defined.
    if (!targetName) {
      return;
    }

    const nElement: HTMLElement = this.elementRef.nativeElement;
    let iterationsLeft = 10;
    clearInterval(this.intervalTimerId);

    this.intervalTimerId = window.setInterval(() => {
      if (iterationsLeft-- < 1) {
        clearInterval(this.intervalTimerId);
        return;
      }
      let target = nElement.querySelector(
        `[name="${targetName}"]`
      ) as (HTMLAnchorElement | null);
      const parent = target?.parentElement;

      // If the first anchor lives inside a fixed header, pick the second occurrence
      if (
        parent?.classList.contains('ttFixed') ||
        parent?.parentElement?.classList.contains('ttFixed')
      ) {
        const all = nElement.querySelectorAll(`[name="${targetName}"]`);
        target = all.length > 1 ? (all[1] as HTMLAnchorElement) : target;
      }

      if (target) {
        this.scrollService.scrollToHTMLElement(target);
        clearInterval(this.intervalTimerId);
      }
    }, 1000);
  }

  private scrollReadingTextToTop() {
    this.ngZone.runOutsideAngular(() => {
      const target = document.querySelector<HTMLElement>(
        'page-text:not([ion-page-hidden]):not(.ion-page-hidden) reading-text'
      );
      if (target) {
        this.scrollService.scrollElementIntoView(target, 'top', 50);
      }
    });
  }

}
