import { ChangeDetectionStrategy, Component, DOCUMENT, LOCALE_ID, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgStyle } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { map } from 'rxjs';

import { config } from '@config';
import { IsExternalURLPipe } from '@pipes/is-external-url.pipe';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { Ebook } from '@models/ebook.models';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss'],
  imports: [NgStyle, IonicModule, IsExternalURLPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: 'true' }
})
export class PdfViewerComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private modalController = inject(ModalController);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private activeLocale = inject(LOCALE_ID);
  private document = inject<Document>(DOCUMENT);

  readonly pdfFileName = input<string>('');
  readonly downloadOptionsPopover = viewChild<any>('downloadOptionsPopover');

  private readonly availableEbooks: Ebook[] = config.ebooks ?? [];
  readonly showURNButton: boolean = config.component?.epub?.showURNButton ?? false;

  downloadPopoverIsOpen = signal<boolean>(false);
  _window: Window | null = <any>this.document.defaultView;

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computeds (pure, no side-effects)
  // ─────────────────────────────────────────────────────────────────────────────
  pdfData = computed<Ebook | undefined>(() => {
    const pdfFileName = this.pdfFileName();
    return this.availableEbooks.find(ebook => ebook.filename === pdfFileName);
  });

  pdfFilePath = computed<string | undefined>(() => {
    const pdfData = this.pdfData();
    if (pdfData === undefined) return undefined;

    return pdfData.externalFileURL
          ? pdfData.externalFileURL
          : (
              (this._window?.location.origin ?? '')
              + (
                  this._window?.location.pathname.split('/')[1] === this.activeLocale
                  ? '/' + this.activeLocale : ''
                )
              + '/assets/ebooks/' + pdfData.filename
            );
  });

  params = toSignal(
    this.route.queryParamMap.pipe(
      map(paramMap => {
        // Check if 'page' queryParam set to display a specific
        // page in the PDF
        const pageParam: string | null = paramMap.get('page');
        const pageNumber: number | null = pageParam
              ? parseInt(pageParam, 10)
              : null;

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

        return { pageNumber, pdfParams };
      })
    )
  );

  pageNumber = computed<number | null>(() => this.params()?.pageNumber ?? null);

  pdfURL = computed<SafeResourceUrl | undefined>(() => {
    const filePath = this.pdfFilePath();
    const params = this.params();
    return filePath && params
          ? this.sanitizer.bypassSecurityTrustResourceUrl(filePath + params.pdfParams)
          : undefined;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────

  openDownloadPopover(event: any) {
    const popover = this.downloadOptionsPopover();
    if (popover) {
      popover.event = event;
      this.downloadPopoverIsOpen.set(true);
    }
  }

  closeDownloadPopover() {
    this.downloadPopoverIsOpen.set(false);
  }

  async showReference() {
    const modal = await this.modalController.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'page-ebook' }
    });
    modal.present();
  }

}
