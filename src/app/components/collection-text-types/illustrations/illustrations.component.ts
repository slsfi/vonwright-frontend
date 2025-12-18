import { ChangeDetectionStrategy, Component, DestroyRef, Injector, NgZone, afterRenderEffect, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { catchError, of, switchMap, tap } from 'rxjs';

import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { TextKey } from '@models/collection.models';
import { Illustration } from '@models/illustration.models';
import { ScrollPlan } from '@models/scroll.models';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'illustrations',
  templateUrl: './illustrations.component.html',
  styleUrls: ['./illustrations.component.scss'],
  imports: [NgClass, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IllustrationsComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private modalCtrl = inject(ModalController);
  private ngZone = inject(NgZone);
  private parserService = inject(HtmlParserService);
  private platformService = inject(PlatformService);
  private scrollService = inject(ScrollService);

  readonly singleImage = input<Illustration | undefined>();
  readonly textKey = input.required<TextKey>();
  readonly showAllImages = output<null>();
  readonly setMobileModeActiveText = output<string>();
  
  imgLoading = signal(true);
  viewAll = signal(true);
  images = signal<Illustration[]>([]);
  imagesCache = signal<Illustration[]>([]);
  selectedImage = signal<string[]>([]);

  mobileMode = this.platformService.isMobile();

  private _pendingScroll = signal<Illustration | null>(null);
  private _scrollAttempts = signal(0);
  private _scrollRetryTimer: number | null = null;
  private static readonly SCROLL_MAX_RETRIES = 6;
  private static readonly SCROLL_RETRY_DELAY = 700;

  imageCountTotal = computed(() => this.imagesCache().length);


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire side-effects (load, outputs, scrolling)
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.loadIllustrations();
    this.registerSingleImageChangeEffect();
    this.registerAfterRenderEffects();
    this.destroyRef.onDestroy(() => this.clearRetryTimer());
  }

  private loadIllustrations() {
    toObservable(this.textKey).pipe(
      // reset state before each load
      tap(() => {
        this.imgLoading.set(true);
        this.viewAll.set(true);
        this.images.set([]);
        this.imagesCache.set([]);
      }),
      switchMap(tk =>
        this.parserService.getReadingTextIllustrations(tk).pipe(
          catchError(err => {
            // don’t fail the stream; render “no images” instead
            console.error(err);
            return of([] as Illustration[]);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((imgs: Illustration[]) => {
      this.imagesCache.set(imgs);

      const single = this.singleImage();
      if (single && imgs.length > 0) {
        this.images.set([single]);
        this.viewAll.set(false);
      } else {
        this.images.set(imgs);
        this.viewAll.set(true);
      }

      this.imgLoading.set(false);
    });
  }

  private registerSingleImageChangeEffect() {
    // react to late singleImage() changes
    effect(() => {
      const single = this.singleImage();
      if (single) {
        this.images.set([single]);
        this.viewAll.set(false);
      }
    }, { injector: this.injector });
  }

  private registerAfterRenderEffects() {
    // apply scrolling to illustration position in reading text
    afterRenderEffect({
      earlyRead: () => {
        this._scrollAttempts();       // establish dependency for retries

        const image = this._pendingScroll();

        if (!image) {
          return null;                // cleanup/no-op; don't log
        }

        if (!image.src) {             // missing src on request
          console.warn('Empty src-attribute for image; cannot scroll.');
          return null;
        }

        // Find the reading-text host (DOM read) so we scope our queries
        const host = document.querySelector<HTMLElement>(
          'page-text:not([ion-page-hidden]):not(.ion-page-hidden) reading-text'
        );
        if (!host) {
          return { retry: true as const };
        }

        // Resolve filename
        const file = image.src.split('/').pop() ?? '';

        // Resolve target (DOM reads)
        let target: HTMLElement | null = null;

        if (image.class === 'doodle') {
          // data-id strategy for pictograms
          // Get the image filename without format and prepend tag_ to it
          const imageDataId = 'tag_' + file.substring(0, file.lastIndexOf('.'));
          // If target not found, try dropping the prefix 'tag_' from
          // image data-id as unknown pictograms don't have this
          target =
            host.querySelector<HTMLElement>(`img.doodle[data-id="${imageDataId}"]`) ??
            host.querySelector<HTMLElement>(`img.doodle[data-id="${imageDataId.replace('tag_', '')}"]`);

          const prev = target?.previousElementSibling?.previousElementSibling;
          if (prev?.classList?.contains('ttNormalisations')) {
            // Change the scroll target from the doodle icon itself to
            // the preceding word which the icon represents.
            target = prev as HTMLElement;
          } else if (target?.parentElement?.classList?.contains('ttNormalisations')) {
            target = target.parentElement as HTMLElement;
          }
        } else {
          // Inline illustration: match by filename suffix.
          // Get the image element with src-attribute value
          // ending in image filename
          target = host.querySelector<HTMLElement>(`[src$="/${file}"]`);
        }

        if (!target) {
          console.warn('Unable to find target when scrolling to image position in text, retrying; imageSrc:', image.src);
          return { retry: true as const };
        }

        const y: 'top' | 'center' = image.class === 'visible-illustration' ? 'top' : 'center';
        const offset: number = this.mobileMode ? 0 : 75;
        const plan: ScrollPlan | null = this.scrollService.computeScrollPlan(target, y, offset);

        const prependArrow: boolean = image.class !== 'visible-illustration';
        const arrowParent: HTMLElement | null  = target.parentElement ?? null;

        return { plan, target, prependArrow, arrowParent };
      },

      write: (get) => {
        const data = get();
        if (!data) {
          return;
        }

        // Bounded retry
        if ('retry' in data && data.retry) {
          if (this.mobileMode && this._scrollAttempts() < IllustrationsComponent.SCROLL_MAX_RETRIES) {
            this.clearRetryTimer();
            // run the timer callback outside Angular to avoid extra CD in zone.js apps
            this._scrollRetryTimer = this.ngZone.runOutsideAngular(
              () => window.setTimeout(() => {
                this._scrollAttempts.update(n => n + 1);
              }, IllustrationsComponent.SCROLL_RETRY_DELAY)
            );
          } else {
            this.resetScrollState();
          }
          return;
        }

        // Success path: apply writes
        const { plan, target, prependArrow, arrowParent } = data as {
          plan: ScrollPlan | null;
          target: HTMLElement;
          prependArrow: boolean;
          arrowParent: HTMLElement | null;
        };
        if (!plan) {
          return;
        }

        if (prependArrow && arrowParent) {
          // Prepend temporary arrow near the target, then scroll to it
          const arrow: HTMLImageElement = new Image();
          arrow.src = 'assets/images/ms_arrow_right.svg';
          arrow.alt = 'ms arrow right image';
          arrow.classList.add('inl_ms_arrow');

          // Insert arrow BEFORE the actual target
          arrowParent.insertBefore(arrow, target);

          this.ngZone.runOutsideAngular(() => this.scrollService.applyScroll(plan));

          // Remove prepended arrow after a while
          this.ngZone.runOutsideAngular(() => {
            setTimeout(() => { try { arrow.remove(); } catch {} }, 5000);
          });
        } else {
          // Visible inline illustration: scroll to target itself
          this.ngZone.runOutsideAngular(() => this.scrollService.applyScroll(plan));
        }

        this.resetScrollState(); // success -> clear state
      }
    }, { injector: this.injector });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // UI actions
  // ─────────────────────────────────────────────────────────────────────────────

  showSingleImage(image: Illustration) {
    if (image) {
      this.viewAll.set(false);
      this.images.set([image]);
    } else {
      this.viewAllIllustrations();
    }
  }

  viewAllIllustrations() {
    this.viewAll.set(true);
    this.images.set(this.imagesCache());
    this.showAllImages.emit(null);
  }

  async zoomImage(imageSrc: string) {
    this.selectedImage.set([imageSrc]);
    const params = {
      activeImageIndex: 0,
      imageURLs: this.selectedImage(),
    };

    const modal = await this.modalCtrl.create({
      component: FullscreenImageViewerModal,
      componentProps: params,
      cssClass: 'fullscreen-image-viewer-modal',
    });

    modal.present();
  }

  scrollToPositionInText(image: Illustration) {
    this.setMobileModeActiveText.emit('readingtext');
    this._scrollAttempts.set(0);
    this._pendingScroll.set(image);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  // Helper to clear scroll retry timer
  private clearRetryTimer() {
    if (this._scrollRetryTimer !== null) {
      clearTimeout(this._scrollRetryTimer);
      this._scrollRetryTimer = null;
    }
  }

  // Helper to reset scroll state
  private resetScrollState() {
    this.clearRetryTimer();
    this._pendingScroll.set(null);
    this._scrollAttempts.set(0);
  }

}
