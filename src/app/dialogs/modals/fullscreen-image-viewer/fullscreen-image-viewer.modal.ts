import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit, afterRenderEffect, computed, inject, signal, untracked, viewChild } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';

import { DraggableImageDirective } from '@directives/draggable-image.directive';
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
    '(document:keyup.arrowleft)': 'previous()',
    '(document:keyup.arrowright)': 'next()'
  }
})
export class FullscreenImageViewerModal implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, @Input properties, local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private modalCtrl = inject(ModalController);
  private platformService = inject(PlatformService);

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
      return;
    }

    if (clamp) {
      const clamped = Math.min(Math.max(index, 0), length - 1);
      this.activeImageIndex.set(clamped);
      return;
    }

    const wrapped = ((index % length) + length) % length;
    this.activeImageIndex.set(wrapped);
  }

  private getToolbarHeight() {
    return Math.ceil(this.toolbar()?.nativeElement.getBoundingClientRect().bottom || 137);
  }

  private getImageTransform() {
    return `scale(${this.zoom()}) translate3d(${this.prevX()}px, ${this.prevY()}px, 0px) rotate(${this.angle()}deg)`;
  }
}
