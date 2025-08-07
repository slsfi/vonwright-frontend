import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { config } from '@config';
import { Textsize } from '@models/textsize.model';


@Injectable({
  providedIn: 'root',
})
export class ViewOptionsService {
  show: Record<string, boolean> = {
    comments: false,
    personInfo: false,
    abbreviations: false,
    placeInfo: false,
    workInfo: false,
    emendations: false,
    normalisations: false,
    paragraphNumbering: false,
    pageBreakOriginal: false,
    pageBreakEdition: false
  };
  selectedVariationType: string = 'all';

  private epubAlertDismissed: boolean = false;
  private textsizeSubject$: BehaviorSubject<Textsize> = new BehaviorSubject<Textsize>(Textsize.Small);

  constructor() {
    const defaultViewOptions: string[] = config.page?.text?.defaultViewOptions ?? [];
    Object.keys(this.show).forEach(key => {
      if (defaultViewOptions.includes(key)) {
        this.show[key] = true;
      }
    });
    this.selectedVariationType = config.page?.text?.variantViewOptions?.defaultVariationType ?? 'all';
  }

  getTextsize(): Observable<Textsize> {
    return this.textsizeSubject$.asObservable();
  }

  setTextsize(textsize: Textsize) {
    this.textsizeSubject$.next(textsize);
  }

  epubAlertIsDismissed() {
    return this.epubAlertDismissed;
  }

  markEpubAlertAsDismissed() {
    this.epubAlertDismissed = true;
  }

}
