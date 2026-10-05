import { AsyncPipe } from '@angular/common';
import { Component, LOCALE_ID, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { Observable } from 'rxjs';

import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { MarkdownService } from '@services/markdown.service';
import { RESPONSE } from 'src/express.tokens';


@Component({
  selector: 'page-not-found',
  templateUrl: './page-not-found.page.html',
  styleUrls: ['./page-not-found.page.scss'],
  imports: [AsyncPipe, IonContent, IonIcon, TrustHtmlPipe]
})
export class PageNotFoundPage implements OnInit {
  private mdService = inject(MarkdownService);
  private activeLocale = inject(LOCALE_ID);
  private response = inject(RESPONSE, { optional: true });

  markdownText$: Observable<string | null>;

  ngOnInit() {
    this.response?.status(404);
    this.markdownText$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-404',
      '<p>'
      + $localize`:@@PageNotFound.DefaultMessage:Något gick fel. Vi kan inte hitta sidan du försökte nå. Du kan gå tillbaka till föregående sida med hjälp av webbläsarens tillbaka-knapp, eller försöka rätta adressen i webbläsarens adressfält.`
      + '</p>'
    );
  }

}
