import { Component, Inject, Input, OnInit } from '@angular/core';
import { DOCUMENT, NgIf } from '@angular/common';
import { PRIMARY_OUTLET, Router, RouterModule, UrlSegment, UrlTree } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

import { ReferenceDataService } from '@services/reference-data.service';


@Component({
    selector: 'modal-reference-data',
    templateUrl: './reference-data.modal.html',
    styleUrls: ['./reference-data.modal.scss'],
    imports: [NgIf, IonicModule, RouterModule]
})
export class ReferenceDataModal implements OnInit {
  @Input() origin: string = '';

  currentUrl: string = '';
  permaLinkTranslation: boolean = false;
  referenceData: any = null;
  thisPageTranslation: boolean = false;
  urnResolverUrl: string = '';

  constructor(
    private modalCtrl: ModalController,
    private referenceDataService: ReferenceDataService,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {
    // Check if these label translations exist
    this.thisPageTranslation = $localize`:@@Reference.ReferToThisPage:Hänvisa till denna sida` ? true : false;
    this.permaLinkTranslation = $localize`:@@Reference.Permalink:Beständig webbadress` ? true : false;
  }

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
