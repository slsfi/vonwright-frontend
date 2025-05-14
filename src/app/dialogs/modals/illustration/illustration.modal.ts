import { Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
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
  @Input() imageNumber: string = '';

  imgPath: string = '';
  imgMetadata: Record<string, any> | undefined | null = undefined;

  constructor(
    private mediaCollectionService: MediaCollectionService,
    private modalCtrl: ModalController,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

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
      activeImageIndex: 0,
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
