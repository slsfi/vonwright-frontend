import { ChangeDetectionStrategy, Component, DestroyRef, Injector, effect, inject, input, output, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertButton, AlertController, AlertInput, IonicModule, ModalController } from '@ionic/angular';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';

import { config } from '@config';
import { DraggableImageDirective } from '@directives/draggable-image.directive';
import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { ExternalFacsimile, Facsimile, FacsimileApi, toExternalFacsimile, toFacsimile } from '@models/facsimile.models';
import { TextKey } from '@models/collection.models';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { PlatformService } from '@services/platform.service';
import { sortArrayOfObjectsNumerically } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'facsimiles',
  templateUrl: './facsimiles.component.html',
  styleUrls: ['./facsimiles.component.scss'],
  imports: [NgStyle, FormsModule, IonicModule, DraggableImageDirective, TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FacsimilesComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private alertCtrl = inject(AlertController);
  private collectionContentService = inject(CollectionContentService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private modalCtrl = inject(ModalController);
  private platformService = inject(PlatformService);

  readonly facsID = input<number | undefined>();
  readonly imageNr = input<number | undefined>();
  readonly sortOrder = input<number | undefined>();
  readonly textKey = input.required<TextKey>();

  readonly selectedFacsID = output<number>();
  readonly selectedFacsName = output<string>();
  readonly selectedImageNr = output<number | null>();
  readonly selectedFacsSortOrder = output<number | null>();

  readonly facsSize: number | null = config.component?.facsimiles?.imageQuality ?? 1;
  readonly facsURLAlternate: string = config.app?.alternateFacsimileBaseURL ?? '';
  readonly replaceImageAssetsPaths: boolean = config.collections?.replaceImageAssetsPaths ?? true;
  readonly showTitle: boolean = config.component?.facsimiles?.showTitle ?? true;

  angle: number = 0;
  facsNumber: number = 1;
  mobileMode: boolean = this.platformService.isMobile();
  numberOfImages: number = 0;
  prevX: number = 0;
  prevY: number = 0;
  zoom: number = 1.0;

  externalFacsimiles = signal<ExternalFacsimile[]>([]);
  facsimiles = signal<Facsimile[]>([]);
  facsURLDefault = signal<string>('');                 // base URL for images
  loading = signal(true);
  selectedFacsimile = signal<Facsimile | null>(null);  // current "internal" facsimile
  selectedIsExternal = signal<boolean>(false);
  statusMessage = signal<string | null>(null);         // "None" / "Error"


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire side-effects (load, outputs)
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.loadFacsimiles();
    this.registerOutputEmissions();
  }

  private loadFacsimiles() {
    toObservable(this.textKey).pipe(
      tap(() => {
        // reset before load
        this.loading.set(true);
        this.statusMessage.set(null);
        this.facsimiles.set([]);
        this.externalFacsimiles.set([]);
        this.selectedIsExternal.set(false);
        this.selectedFacsimile.set(null);
        this.facsURLDefault.set('');
        this.numberOfImages = 0;
      }),
      switchMap((tk: TextKey) =>
        this.collectionContentService.getFacsimiles(tk).pipe(
          catchError(err => {
            console.error(err);
            this.statusMessage.set($localize`:@@Facsimiles.Error:Ett fel har uppstått. Faksimil kunde inte hämtas.`);
            // keep internal list empty, external empty
            return of<FacsimileApi[]>([]);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((items: FacsimileApi[]) => {
      // split into internal/external facsimiles
      const tk = this.textKey();
      const sectionId = tk.chapterID?.replace('ch', '') || '';

      const internals: Facsimile[] = [];
      const externals: ExternalFacsimile[] = [];

      for (const f of items) {
        if (f.external_url && !f.folder_path) {
          const extFac = toExternalFacsimile(f);

          if (sectionId !== '') {
            if (String(f.section_id) === sectionId) {
              externals.push(extFac);
            }
          } else {
            externals.push(extFac);
          }
        } else {
          const fac = toFacsimile(f);

          if (sectionId !== '') {
            if (String(f.section_id) === sectionId) {
              internals.push(fac);
            }
          } else {
            internals.push(fac);
          }
        }
      }

      if (internals.length > 1) {
        sortArrayOfObjectsNumerically(internals, 'priority', 'asc');
      }
      if (externals.length > 1) {
        sortArrayOfObjectsNumerically(externals, 'priority', 'asc');
      }

      this.externalFacsimiles.set(externals);
      this.facsimiles.set(internals);
      this.loading.set(false);

      if (internals.length === 0 && externals.length === 0) {
        this.statusMessage.set($localize`:@@Facsimiles.None:Inga faksimil tillgängliga.`);
        return;
      }

      // Apply selection of initial facsimile
      this.applyInitialSelection();
    });
  }

  private registerOutputEmissions() {
    // Emit outputs when a new facsimile becomes selected
    effect(() => {
      const facs = this.facsimiles();
      const extF = this.externalFacsimiles();
      const isExternal = this.selectedIsExternal();
      const fac = this.selectedFacsimile();

      // selected facsimile id/name (+ sort order when meaningful)
      if (isExternal) {
        this.selectedFacsID.emit(0);
        this.selectedFacsSortOrder.emit(null);
        this.selectedImageNr.emit(null);
        if (facs.length > 0) {
          this.selectedFacsName.emit($localize`:@@Facsimiles.ExternalFacsimiles:Externa faksimil`);
        }
        return;
      }

      if (fac) {
        // emit name only if multiple internals or (one internal +
        // at least one external)
        const shouldEmitName = (facs.length > 1) || (facs.length === 1 && extF.length > 0);
        this.selectedFacsID.emit(fac.facsimile_id);
        if (shouldEmitName) {
          this.selectedFacsName.emit(fac.title);
        }

        if (extF.length < 1 && facs.length > 1) {
          this.selectedFacsSortOrder.emit(fac.priority);
        } else {
          this.selectedFacsSortOrder.emit(null);
        }

        // image number emit: only if multiple pages
        if (this.numberOfImages > 1) {
          this.selectedImageNr.emit(this.facsNumber);
        } else {
          this.selectedImageNr.emit(null);
        }
      }
    }, { injector: this.injector });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Selection helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private applyInitialSelection() {
    const internals = this.facsimiles() ?? [];
    const externals = this.externalFacsimiles();

    if (internals.length > 0) {
      const byInputId = this.facsID();
      const bySort = this.sortOrder();

      if (byInputId !== undefined && byInputId > 0) {
        const found = internals.find(i => i.facsimile_id === byInputId) ?? internals[0];
        this.initializeDisplayedFacsimile(found, this.imageNr());
        return;
      }

      if (bySort !== undefined) {
        const found = internals.find(i => i.priority === bySort) ?? internals[0];
        this.initializeDisplayedFacsimile(found, this.imageNr());
        return;
      }

      // Otherwise: choose external if present & either (facsID < 1)
      // or external has higher priority than first internal
      if (
        externals.length > 0 &&
        (
          (byInputId !== undefined && byInputId < 1) ||
          (externals[0].priority < internals[0].priority)
        )
      ) {
        this.chooseExternal();
        return;
      }

      // Default: first internal
      this.initializeDisplayedFacsimile(internals[0], this.imageNr());
      return;
    }

    // Only externals available
    if (externals.length > 0) {
      this.chooseExternal();
    }
  }

  private chooseExternal() {
    this.selectedIsExternal.set(true);
    this.selectedFacsimile.set(null);
    this.numberOfImages = 0;
  }

  private initializeDisplayedFacsimile(facs: Facsimile, initialImageNr?: number) {
    this.selectedIsExternal.set(false);
    this.selectedFacsimile.set(facs);

    // default image base URL for internal images
    const base = `${config.app.backendBaseURL}/${config.app.projectNameDB}/facsimiles/${facs.publication_facsimile_collection_id}/`;
    this.facsURLDefault.set(base);

    // pages & current page number (clamped)
    this.numberOfImages = facs.number_of_pages;

    const start = (initialImageNr !== undefined) ? initialImageNr : facs.page;
    this.facsNumber = Math.max(1, Math.min(this.numberOfImages || 1, start || 1));
  }

  private changeFacsimile(isExternal: boolean, facs?: Facsimile) {
    if (isExternal) {
      this.chooseExternal();
    } else if (facs) {
      this.initializeDisplayedFacsimile(facs);
      this.reset();
    }
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // UI actions
  // ─────────────────────────────────────────────────────────────────────────────

  async presentSelectFacsimileAlert() {
    const internals = this.facsimiles() ?? [];
    const externals = this.externalFacsimiles();

    const inputs: AlertInput[] = [];

    if (externals.length > 0) {
      inputs.push({
        type: 'radio',
        label: $localize`:@@Facsimiles.ExternalFacsimiles:Externa faksimil`,
        value: '-1',
        checked: this.selectedIsExternal(),
      });
    }

    const sel = this.selectedFacsimile();
    internals.forEach((fac, index) => {
      const checked =
        !this.selectedIsExternal() &&
        sel &&
        sel.facsimile_id === fac.facsimile_id &&
        ((sel.page === undefined) || sel.page === fac.page);

      inputs.push({
        type: 'radio',
        label: fac.title.replace(/(<([^>]+)>)/gi, ''),
        value: String(index),
        checked: checked ?? undefined,
      });
    });

    const buttons: AlertButton[] = [
      { text: $localize`:@@BasicActions.Cancel:Avbryt` },
      {
        text: $localize`:@@BasicActions.Ok:Ok`,
        handler: (value: string) => {
          const idx = Number(value);
          if (Number.isNaN(idx)) {
            return;
          }

          if (idx < 0) {
            this.changeFacsimile(true);
          } else {
            const fac = internals[idx];
            if (fac) this.changeFacsimile(false, fac);
          }
        },
      },
    ];

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Facsimiles.SelectFacsDialogTitle:Välj faksimil`,
      subHeader: $localize`:@@Facsimiles.SelectFacsDialogSubtitle:Faksimilet ersätter det faksimil som visas i kolumnen där du klickade.`,
      cssClass: 'custom-select-alert',
      inputs,
      buttons,
    });

    alert.present();
  }

  async openFullScreen() {
    if (this.selectedIsExternal() || !this.selectedFacsimile()) {
      return;
    }

    const fac = this.selectedFacsimile()!;
    const fullscreenImageSize = config.modal?.fullscreenImageViewer?.imageQuality || this.facsSize;

    const imageURLs: string[] = [];
    for (let i = 1; i <= this.numberOfImages; i++) {
      const url = this.facsURLAlternate
        ? `${this.facsURLAlternate}/${fac.publication_facsimile_collection_id}/${fullscreenImageSize}/${i}.jpg`
        : `${this.facsURLDefault()}${i}${fullscreenImageSize ? '/' + fullscreenImageSize : ''}`;
      imageURLs.push(url);
    }

    const modal = await this.modalCtrl.create({
      component: FullscreenImageViewerModal,
      componentProps: {
        activeImageIndex: this.facsNumber - 1,
        imageURLs,
      },
      cssClass: 'fullscreen-image-viewer-modal',
    });

    modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'imageNr' && data) {
      this.facsNumber = data;
      this.setImageNr();
    }
  }

  setImageNr() {
    if (this.facsNumber < 1) {
      this.facsNumber = 1;
    } else if (this.numberOfImages && this.facsNumber > this.numberOfImages) {
      this.facsNumber = this.numberOfImages;
    }

    this.selectedImageNr.emit(this.facsNumber);
  }

  previous() {
    if (!this.numberOfImages) {
      return;
    }
    this.facsNumber = this.facsNumber > 1 ? this.facsNumber - 1 : this.numberOfImages;
    this.selectedImageNr.emit(this.facsNumber);
  }

  next() {
    if (!this.numberOfImages) {
      return;
    }
    this.facsNumber = this.facsNumber < this.numberOfImages ? this.facsNumber + 1 : 1;
    this.selectedImageNr.emit(this.facsNumber);
  }

  zoomIn() {
    this.zoom = this.zoom + 0.1;
  }

  zoomOut() {
    this.zoom = this.zoom - 0.1;
    if (this.zoom < 0.5) {
      this.zoom = 0.5;
    }
  }

  rotate() {
    this.angle += 90;
    if (this.angle >= 360) {
      this.angle = 0;
    }
  }

  reset() {
    this.zoom = 1.0;
    this.angle = 0;
    this.prevX = 0;
    this.prevY = 0;
  }

  zoomWithMouseWheel(img: HTMLImageElement, event: WheelEvent) {
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }

    img.style.transform =
      `scale(${this.zoom}) translate3d(${this.prevX}px, ${this.prevY}px, 0px) rotate(${this.angle}deg)`;
  }

  setImageCoordinates(coords: number[]) {
    this.prevX = coords[0] ?? 0;
    this.prevY = coords[1] ?? 0;
  }

}
