import { Component, Inject, Input, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { DOCUMENT, NgFor, NgIf, NgStyle } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { IonicModule, ModalController } from '@ionic/angular';

import { config } from '@config';
import { IsExternalURLPipe } from '@pipes/is-external-url.pipe';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';


@Component({
  standalone: true,
  selector: 'pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss'],
  imports: [NgFor, NgIf, NgStyle, IonicModule, IsExternalURLPipe],
  host: {ngSkipHydration: 'true'}
})
export class PdfViewerComponent implements OnInit {
  @Input() pdfFileName: string = '';
  @ViewChild('downloadOptionsPopover') downloadOptionsPopover: any;
  
  downloadPopoverIsOpen: boolean = false;
  pdfData: Record<string, any> = {};
  pdfURL: SafeUrl;
  showURNButton: boolean = false;
  _window: Window | null = null;

  constructor(
    private modalController: ModalController,
    private sanitizer: DomSanitizer,
    @Inject(LOCALE_ID) private activeLocale: string,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.showURNButton = config.component?.epub?.showURNButton ?? false;
    this._window = <any>this.document.defaultView;
  }

  ngOnInit() {
    const availableEbooks: any[] = config.ebooks ?? [];
    for (const ebook of availableEbooks) {
      if (ebook.filename === this.pdfFileName) {
        this.pdfData = ebook;
        break;
      }
    }

    let pdfFilePath = (this._window?.location.origin ?? '')
          + (this._window?.location.pathname.split('/')[1] === this.activeLocale ? '/' + this.activeLocale : '')
          + '/assets/ebooks/'
          + this.pdfFileName;
    
    if (this.pdfData.externalFileURL) {
      pdfFilePath = this.pdfData.externalFileURL;
    }

    // console.log('Loading pdf from ', pdfFilePath);
    this.pdfURL = this.sanitizer.bypassSecurityTrustResourceUrl(pdfFilePath);
  }

  openDownloadPopover(event: any) {
    this.downloadOptionsPopover.event = event;
    this.downloadPopoverIsOpen = true;
  }

  closeDownloadPopover() {
    this.downloadPopoverIsOpen = false;
  }

  async showReference() {
    const modal = await this.modalController.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-ebook' }
    });
    modal.present();
  }

}
