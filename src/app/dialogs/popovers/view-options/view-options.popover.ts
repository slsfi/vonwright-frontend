import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, PopoverController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { config } from '@config';
import { Textsize } from '@models/textsize.model';
import { ViewOptionsService } from '@services/view-options.service';


@Component({
  selector: 'popover-view-options',
  templateUrl: './view-options.popover.html',
  styleUrls: ['./view-options.popover.scss'],
  imports: [FormsModule, IonicModule]
})
export class ViewOptionsPopover implements OnDestroy, OnInit {
  @Input() toggles: any = undefined;

  availableToggles: any = undefined;
  checkedToggles: number = 0;
  show: Record<string, boolean> = {
    comments: false,
    personInfo: false,
    placeInfo: false,
    workInfo: false,
    emendations: false,
    normalisations: false,
    abbreviations: false,
    paragraphNumbering: false,
    pageBreakOriginal: false,
    pageBreakEdition: false
  };
  textsize: Textsize = Textsize.Small;
  textsizeSubscription: Subscription | null = null;
  togglesCounter: number;

  TextsizeEnum = Textsize;

  constructor(
    private popoverCtrl: PopoverController,
    private viewOptionsService: ViewOptionsService
  ) {
    this.availableToggles = config.page?.text?.viewOptions ?? undefined;
  }

  ngOnInit() {
    if (
      this.toggles &&
      Object.keys(this.toggles).length > 0
    ) {
      this.availableToggles = this.toggles;
    }

    this.togglesCounter = 0;
    Object.values(this.availableToggles).forEach(value => {
      if (value) {
        this.togglesCounter++;
      }
    });

    this.show = this.viewOptionsService.show;
    for (const [key, value] of Object.entries(this.show)) {
      if (value && this.availableToggles[key]) {
        this.checkedToggles++;
      }
    }

    this.textsizeSubscription = this.viewOptionsService.getTextsize().subscribe(
      (textsize: Textsize) => {
        this.textsize = textsize;
      }
    );
  }

  ngOnDestroy() {
    this.textsizeSubscription?.unsubscribe();
  }

  close() {
    this.popoverCtrl.dismiss();
  }

  toggleAll(e: any) {
    if (e.detail.checked === true) {
      if (this.availableToggles.comments) {
        this.show.comments = true;
      }
      if (this.availableToggles.personInfo) {
        this.show.personInfo = true;
      }
      if (this.availableToggles.placeInfo) {
        this.show.placeInfo = true;
      }
      if (this.availableToggles.workInfo) {
        this.show.workInfo = true;
      }
      if (this.availableToggles.emendations) {
        this.show.emendations = true;
      }
      if (this.availableToggles.normalisations) {
        this.show.normalisations = true;
      }
      if (this.availableToggles.abbreviations) {
        this.show.abbreviations = true;
      }
      if (this.availableToggles.paragraphNumbering) {
        this.show.paragraphNumbering = true;
      }
      if (this.availableToggles.pageBreakOriginal) {
        this.show.pageBreakOriginal = true;
      }
      if (this.availableToggles.pageBreakEdition) {
        this.show.pageBreakEdition = true;
      }
      this.checkedToggles = 0;
    } else {
      this.show.comments = false;
      this.show.personInfo = false;
      this.show.placeInfo = false;
      this.show.workInfo = false;
      this.show.emendations = false;
      this.show.normalisations = false;
      this.show.abbreviations = false;
      this.show.paragraphNumbering = false;
      this.show.pageBreakOriginal = false;
      this.show.pageBreakEdition = false;
      this.checkedToggles = this.togglesCounter;
    }

    this.toggleOption('comments');
    this.toggleOption('personInfo');
    this.toggleOption('placeInfo');
    this.toggleOption('workInfo');
    this.toggleOption('emendations');
    this.toggleOption('normalisations');
    this.toggleOption('abbreviations');
    this.toggleOption('paragraphNumbering');
    this.toggleOption('pageBreakOriginal');
    this.toggleOption('pageBreakEdition');
  }

  toggleOption(optionKey: string) {
    this.viewOptionsService.show[optionKey] = this.show[optionKey];
    if (this.availableToggles[optionKey]) {
      this.checkedToggles = this.show[optionKey] ? this.checkedToggles + 1 : this.checkedToggles - 1;
    }
  }

  setTextSize(size: Textsize) {
    this.viewOptionsService.setTextsize(size);
  }

}
