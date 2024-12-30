import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';


@Component({
    selector: 'page-not-found',
    templateUrl: './page-not-found.page.html',
    styleUrls: ['./page-not-found.page.scss'],
    standalone: false
})
export class PageNotFoundPage implements OnInit {
  markdownText$: Observable<string | null>;

  constructor(
    private mdService: MarkdownService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.markdownText$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-404',
      '<p>'
      + $localize`:@@PageNotFound.DefaultMessage:Något gick fel. Vi kan inte hitta sidan du försökte nå. Du kan gå tillbaka till föregående sida med hjälp av webbläsarens tillbaka-knapp, eller försöka rätta adressen i webbläsarens adressfält.`
      + '</p>'
    );
  }

}
