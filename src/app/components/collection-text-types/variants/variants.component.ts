import { Component, ElementRef, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AlertButton, AlertController, AlertInput, IonicModule } from '@ionic/angular';

import { config } from '@config';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


@Component({
  selector: 'variants',
  templateUrl: './variants.component.html',
  styleUrls: ['./variants.component.scss'],
  imports: [IonicModule, TrustHtmlPipe]
})
export class VariantsComponent implements OnInit {
  @Input() searchMatches: Array<string> = [];
  @Input() sortOrder: number | undefined = undefined;
  @Input() textItemID: string = '';
  @Input() varID: number | undefined = undefined;
  @Output() openNewLegendView: EventEmitter<any> = new EventEmitter();
  @Output() openNewVarView: EventEmitter<any> = new EventEmitter();
  @Output() selectedVarID = new EventEmitter<number>();
  @Output() selectedVarName = new EventEmitter<string>();
  @Output() selectedVarSortOrder = new EventEmitter<number>();

  intervalTimerId: number = 0;
  selectedVariant: any = undefined;
  showOpenLegendButton: boolean = false;
  text: string = '';
  variants: any[] = [];

  constructor(
    private alertCtrl: AlertController,
    private collectionContentService: CollectionContentService,
    private elementRef: ElementRef,
    private parserService: HtmlParserService,
    private scrollService: ScrollService,
    public viewOptionsService: ViewOptionsService
  ) {
    this.showOpenLegendButton = config.component?.variants?.showOpenLegendButton ?? false;
  }

  ngOnInit() {
    if (this.textItemID) {
      this.loadVariantTexts();
    }
  }

  loadVariantTexts() {
    this.collectionContentService.getVariants(this.textItemID).subscribe({
      next: (res) => {
        if (res?.variations?.length > 0) {
          this.variants = res.variations;
          this.setVariant();
          if (this.searchMatches.length) {
            this.scrollService.scrollToFirstSearchMatch(this.elementRef.nativeElement, this.intervalTimerId);
          }
        } else {
          this.text = $localize`:@@Variants.None:Inga tryckta varianter tillgängliga.`;
        }
      },
      error: (e) => {
        console.error(e);
        this.text = $localize`:@@Variants.Error:Ett fel har uppstått. Varianter kunde inte laddas.`
      }
    });
  }

  setVariant() {
    if (this.varID) {
      const inputVariant = this.variants.filter((item: any) => {
        return (item.id === this.varID);
      })[0];
      this.selectedVariant = inputVariant ? inputVariant : this.variants[0];
    } else if (this.sortOrder) {
      const inputVariant = this.variants.filter((item: any) => {
        return (item.sort_order === this.sortOrder);
      })[0];
      this.selectedVariant = inputVariant ? inputVariant : this.variants[0];
    } else {
      this.selectedVariant = this.variants[0];
    }
    this.emitOutputValues(this.selectedVariant);
    this.changeVariant();
  }

  changeVariant(variant?: any) {
    if (
      variant &&
      this.selectedVariant?.id !== variant.id
    ) {
      this.selectedVariant = variant;
      this.emitOutputValues(this.selectedVariant);
    }
    if (this.selectedVariant) {
      let text = this.parserService.postprocessVariantText(this.selectedVariant.content);
      this.text = this.parserService.insertSearchMatchTags(text, this.searchMatches);
    }
  }

  async selectVariant(event: any) {
    const inputs = [] as AlertInput[];
    const buttons = [] as AlertButton[];

    this.variants.forEach((variant: any, index: any) => {
      let checkedValue = false;

      if (this.selectedVariant.id === variant.id) {
        checkedValue = true;
      }

      inputs.push({
        type: 'radio',
        label: variant.name,
        value: index,
        checked: checkedValue
      });
    });

    buttons.push({ text: $localize`:@@BasicActions.Cancel:Avbryt` });
    buttons.push({
      text: $localize`:@@BasicActions.Ok:Ok`,
      handler: (index: any) => {
        this.changeVariant(this.variants[parseInt(index)]);
      }
    });

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Variants.SelectVariantDialogTitle:Välj variant`,
      subHeader:  $localize`:@@Variants.SelectVariantDialogSubtitle:Varianten ersätter den variant som visas i kolumnen där du klickade.`,
      cssClass: 'custom-select-alert',
      buttons: buttons,
      inputs: inputs
    });    

    await alert.present();
  }

  async selectVariantForNewView() {
    const inputs = [] as AlertInput[];
    const buttons = [] as AlertButton[];

    this.variants.forEach((variant: any, index: any) => {
      inputs.push({
        type: 'radio',
        label: variant.name,
        value: index
      });
    });

    buttons.push({ text: $localize`:@@BasicActions.Cancel:Avbryt` });
    buttons.push({
      text: $localize`:@@BasicActions.Ok:Ok`,
      handler: (index: any) => {
        this.openVariationInNewView(this.variants[parseInt(index)]);
      }
    });

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Variants.OpenNewVariantDialogTitle:Välj variant`,
      subHeader:  $localize`:@@Variants.OpenNewVariantDialogSubtitle:Varianten öppnas i en ny kolumn.`,
      cssClass: 'custom-select-alert',
      buttons: buttons,
      inputs: inputs
    });

    await alert.present();
  }

  emitOutputValues(variant: any) {
    // Emit the var id so the collection text page can update queryParams
    this.emitSelectedVariantId(variant.id);
    // Emit the var sort_order so the collection text page can update queryParams
    this.emitSelectedVariantSortOrder(variant.sort_order);
    // Emit the var name so the collection text page can display it in the column header
    this.emitSelectedVariantName(variant.name);
  }

  emitSelectedVariantId(id: number) {
    if (this.variants.length > 1) {
      this.selectedVarID.emit(id);
    }
  }

  emitSelectedVariantName(name: string) {
    if (this.variants.length > 1) {
      this.selectedVarName.emit(name);
    }
  }

  emitSelectedVariantSortOrder(order: number) {
    if (this.variants.length > 1) {
      this.selectedVarSortOrder.emit(order);
    }
  }

  openNewVar(event: Event, id: any) {
    event.preventDefault();
    event.stopPropagation();
    id.viewType = 'variants';
    this.openNewVarView.emit(id);
  }

  openVariationInNewView(variant?: any) {
    variant.viewType = 'variants';
    this.openNewVarView.emit(variant);
  }

  /*
  openAllVariations() {
    this.variants.forEach((variant: any) => {
      if (this.selectedVariant.id !== variant.id) {
        variant.viewType = 'variants';
        this.openNewVarView.emit(variant);
      }
    });
  }
  */

  openNewLegend(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const id = {
      viewType: 'legend',
      id: 'var-legend'
    }
    this.openNewLegendView.emit(id);
  }

}
