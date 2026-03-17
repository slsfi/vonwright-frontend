import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PRIMARY_OUTLET, Router, RouterModule, UrlSegment, UrlTree } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

import { ReferenceData } from '@models/metadata.models';
import { ReferenceDataService } from '@services/reference-data.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'modal-reference-data',
  templateUrl: './reference-data.modal.html',
  styleUrls: ['./reference-data.modal.scss'],
  imports: [IonicModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferenceDataModal implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, @Input properties, local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);
  private modalCtrl = inject(ModalController);
  private referenceDataService = inject(ReferenceDataService);
  private router = inject(Router);
  private document = inject<Document>(DOCUMENT);

  @Input() origin: string = '';

  readonly thisPageTranslation: boolean = $localize`:@@Reference.ReferToThisPage:Hänvisa till denna sida` ? true : false;
  readonly permaLinkTranslation: boolean = $localize`:@@Reference.Permalink:Beständig webbadress` ? true : false;

  currentUrl = signal<string>('');
  referenceData = signal<ReferenceData | null>(null);
  urnResolverUrl = signal<string>('');

  referenceText = computed<string>(() => {
    const data = this.referenceData();
    if (!data?.reference_text) {
      return '';
    }

    if (data.urn) {
      return data.reference_text + ', ' + this.urnResolverUrl() + data.urn;
    }

    return this.currentUrl() ? data.reference_text + ', ' + this.currentUrl() : data.reference_text;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle wiring
  // ─────────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    // Get URL to use for resolving URNs
    this.urnResolverUrl.set(this.referenceDataService.getUrnResolverUrl());

    this.currentUrl.set(this.document.defaultView?.location.href.split('?')[0] || '');
    const currentUrlTree: UrlTree = this.router.parseUrl(this.router.url);
    const currentUrlSegments: UrlSegment[] = currentUrlTree?.root?.children[PRIMARY_OUTLET]?.segments;

    if (currentUrlSegments?.length) {
      this.referenceDataService.getReferenceData(currentUrlSegments).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((data: ReferenceData | null) => {
        this.referenceData.set(data);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────
  dismiss() {
    this.modalCtrl.dismiss();
  }
}
