import { Component, Inject, Input, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { AsyncPipe, DOCUMENT, NgFor, NgIf, NgStyle } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { map, Observable } from 'rxjs';

import { config } from '@config';
import { IsExternalURLPipe } from '@pipes/is-external-url.pipe';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';


@Component({
    selector: 'pdf-viewer',
    templateUrl: './pdf-viewer.component.html',
    styleUrls: ['./pdf-viewer.component.scss'],
    imports: [AsyncPipe, NgFor, NgIf, NgStyle, IonicModule, IsExternalURLPipe],
    host: { ngSkipHydration: 'true' }
})
export class PdfViewerComponent implements OnInit {
  @Input() pdfFileName: string = '';
  @ViewChild('downloadOptionsPopover') downloadOptionsPopover: any;
  
  downloadPopoverIsOpen: boolean = false;
  pageNumber: number | null = null;
  pdfData: Record<string, any> = {};
  pdfURL$: Observable<SafeResourceUrl | undefined>;
  showURNButton: boolean = false;
  _window: Window | null = null;

  constructor(
    private modalController: ModalController,
    private route: ActivatedRoute,
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

    const pdfFilePath = this.pdfData.externalFileURL
          ? this.pdfData.externalFileURL
          : (
              (this._window?.location.origin ?? '')
              + (
                  this._window?.location.pathname.split('/')[1] === this.activeLocale
                  ? '/' + this.activeLocale : ''
                )
              + '/assets/ebooks/' + this.pdfFileName
            );

    this.pdfURL$ = this.route.queryParamMap.pipe(
      map(paramMap => {
        // Check if 'page' queryParam set to display a specific
        // page in the PDF
        let pageNumber: number | null = null;
        const pageParam: string | null = paramMap.get('page');
        if (pageParam) {
          pageNumber = parseInt(pageParam, 10);  
        }
        this.pageNumber = pageNumber;

        // Check if 'q' queryParams set to highlight search terms
        // in the PDF
        const searchTerm: string = paramMap.getAll('q').join(' ');

        let pdfParams: string = pageNumber || searchTerm ? '#' : '';
        if (pdfParams) {
          if (pageNumber) {
            pdfParams += 'page=' + pageNumber;
            if (searchTerm) {
              pdfParams += '&'
            }
          }
          if (searchTerm) {
            pdfParams += 'search=' + searchTerm;
          }
        }

        return this.sanitizer.bypassSecurityTrustResourceUrl(pdfFilePath + pdfParams);
      })
    );
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
