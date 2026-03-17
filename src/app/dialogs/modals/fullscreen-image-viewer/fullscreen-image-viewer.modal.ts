import { ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, OnInit, afterRenderEffect, computed, inject, signal, untracked, viewChild } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { DraggableImageDirective } from '@directives/draggable-image.directive';
import { FacsimileImageService } from '@services/facsimile-image.service';
import { PlatformService } from '@services/platform.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'modal-fullscreen-image-viewer',
  templateUrl: './fullscreen-image-viewer.modal.html',
  styleUrls: ['./fullscreen-image-viewer.modal.scss'],
  imports: [IonicModule, DraggableImageDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Change image on keyboard arrow key strokes
  host: {
    ngSkipHydration: 'true',
    '(document:keyup.arrowleft)': 'previous()',
    '(document:keyup.arrowright)': 'next()'
  }
})
export class FullscreenImageViewerModal implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, @Input properties, local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private facsimileImageService = inject(FacsimileImageService);
  private modalCtrl = inject(ModalController);
  private platformService = inject(PlatformService);
  private currentImageObjectURL: string | null = null;
  private imageRequestSub: Subscription | null = null;

  @Input() startImageIndex: number = 0;
  @Input() backsides: (string | undefined)[] = [];
  @Input() imageDescriptions: string[] = [];
  @Input() imageTitles: string[] = [];
  @Input() imageURLs: string[] = [];

  private readonly toolbar = viewChild<ElementRef<HTMLElement>>('facsToolbar');

  activeImageIndex = signal(0);
  angle = signal(0);
  inputImageNumber = computed(() => this.activeImageIndex() + 1);
  mobileMode = signal(false);
  normImageTitles = signal<string[]>([]);
  prevX = signal(0);
  prevY = signal(0);
  showBackside = signal(false);
  showDescription = signal(true);
  toolbarHeight = signal(0);
  zoom = signal(1.0);
  imageLoading = signal(false);
  resolvedImageSrc = signal<string>('');

  imageStyle = computed(() => ({
    transform: this.getImageTransform(),
    'max-height': `calc(100vh - ${this.toolbarHeight()}px)`
  }));

  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor and lifecycle wiring
  // ─────────────────────────────────────────────────────────────────────────────
  constructor() {
    // Run toolbar height calculation on initial rendering and re-run when
    // description is toggled or active image changes.
    // ! Known bug: when this initially runs, the toolbar height is 0 in the DOM,
    // so we won't get the initial height calculation. The fallback is good enough
    // though.
    afterRenderEffect({
      write: () => {
        this.showDescription();
        this.activeImageIndex();
        untracked(() => this.toolbarHeight.set(this.getToolbarHeight()));
      }
    });
  }

  ngOnInit(): void {
    this.mobileMode.set(this.platformService.isMobile());
    this.activeImageIndex.set(this.startImageIndex);

    // Append dot to image titles
    if (this.imageTitles.length > 0) {
      const normalized = this.imageTitles.map((origTitle: string) => {
        if (origTitle && origTitle !== 'null') {
          const trimmed = origTitle.trim();
          const lastChar = trimmed.slice(-1);
          if (lastChar !== '.' && lastChar !== '!' && lastChar !== ':') {
            return `${trimmed}.`;
          }
        }
        return origTitle;
      });
      this.normImageTitles.set(normalized);
    } else {
      this.normImageTitles.set([]);
    }

    if (this.activeImageIndex() < 0 || this.activeImageIndex() > this.imageURLs.length - 1) {
      this.activeImageIndex.set(0);
    }
    this.updateResolvedImageSrc();
  }

  ngOnDestroy(): void {
    this.imageRequestSub?.unsubscribe();
    this.revokeCurrentImageObjectURL();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template/host listeners)
  // ─────────────────────────────────────────────────────────────────────────────
  closeModal() {
    return this.modalCtrl.dismiss(this.inputImageNumber(), 'imageNr');
  }

  previous() {
    this.setActiveIndex(this.activeImageIndex() - 1);
  }

  next() {
    this.setActiveIndex(this.activeImageIndex() + 1);
  }

  zoomIn() {
    this.zoom.update((value: number) => value + 0.1);
  }

  zoomOut() {
    this.zoom.update((value: number) => Math.max(value - 0.1, 0.5));
  }

  rotate() {
    this.angle.update((value: number) => {
      const nextAngle = value + 90;
      return nextAngle >= 360 ? 0 : nextAngle;
    });
  }

  reset() {
    this.zoom.set(1.0);
    this.angle.set(0);
    this.prevX.set(0);
    this.prevY.set(0);
  }

  zoomWithMouseWheel(event: WheelEvent) {
    const target = event.target as HTMLElement | null;
    if (target) {
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
      target.style.transform = this.getImageTransform();
    }
  }

  setImageCoordinates(coordinates: number[]) {
    this.prevX.set(coordinates[0]);
    this.prevY.set(coordinates[1]);
  }

  toggleImageDescription() {
    this.showDescription.update((value: boolean) => !value);
  }

  toggleBackside() {
    this.showBackside.update((value: boolean) => !value);
    this.updateResolvedImageSrc();
  }

  setImageNr(_event: any) {
    const value = Number(_event?.detail?.value);
    if (!Number.isFinite(value)) {
      return;
    }
    this.setActiveIndex(value - 1, true);
  }

  getBacksideUrl(frontsideUrl: string) {
    return frontsideUrl.replace('.jpg', 'B.jpg');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private setActiveIndex(index: number, clamp = false) {
    const length = this.imageURLs.length;
    if (length === 0) {
      this.activeImageIndex.set(0);
      this.updateResolvedImageSrc();
      return;
    }

    if (clamp) {
      const clamped = Math.min(Math.max(index, 0), length - 1);
      this.activeImageIndex.set(clamped);
      this.updateResolvedImageSrc();
      return;
    }

    const wrapped = ((index % length) + length) % length;
    this.activeImageIndex.set(wrapped);
    this.updateResolvedImageSrc();
  }

  private getToolbarHeight() {
    return Math.ceil(this.toolbar()?.nativeElement.getBoundingClientRect().bottom || 137);
  }

  private getImageTransform() {
    return `scale(${this.zoom()}) translate3d(${this.prevX()}px, ${this.prevY()}px, 0px) rotate(${this.angle()}deg)`;
  }

  private getCurrentImageURL(): string | null {
    // Resolve front/back image variant for the active index.
    const idx = this.activeImageIndex();
    const frontImageURL = this.imageURLs[idx];
    if (!frontImageURL) {
      return null;
    }
    if (this.showBackside() && this.backsides[idx]) {
      return this.getBacksideUrl(frontImageURL);
    }
    return frontImageURL;
  }

  private updateResolvedImageSrc() {
    // TODO(hydration): This component host uses `ngSkipHydration` as a temporary
    // safeguard. In auth-enabled mode, browser rendering
    // may replace URL src with a blob URL after bootstrap. When client hydration
    // is enabled in this app, make initial SSR/client src deterministic and then
    // remove the skip marker.
    // Do not bind remote image URL directly when auth is enabled:
    // native <img src> requests skip Angular interceptors and therefore miss auth
    // headers. FacsimileImageService handles the authenticated HttpClient/blob path
    // and falls back to direct URL where appropriate.
    const imageURL = this.getCurrentImageURL();
    if (!imageURL) {
      this.imageLoading.set(false);
    } else {
      this.imageLoading.set(true);
    }
    this.imageRequestSub?.unsubscribe();
    this.imageRequestSub = this.facsimileImageService.resolveImageSrc(imageURL).subscribe((resolvedImage) => {
      this.revokeCurrentImageObjectURL();
      this.currentImageObjectURL = resolvedImage.objectURL;
      this.resolvedImageSrc.set(resolvedImage.src);
      this.imageLoading.set(false);
    });
  }

  private revokeCurrentImageObjectURL() {
    // Release previous blob URL to prevent browser memory growth while browsing images.
    this.facsimileImageService.revokeObjectURL(this.currentImageObjectURL);
    this.currentImageObjectURL = null;
  }
}
