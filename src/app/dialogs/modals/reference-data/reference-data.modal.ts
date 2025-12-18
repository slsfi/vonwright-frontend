import { Component, Input, OnInit, DOCUMENT, inject } from '@angular/core';

import { PRIMARY_OUTLET, Router, RouterModule, UrlSegment, UrlTree } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

import { ReferenceDataService } from '@services/reference-data.service';


@Component({
  selector: 'modal-reference-data',
  templateUrl: './reference-data.modal.html',
  styleUrls: ['./reference-data.modal.scss'],
  imports: [IonicModule, RouterModule]
})
export class ReferenceDataModal implements OnInit {
  private modalCtrl = inject(ModalController);
  private referenceDataService = inject(ReferenceDataService);
  private router = inject(Router);
  private document = inject<Document>(DOCUMENT);

  @Input() origin: string = '';

  readonly thisPageTranslation: boolean = $localize`:@@Reference.ReferToThisPage:Hänvisa till denna sida` ? true : false;
  readonly permaLinkTranslation: boolean = $localize`:@@Reference.Permalink:Beständig webbadress` ? true : false;

  currentUrl: string = '';
  referenceData: any = null;
  urnResolverUrl: string = '';

  ngOnInit() {
    // Get URL to use for resolving URNs
    this.urnResolverUrl = this.referenceDataService.getUrnResolverUrl();

    this.currentUrl = this.document.defaultView?.location.href.split('?')[0] || '';
    const currentUrlTree: UrlTree = this.router.parseUrl(this.router.url);
    const currentUrlSegments: UrlSegment[] = currentUrlTree?.root?.children[PRIMARY_OUTLET]?.segments;
    
    if (currentUrlSegments?.length) {
      this.referenceDataService.getReferenceData(currentUrlSegments).subscribe(
        (data: any) => {
          this.referenceData = data;
        }
      );
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

}
