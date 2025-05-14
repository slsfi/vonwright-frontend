import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';


@Component({
  selector: 'illustrations',
  templateUrl: './illustrations.component.html',
  styleUrls: ['./illustrations.component.scss'],
  imports: [NgClass, IonicModule]
})
export class IllustrationsComponent implements OnChanges, OnInit {
  @Input() singleImage: Record<string, any> | undefined = undefined;
  @Input() textItemID: string = '';
  @Output() showAllImages: EventEmitter<any> = new EventEmitter();
  @Output() setMobileModeActiveText: EventEmitter<string> = new EventEmitter();
  
  imageCountTotal: number = 0;
  images: Array<any> = [];
  imagesCache: Array<any> = [];
  mobileMode: boolean = true;
  selectedImage: Array<string> = [];
  imgLoading: boolean = true;
  viewAll: boolean = true;

  constructor(
    private modalCtrl: ModalController,
    private parserService: HtmlParserService,
    private platformService: PlatformService,
    private scrollService: ScrollService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    for (const propName in changes) {
      if (changes.hasOwnProperty(propName)) {
        if (propName === 'singleImage') {
          if (
            !changes.singleImage.firstChange &&
            typeof this.singleImage !== 'undefined' &&
            this.singleImage
          ) {
            this.images = [];
            this.images.push(this.singleImage);
            this.viewAll = false;
          }
        }
      }
    }
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    if (this.textItemID) {
      this.getIllustrationImages();
    }
  }

  private getIllustrationImages() {
    this.parserService.getReadingTextIllustrations(this.textItemID).subscribe(
      (images: any[]) => {
        this.images = images;
        this.imageCountTotal = this.images.length;
        this.imagesCache = this.images;
        if (typeof this.singleImage !== 'undefined' && this.singleImage) {
          this.images = [];
          this.images.push(this.singleImage);
          this.viewAll = false;
        }
        this.imgLoading = false;
      }
    );
  }

  showSingleImage(image: any) {
    if (image) {
      this.viewAll = false;
      this.images = [image];
    } else {
      this.viewAllIllustrations();
    }
  }

  viewAllIllustrations() {
    this.viewAll = true;
    this.images = this.imagesCache;
    this.showAllImages.emit(null);
  }

  async zoomImage(imageSrc: string) {
    this.selectedImage = [imageSrc];

    const params = {
      activeImageIndex: 0,
      imageURLs: this.selectedImage
    };

    const illustrationZoomModal = await this.modalCtrl.create({
      component: FullscreenImageViewerModal,
      componentProps: params,
      cssClass: 'fullscreen-image-viewer-modal'
    });

    illustrationZoomModal.present();
  }

  scrollToPositionInText(image: any) {
    const imageSrc = image.src;
    let imageFilename = '';
    if (imageSrc) {
      imageFilename = imageSrc.substring(imageSrc.lastIndexOf('/') + 1);
      let target: HTMLElement | null = null;
      const readtextElem = document.querySelector(
        'page-text:not([ion-page-hidden]):not(.ion-page-hidden) reading-text'
      );
      try {
        if (image.class === 'doodle') {
          // Get the image filename without format and prepend tag_ to it
          let imageDataId = 'tag_' + imageFilename.substring(0, imageFilename.lastIndexOf('.'));
          target = readtextElem?.querySelector(`img.doodle[data-id="${imageDataId}"]`) as HTMLElement;
          if (target === null) {
            // Try dropping the prefix 'tag_' from image data-id as unknown pictograms don't have this
            imageDataId = imageDataId.replace('tag_', '');
            target = readtextElem?.querySelector(`img.doodle[data-id="${imageDataId}"]`) as HTMLElement;
          }
          if (
            target?.previousElementSibling
          ) {
            if (target.previousElementSibling.previousElementSibling?.classList.contains('ttNormalisations')) {
              // Change the scroll target from the doodle icon itself to the preceding word which the icon represents.
              target = target.previousElementSibling.previousElementSibling as HTMLElement;
            }
          } else if (target?.parentElement?.classList.contains('ttNormalisations')) {
            target = target.parentElement as HTMLElement;
          }
        } else {
          // Get the image element with src-attribute value ending in image filename
          const imageSrcFilename = '/' + imageFilename;
          target = readtextElem?.querySelector(`[src$="${imageSrcFilename}"]`) as HTMLElement;
        }

        if (target?.parentElement) {
          this.setMobileModeActiveText.emit('readingtext');
          if (image.class !== 'visible-illustration') {
            // Prepend arrow to the image/icon in the reading text and scroll into view
            const tmpImage: HTMLImageElement = new Image();
            tmpImage.src = 'assets/images/ms_arrow_right.svg';
            tmpImage.alt = 'ms arrow right image';
            tmpImage.classList.add('inl_ms_arrow');
            target.parentElement.insertBefore(tmpImage, target);
            
            if (this.mobileMode) {
              // In mobile mode the reading text view needs time to be made
              // visible before scrolling can start.
              setTimeout(() => {
                this.scrollService.scrollElementIntoView(tmpImage);
              }, 700);
            } else {
              this.scrollService.scrollElementIntoView(tmpImage);
            }
            setTimeout(() => {
              target?.parentElement?.removeChild(tmpImage);
            }, 5000);
          } else {
            if (this.mobileMode) {
              // In mobile mode the reading text view needs to be made
              // visible before scrolling can start.
              setTimeout(() => {
                this.scrollService.scrollElementIntoView(target, 'top');
              }, 700);
            } else {
              this.scrollService.scrollElementIntoView(target, 'top', 75);
            }
          }
        } else {
          console.log('Unable to find target when scrolling to image position in text, imageSrc:', imageSrc);
        }
      } catch (e) {
        console.log('Error scrolling to image position in text.');
      }
    } else {
      console.log('Empty src-attribute for image, unable to scroll to position in text.');
    }
  }

}
