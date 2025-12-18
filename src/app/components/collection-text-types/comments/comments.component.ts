import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, NgZone, Renderer2, afterRenderEffect, computed, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController } from '@ionic/angular';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { IllustrationModal } from '@modals/illustration/illustration.modal';
import { TextKey } from '@models/collection.models';
import { CorrespondenceMetadata, LetterData } from '@models/metadata.models';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CommentService } from '@services/comment.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';
import { concatenateNames, isFileNotFoundHtml } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
  imports: [IonicModule, TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommentsComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private commentService = inject(CommentService);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private modalController = inject(ModalController);
  private ngZone = inject(NgZone);
  private parserService = inject(HtmlParserService);
  private platformService = inject(PlatformService);
  private renderer2 = inject(Renderer2);
  private scrollService = inject(ScrollService);
  viewOptionsService = inject(ViewOptionsService);

  readonly searchMatches = input<string[]>([]);
  readonly textKey = input.required<TextKey>();
  readonly openNewReadingTextView = output<string>();
  readonly setMobileModeActiveText = output<string>();

  intervalTimerId: number = 0;
  private mobileMode = this.platformService.isMobile();
  private unlistenClickEvents?: () => void;
  private _lastScrollKey: string | null = null;

  private rawHtml = signal<string | null>(null);
  private statusMessage = signal<string | null>(null);
  letter = signal<LetterData | undefined>(undefined);
  sender = signal<string>('');
  receiver = signal<string>('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computeds (pure, no side-effects)
  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computed that builds the final HTML for the template
  //    - Returns:
  //        undefined  → "loading" (spinner)
  //        string     → final HTML or a user-facing status message
  html = computed<string | undefined>(() => {
    const message = this.statusMessage();
    if (message) {
      return message;
    }

    // Loading (spinner)
    const rawHtml = this.rawHtml();
    if (rawHtml === null) {
      return undefined;
    }

    // Compose and return final HTML
    return this.parserService.insertSearchMatchTags(rawHtml, this.searchMatches());
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire data loads, after-render scroll, and cleanup
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.loadComments();
    this.loadCorrespondenceMetadata();
    this.registerAfterRenderEffects();
    this.registerCleanup();
  }

  private loadComments() {
    // Load comments whenever textKey changes
    toObservable(this.textKey).pipe(
      tap(() => {
        // reset for a new load
        this.rawHtml.set(null);        // show spinner
        this.statusMessage.set(null);  // clear previous messages
        this._lastScrollKey = null;    // allow initial scroll again
      }),
      switchMap((tk: TextKey) =>
        this.commentService.getComments(tk).pipe(
          map((com: string) => {
            if (!com || isFileNotFoundHtml(com)) {
              this.statusMessage.set($localize`:@@Commentary.None:Inga kommentarer.`);
              return '';
            }
            return com;
          }),
          catchError(err => {
            console.error(err);
            this.statusMessage.set($localize`:@@Commentary.Error:Ett fel har uppstått. Kommentarer kunde inte hämtas.`);
            return of('');
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((comHtml: string) => {
      if (this.statusMessage()) {
        return; // error already set
      }
      this.rawHtml.set(comHtml);
    });
  }

  private loadCorrespondenceMetadata() {
    // Load correspondence metadata (sender/receiver/letter)
    toObservable(this.textKey).pipe(
      switchMap((tk: TextKey) => this.commentService.getCorrespondanceMetadata(tk.publicationID)),
      catchError(err => {
        console.error(err);
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((cm: CorrespondenceMetadata | null) => {
      if (!cm) {
        return;
      }

      // sender / receiver names
      if (cm.subjects?.length) {
        const senders: string[] = [];
        const receivers: string[] = [];
        for (const s of cm.subjects) {
          if (s.sender) {
            senders.push(s.sender);
          }
          if (s.receiver) {
            receivers.push(s.receiver);
          }
        }
        this.sender.set(concatenateNames(senders));
        this.receiver.set(concatenateNames(receivers));
      } else {
        this.sender.set('');
        this.receiver.set('');
      }

      this.letter.set(cm.letter ?? undefined);
    });
  }

  private registerCleanup() {
    // Clean up attached listeners and interval timer on destroy
    this.destroyRef.onDestroy(() => {
      this.unlistenClickEvents?.();
      this.unlistenClickEvents = undefined;
      clearInterval(this.intervalTimerId);
    });
  }

  private registerAfterRenderEffects() {
    // After-render: attach listeners (once) and perform first-search-match scroll
    afterRenderEffect({
      write: () => {
        // Attach listeners once after first render
        if (!this.unlistenClickEvents) {
          untracked(() => this.setUpTextListeners());
        }

        // Scroll to first match only once per (textKey + matches)
        const html = this.rawHtml();           // null = loading; string = ready
        const matches = this.searchMatches();  // input signal
        const tk = untracked(this.textKey);

        if (html === null || matches.length === 0) {
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


  // ─────────────────────────────────────────────────────────────────────────────
  // Event listeners (outside Angular) + UI helpers
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
          // This check for xreference is necessary since we don't want the comment to
          // scroll if the clicked target is a link in a comment. Clicks on links are
          // handled by read.ts.
          let targetIsLink = false;
          let targetElem: HTMLElement | null = event.target as HTMLElement;

          // Detect "xreference" links (don't trigger comment-to-lemma scroll)
          if (
            targetElem.classList.contains('xreference') ||
            targetElem.parentElement?.classList.contains('xreference') ||
            targetElem.parentElement?.parentElement?.classList.contains('xreference')
          ) {
            targetIsLink = true;
          }

          if (!targetIsLink && this.viewOptionsService.show().comments) {
            // This is linking to a comment lemma ("asterisk") in the reading text,
            // i.e. the user has clicked a comment in the comments-column.
            event.preventDefault();

            // Find the comment element that has been clicked in the comment-column.
            if (!targetElem.classList.contains('commentScrollTarget')) {
              targetElem = targetElem.parentElement;
              while (
                targetElem &&
                !targetElem.classList.contains('commentScrollTarget') &&
                targetElem.tagName !== 'COMMENTS'
              ) {
                targetElem = targetElem.parentElement;
              }
            }

            if (targetElem) {
              // Find the lemma in the reading text.
              // Remove all non-digits at the start of the comment's id.
              const numId: string = targetElem.classList[targetElem.classList.length - 1]
                    .replace( /^\D+/g, '');
              const targetId: string = 'start' + numId;
              const lemmaStart = this.scrollService.findElementInColumnByAttribute(
                'data-id', targetId, 'reading-text'
              );

              if (lemmaStart) {
                // There is a reading text view open.
                // Scroll to start of lemma in reading text and temporarily prepend arrow.
                if (this.mobileMode) {
                  this.ngZone.run(() => this.setMobileModeActiveText.emit('readingtext'));
                  // In mobile mode the reading text view needs time to be made
                  // visible before scrolling can start.
                  setTimeout(() => {
                    this.scrollService.scrollToCommentLemma(lemmaStart);
                  }, 700);
                } else {
                  this.scrollService.scrollToCommentLemma(lemmaStart);
                  // Scroll to comment in the comments-column.
                  this.scrollService.scrollToComment(numId, targetElem);
                }
              } else {
                // A reading text view is not open -> open one so the lemma can be scrolled
                // into view there.
                this.ngZone.run(() => this.openNewReadingTextView.emit(targetId));
                // Scroll to comment in the comments-column.
                this.scrollService.scrollToComment(numId, targetElem);
              }
            }
          }

          // Check if click on a link to an illustration that should be opened in a modal
          if (targetIsLink && targetElem?.classList.contains('ref_illustration')) {
            const imageNumber = (targetElem as HTMLAnchorElement).hash.split('#')[1];
            this.ngZone.run(() => this.openIllustration(imageNumber));
          }
        } catch (e) {
          console.error(e);
        }
      })
    );
  }

  private async openIllustration(imageNumber: string) {
    const modal = await this.modalController.create({
      component: IllustrationModal,
      componentProps: { 'imageNumber': imageNumber }
    });
    modal.present();
  }

}
