import { ChangeDetectionStrategy, Component, DestroyRef, Input, LOCALE_ID, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

import { config } from '@config';
import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { MediaCollectionService } from '@services/media-collection.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'modal-illustration',
  templateUrl: './illustration.modal.html',
  styleUrls: ['./illustration.modal.scss'],
  imports: [RouterModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IllustrationModal implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, @Input properties, local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);
  private mediaCollectionService = inject(MediaCollectionService);
  private modalCtrl = inject(ModalController);
  private activeLocale = inject(LOCALE_ID);

  @Input() imageNumber: string = '';

  imgPath = signal<string>('');
  imgMetadata = signal<Record<string, any> | undefined | null>(undefined);

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle wiring
  // ─────────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.getImageMetadata();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────
  async zoomImage() {
    const params = {
      startImageIndex: 0,
      imageURLs: [this.imgPath()]
    };

    const modal = await this.modalCtrl.create({
      component: FullscreenImageViewerModal,
      componentProps: params,
      cssClass: 'fullscreen-image-viewer-modal'
    });

    await modal.present();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────────
  private getImageMetadata() {
    this.mediaCollectionService.getMediaMetadata(this.imageNumber, this.activeLocale).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((data: any) => {
      this.imgMetadata.set(data);

      if (data?.media_collection_id && data?.image_filename_front) {
        this.imgPath.set(
          config.app.backendBaseURL + '/'
          + config.app.projectNameDB + '/gallery/get/'
          + data.media_collection_id + '/'
          + data.image_filename_front
        );
      }
    });
  }
}
