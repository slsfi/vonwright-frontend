import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertButton, AlertController, AlertInput, IonicModule, ModalController } from '@ionic/angular';

import { config } from '@config';
import { DraggableImageDirective } from '@directives/draggable-image.directive';
import { FullscreenImageViewerModal } from '@modals/fullscreen-image-viewer/fullscreen-image-viewer.modal';
import { Facsimile } from '@models/facsimile.model';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { PlatformService } from '@services/platform.service';
import { sortArrayOfObjectsNumerically } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'facsimiles',
  templateUrl: './facsimiles.component.html',
  styleUrls: ['./facsimiles.component.scss'],
  imports: [NgFor, NgIf, NgStyle, FormsModule, IonicModule, DraggableImageDirective, TrustHtmlPipe]
})
export class FacsimilesComponent implements OnInit {
  @Input() facsID: number | undefined = undefined;
  @Input() imageNr: number | undefined = undefined;
  @Input() textItemID: string = '';
  @Output() selectedFacsID = new EventEmitter<number>();
  @Output() selectedFacsName = new EventEmitter<string>();
  @Output() selectedImageNr = new EventEmitter<number | null>();
  
  angle: number = 0;
  externalFacsimiles: any[] = [];
  facsURLAlternate: string = '';
  facsNumber: number = 1;
  facsimiles: any[] = [];
  facsSize: number | null = 1;
  facsURLDefault: string = '';
  mobileMode: boolean = false;
  numberOfImages: number = 0;
  prevX: number = 0;
  prevY: number = 0;
  replaceImageAssetsPaths: boolean = true;
  selectedFacsimile: any | null = null;
  selectedFacsimileIsExternal: boolean = false;
  showTitle: boolean = true;
  text: string = '';
  zoom: number = 1.0;

  constructor(
    private alertCtrl: AlertController,
    private collectionContentService: CollectionContentService,
    private modalCtrl: ModalController,
    private platformService: PlatformService
  ) {
    this.facsSize = config.component?.facsimiles?.imageQuality ?? 1;
    this.facsURLAlternate = config.app?.alternateFacsimileBaseURL ?? '';
    this.replaceImageAssetsPaths = config.collections?.replaceImageAssetsPaths ?? true;
    this.showTitle = config.component?.facsimiles?.showTitle ?? true;
  }

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    if (this.textItemID) {
      this.loadFacsimiles();
    }
  }

  loadFacsimiles() {
    this.collectionContentService.getFacsimiles(this.textItemID).subscribe({
      next: (facs) => {
        if (facs && facs.length > 0) {
          const sectionId = this.textItemID.split('_')[2]?.split(';')[0]?.replace('ch', '') || '';
          for (const f of facs) {
            const facsimile = new Facsimile(f);
            facsimile.itemId = this.textItemID;
            facsimile.manuscript_id = f.publication_manuscript_id;
            if (!f['external_url']) {
              facsimile.title = f['title'];
            }
            if (f['external_url'] && !f['folder_path']) {
              this.externalFacsimiles.push({'title': f['title'], 'url': f['external_url'], 'priority': f['priority']});
            } else {
              if (sectionId !== '') {
                if (String(f['section_id']) === sectionId) {
                  this.facsimiles.push(facsimile);
                }
              } else {
                this.facsimiles.push(facsimile);
              }
            }
          }
          if (this.facsimiles.length > 1) {
            sortArrayOfObjectsNumerically(this.facsimiles, 'priority', 'asc');
          }
          if (this.externalFacsimiles.length > 1) {
            sortArrayOfObjectsNumerically(this.externalFacsimiles, 'priority', 'asc');
          }
          this.setInitialFacsimile();
        } else {
          this.text = $localize`:@@Facsimiles.None:Inga faksimil tillgängliga.`;
        }
      },
      error: (e) => {
        console.error(e);
        this.text = $localize`:@@Facsimiles.Error:Ett fel har uppstått. Faksimil kunde inte hämtas.`;
      }
    });
  }

  setInitialFacsimile() {
    if (this.facsimiles.length > 0) {
      if (this.facsID !== undefined && this.facsID > 0) {
        const inputFacsimile = this.facsimiles.filter((item: any) => {
          return (item.facsimile_id === this.facsID);
        })[0];
        if (inputFacsimile) {
          this.selectedFacsimile = inputFacsimile;
        } else {
          this.selectedFacsimile = this.facsimiles[0];
        }
      } else if (
        this.externalFacsimiles.length > 0 && 
        (
          (this.facsID !== undefined && this.facsID < 1) ||
          this.externalFacsimiles[0]['priority'] < this.facsimiles[0]['priority']
        )
      ) {
        this.selectedFacsimileIsExternal = true;
        this.emitSelectedFacsimileId(0);
        this.emitSelectedFacsimileName($localize`:@@Facsimiles.ExternalFacsimiles:Externa faksimil`);
      } else {
        this.selectedFacsimile = this.facsimiles[0];
      }
  
      if (this.selectedFacsimile) {
        this.initializeDisplayedFacsimile(this.selectedFacsimile, this.imageNr);
      }
    } else {
      this.selectedFacsimileIsExternal = true;
    }
  }

  changeFacsimile(facs?: any) {
    if (facs === 'external') {
      this.selectedFacsimileIsExternal = true;
      this.emitSelectedFacsimileId(0);
      this.emitSelectedFacsimileName($localize`:@@Facsimiles.ExternalFacsimiles:Externa faksimil`);
      this.emitImageNumber(null);
    } else if (facs) {
      this.initializeDisplayedFacsimile(facs);
      this.reset();
    }
  }

  private initializeDisplayedFacsimile(facs: any, extImageNr?: number) {
    this.selectedFacsimileIsExternal = false;
    this.selectedFacsimile = facs;
    this.numberOfImages = facs.number_of_pages;
    this.facsURLDefault = config.app.backendBaseURL + '/' + config.app.projectNameDB +
          `/facsimiles/${facs.publication_facsimile_collection_id}/`;
    this.text = this.replaceImageAssetsPaths
      ? facs.content?.replace(/src="images\//g, 'src="assets/images/')
      : facs.content;

    if (extImageNr !== undefined) {
      this.facsNumber = extImageNr;
    } else {
      this.facsNumber = facs.page;
    }
    this.facsNumber < 1 ? this.facsNumber = 1 : (
      this.facsNumber > this.numberOfImages ? this.facsNumber = this.numberOfImages : this.facsNumber
    );

    if (this.facsimiles.length > 1 || this.externalFacsimiles.length > 0) {
      this.emitSelectedFacsimileId(facs.facsimile_id);
      this.emitSelectedFacsimileName(facs.title);
    }

    if (this.numberOfImages > 1) {
      this.emitImageNumber(this.facsNumber);
    } else {
      this.emitImageNumber(null);
    }
  }

  async presentSelectFacsimileAlert() {
    const inputs = [] as AlertInput[];
    const buttons = [] as AlertButton[];

    if (this.externalFacsimiles.length > 0) {
      inputs.push({
        type: 'radio',
        label: $localize`:@@Facsimiles.ExternalFacsimiles:Externa faksimil`,
        value: '-1',
        checked: this.selectedFacsimileIsExternal
      });
    }

    this.facsimiles.forEach((facsimile: any, index: any) => {
      let checkedValue = false;

      if (
        !this.selectedFacsimileIsExternal &&
        (
          this.selectedFacsimile.facsimile_id === facsimile.facsimile_id &&
          (
            this.selectedFacsimile.page === undefined &&
            this.selectedFacsimile.first_page === facsimile.page ||
            this.selectedFacsimile.page === facsimile.page
          )
        )
      ) {
        checkedValue = true;
      }

      // Tags are stripped from the title which is shown as the label
      inputs.push({
        type: 'radio',
        label: facsimile.title.replace(/(<([^>]+)>)/gi, ''),
        value: String(index),
        checked: checkedValue
      });
    });

    buttons.push({ text: $localize`:@@BasicActions.Cancel:Avbryt` });
    buttons.push({
      text: $localize`:@@BasicActions.Ok:Ok`,
      handler: (index: string) => {
        if (parseInt(index) < 0) {
          this.changeFacsimile('external');
        } else {
          this.changeFacsimile(this.facsimiles[parseInt(index)]);
        }
      }
    });

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Facsimiles.SelectFacsDialogTitle:Välj faksimil`,
      subHeader: $localize`:@@Facsimiles.SelectFacsDialogSubtitle:Faksimilet ersätter det faksimil som visas i kolumnen där du klickade.`,
      cssClass: 'custom-select-alert',
      buttons: buttons,
      inputs: inputs
    });

    await alert.present();
  }

  emitSelectedFacsimileId(id: number) {
    this.selectedFacsID.emit(id);
  }

  emitSelectedFacsimileName(name: string) {
    if (
      this.facsimiles.length > 1 ||
      (this.facsimiles.length == 1 && this.externalFacsimiles.length > 0)) {
      this.selectedFacsName.emit(name);
    }
  }

  emitImageNumber(nr: number | null) {
    this.selectedImageNr.emit(nr);
  }

  setImageNr(e?: any) {
    if (this.facsNumber < 1) {
      this.facsNumber = 1;
    } else if (this.facsNumber > this.numberOfImages) {
      this.facsNumber = this.numberOfImages;
    }
    this.emitImageNumber(this.facsNumber);
  }

  async openFullScreen() {
    const fullscreenImageSize = config.modal?.fullscreenImageViewer?.imageQuality || this.facsSize;
    const imageURLs = [];
    for (let i = 1; i < (this.numberOfImages || 0) + 1; i++) {
      const url = (
          this.facsURLAlternate ?
              this.facsURLAlternate+'/'+this.selectedFacsimile.publication_facsimile_collection_id+'/'+fullscreenImageSize+'/'+i+'.jpg' :
              this.facsURLDefault+i+(fullscreenImageSize ? '/'+fullscreenImageSize : '')
      )
      imageURLs.push(url);
    }

    const params = {
      activeImageIndex: this.facsNumber - 1,
      imageURLs: imageURLs
    };

    const modal = await this.modalCtrl.create({
      component: FullscreenImageViewerModal,
      componentProps: params,
      cssClass: 'fullscreen-image-viewer-modal',
    });

    modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'imageNr' && data) {
      this.facsNumber = data;
      this.setImageNr();
    }
  }
  
  previous() {
    if (this.facsNumber > 1) {
      this.facsNumber--;
    } else {
      this.facsNumber = this.numberOfImages;
    }
    this.emitImageNumber(this.facsNumber);
  }

  next() {
    if (this.facsNumber < this.numberOfImages) {
      this.facsNumber++;
    } else {
      this.facsNumber = 1;
    }
    this.emitImageNumber(this.facsNumber);
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
    if (this.angle >= 360) {
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

}
