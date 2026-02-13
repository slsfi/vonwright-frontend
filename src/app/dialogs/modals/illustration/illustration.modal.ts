import { Component, Input, LOCALE_ID, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { MediaCollectionService } from '@services/media-collection.service';
import { config } from '@config';


@Component({
  selector: 'modal-illustration',
  templateUrl: './illustration.modal.html',
  styleUrls: ['./illustration.modal.scss'],
  imports: [RouterModule, IonicModule]
})
export class IllustrationModal implements OnInit {
  private mediaCollectionService = inject(MediaCollectionService);
  private modalCtrl = inject(ModalController);
  private activeLocale = inject(LOCALE_ID);

  @Input() imageNumber: string = '';

  imgPath: string = '';
  imgMetadata: Record<string, any> | undefined | null = undefined;

  ngOnInit() {
    this.getImageMetadata();
  }

  private getImageMetadata() {
    this.mediaCollectionService.getMediaMetadata(this.imageNumber, this.activeLocale).subscribe(
      (data: any) => {
        this.imgMetadata = data;
        if (data?.media_collection_id && data?.image_filename_front) {
          this.imgPath = config.app.backendBaseURL + '/'
          + config.app.projectNameDB + '/gallery/get/'
          + data.media_collection_id + '/'
          + data.image_filename_front;
        }
      }
    );
  }

  async zoomImage() {
    const params = {
      startImageIndex: 0,
      imageURLs: [this.imgPath]
    };

    const modal = await this.modalCtrl.create({
      component: FullscreenImageViewerModal,
      componentProps: params,
      cssClass: 'fullscreen-image-viewer-modal'
    });
    modal.present();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

}
