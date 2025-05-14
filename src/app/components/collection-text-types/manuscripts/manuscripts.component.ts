import { Component, ElementRef, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AlertButton, AlertController, AlertInput, IonicModule } from '@ionic/angular';

import { config } from '@config';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


@Component({
  selector: 'manuscripts',
  templateUrl: './manuscripts.component.html',
  styleUrls: ['./manuscripts.component.scss'],
  imports: [IonicModule, TrustHtmlPipe]
})
export class ManuscriptsComponent implements OnInit {
  @Input() msID: number | undefined = undefined;
  @Input() searchMatches: string[] = [];
  @Input() textItemID: string = '';
  @Output() openNewLegendView = new EventEmitter<any>();
  @Output() openNewManView = new EventEmitter<any>();
  @Output() selectedMsID = new EventEmitter<number>();
  @Output() selectedMsName = new EventEmitter<string>();

  intervalTimerId: number = 0;
  manuscripts: any[] = [];
  selectedManuscript: any = undefined;
  showNormalizedMs: boolean = false;
  showNormalizedToggle: boolean = true;
  showOpenLegendButton: boolean = false;
  showTitle: boolean = true;
  text: string = '';
  textLanguage: string = '';

  constructor(
    private alertCtrl: AlertController,
    private collectionContentService: CollectionContentService,
    private elementRef: ElementRef,
    private parserService: HtmlParserService,
    private scrollService: ScrollService,
    public viewOptionsService: ViewOptionsService
  ) {
    this.showNormalizedToggle = config.component?.manuscripts?.showNormalizedToggle ?? true;
    this.showOpenLegendButton = config.component?.manuscripts?.showOpenLegendButton ?? false;
    this.showTitle = config.component?.manuscripts?.showTitle ?? true;
  }

  ngOnInit() {
    if (this.textItemID) {
      this.loadManuscriptTexts();
    }
  }

  loadManuscriptTexts() {
    this.collectionContentService.getManuscripts(this.textItemID).subscribe({
      next: (res) => {
        if (
          res?.manuscripts?.length > 0 &&
          res?.manuscripts[0]?.manuscript_changes
        ) {
          this.manuscripts = res.manuscripts;
          this.setManuscript();
          if (this.searchMatches.length) {
            this.scrollService.scrollToFirstSearchMatch(this.elementRef.nativeElement, this.intervalTimerId);
          }
        } else {
          this.text = $localize`:@@Manuscripts.None:Inga manuskriptutskrifter.`;
        }
      },
      error: (e) => {
        console.error(e);
        this.text = $localize`:@@Manuscripts.Error:Ett fel har uppstått. Manuskript kunde inte hämtas.`;
      }
    });
  }

  setManuscript() {
    if (this.msID) {
      const inputManuscript = this.manuscripts.filter((item: any) => {
        return (item.id === this.msID);
      })[0];
      if (inputManuscript) {
        this.selectedManuscript = inputManuscript;
      } else {
        this.selectedManuscript = this.manuscripts[0];
      }
    } else {
      this.selectedManuscript = this.manuscripts[0];
    }
    // Emit the ms id so the collection text page can update queryParams
    this.emitSelectedManuscriptId(this.selectedManuscript.id);
    // Emit the ms name so the collection text page can display it in the column header
    this.emitSelectedManuscriptName(this.selectedManuscript.name);
    this.changeManuscript();
  }

  changeManuscript(manuscript?: any) {
    if (
      manuscript &&
      this.selectedManuscript?.id !== manuscript.id
    ) {
      this.selectedManuscript = manuscript;
      // Emit the ms id so the read page can update queryParams
      this.emitSelectedManuscriptId(manuscript.id);
      // Emit the ms name so the read page can display it in the column header
      this.emitSelectedManuscriptName(this.selectedManuscript.name);
    }
    if (this.selectedManuscript) {
      let text = this.showNormalizedMs
            ? this.selectedManuscript.manuscript_normalized
            : this.selectedManuscript.manuscript_changes;
      text = this.parserService.postprocessManuscriptText(text);
      this.text = this.parserService.insertSearchMatchTags(text, this.searchMatches);

      this.textLanguage = this.selectedManuscript.language
            ? this.selectedManuscript.language
            : '';
    }
  }

  toggleNormalizedManuscript() {
    this.showNormalizedMs = !this.showNormalizedMs;
    this.changeManuscript();
  }

  async selectManuscript() {
    const inputs = [] as AlertInput[];
    const buttons = [] as AlertButton[];

    this.manuscripts.forEach((manuscript: any, index: any) => {
      let checkedValue = false;

      if (this.selectedManuscript.id === manuscript.id) {
        checkedValue = true;
      }

      inputs.push({
        type: 'radio',
        label: manuscript.name,
        value: index,
        checked: checkedValue
      });
    });

    buttons.push({ text: $localize`:@@BasicActions.Cancel:Avbryt` });
    buttons.push({
      text: $localize`:@@BasicActions.Ok:Ok`,
      handler: (index: any) => {
        this.changeManuscript(this.manuscripts[parseInt(index)]);
      }
    });

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Manuscripts.SelectMsDialogTitle:Välj manuskript`,
      subHeader: $localize`:@@Manuscripts.SelectMsDialogSubtitle:Manuskriptet ersätter det manuskript som visas i kolumnen där du klickade.`,
      cssClass: 'custom-select-alert',
      buttons: buttons,
      inputs: inputs
    });

    await alert.present();
  }

  emitSelectedManuscriptId(id: number) {
    if (this.manuscripts.length > 1) {
      this.selectedMsID.emit(id);
    }
  }

  emitSelectedManuscriptName(name: string) {
    if (this.manuscripts.length > 1) {
      this.selectedMsName.emit(name);
    }
  }

  openNewMan(event: Event, id: any) {
    event.preventDefault();
    event.stopPropagation();
    id.viewType = 'manuscripts';
    this.openNewManView.emit(id);
  }

  /*
  openFacsimileMan(event: Event, id: any) {
    event.preventDefault();
    event.stopPropagation();
    id.viewType = 'manuscriptFacsimile';
    this.openNewManView.emit(id);
    this.commonFunctions.scrollLastViewIntoView();
  }
  */

  openNewLegend(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const id = {
      viewType: 'legend',
      id: 'ms-legend'
    }
    this.openNewLegendView.emit(id);
  }

}
