import { Component, HostListener, Input, OnInit } from '@angular/core';
import { NgIf, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

import { DraggableImageDirective } from '@directives/draggable-image.directive';
import { PlatformService } from '@services/platform.service';
import { isBrowser } from '@utility-functions';


@Component({
    selector: 'modal-fullscreen-image-viewer',
    templateUrl: './fullscreen-image-viewer.modal.html',
    styleUrls: ['./fullscreen-image-viewer.modal.scss'],
    imports: [NgIf, NgStyle, FormsModule, IonicModule, DraggableImageDirective]
})
export class FullscreenImageViewerModal implements OnInit {
  @Input() activeImageIndex: number = 0;
  @Input() backsides: any[] = [];
  @Input() imageDescriptions: string[] = [];
  @Input() imageTitles: string[] = [];
  @Input() imageURLs: string[] = [];

  angle: number = 0;
  inputImageNumber: number = 1;
  mobileMode: boolean = false;
  prevX: number = 0;
  prevY: number = 0;
  showDescription: boolean = true;
  showBackside: boolean = false;
  toolbarHeight: number = 0;
  zoom: number = 1.0;

  constructor(
    private modalCtrl: ModalController,
    private platformService: PlatformService
  ) {}

  @HostListener('document:keyup.arrowleft') onKeyArrowLeft() {
    this.previous();
  }

  @HostListener('document:keyup.arrowright') onKeyArrowRight() {
    this.next();
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    // Append dot to image titles
    if (this.imageTitles.length > 0) {
      for (let x = 0; x < this.imageTitles.length; x++) {
        if (
          this.imageTitles[x] &&
          this.imageTitles[x] !== 'null'
        ) {
          if (
            this.imageTitles[x].slice(-1) !== '.' &&
            this.imageTitles[x].slice(-1) !== '!' &&
            this.imageTitles[x].slice(-1) !== ':'
          ) {
            this.imageTitles[x] = this.imageTitles[x].trim() + '.';
          }
        }
      }
    }

    if (this.activeImageIndex < 0 || this.activeImageIndex > this.imageURLs.length - 1) {
      this.activeImageIndex = 0;
    }

    this.inputImageNumber = this.activeImageIndex + 1;
  }

  ionViewDidEnter() {
    if (isBrowser()) {
      this.toolbarHeight = this.getToolbarHeight();
    }
  }

  closeModal() {
    return this.modalCtrl.dismiss(this.inputImageNumber, 'imageNr');
  }

  previous() {
    this.activeImageIndex = this.activeImageIndex - 1;
    this.checkImageIndexValidity();
  }

  next() {
    this.activeImageIndex = this.activeImageIndex + 1;
    this.checkImageIndexValidity();
  }

  private checkImageIndexValidity() {
    if (this.activeImageIndex < 0) {
      this.activeImageIndex = this.imageURLs.length - 1;
      this.inputImageNumber = this.imageURLs.length;
    } else if (this.activeImageIndex > this.imageURLs.length - 1) {
      this.activeImageIndex = 0;
    }
    this.inputImageNumber = this.activeImageIndex + 1;
    
    if (isBrowser()) {
      setTimeout(() => {
        this.toolbarHeight = this.getToolbarHeight();
      }, 500);
    }
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
    if ( this.angle >= 360 ) {
      this.angle = 0;
    }
  }

  reset() {
    this.zoom = 1.0;
    this.angle = 0;
    this.prevX = 0;
    this.prevY = 0;
  }

  zoomWithMouseWheel(event: any) {
    if (event.target) {
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
      event.target.style.transform = 'scale('+this.zoom+') translate3d('+this.prevX+'px, '+this.prevY+'px, 0px) rotate('+this.angle+'deg)';
    }
  }

  setImageCoordinates(coordinates: number[]) {
    this.prevX = coordinates[0];
    this.prevY = coordinates[1];
  }

  toggleImageDescription() {
    this.showDescription = !this.showDescription;
    if (isBrowser()) {
      setTimeout(() => {
        this.toolbarHeight = this.getToolbarHeight();
      }, 500);
    }
  }

  setImageNr(event: any) {
    if (this.inputImageNumber < 1) {
      this.inputImageNumber = 1;
    } else if (this.inputImageNumber > this.imageURLs.length) {
      this.inputImageNumber = this.imageURLs.length;
    }
    this.activeImageIndex = this.inputImageNumber - 1;
  }

  getBacksideUrl(frontsideUrl: any) {
    return frontsideUrl.replace('.jpg', 'B.jpg');
  }

  private getToolbarHeight() {
    const toolbarElem = document.querySelector('.facsimile-button-group');
    return Math.ceil(toolbarElem?.getBoundingClientRect().bottom || 137);
  }

}
