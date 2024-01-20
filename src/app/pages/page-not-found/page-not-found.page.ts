import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { catchError, map, Observable, of } from 'rxjs';

import { MarkdownContentService } from '@services/markdown-content.service';


@Component({
  selector: 'page-not-found',
  templateUrl: './page-not-found.page.html',
  styleUrls: ['./page-not-found.page.scss'],
})
export class PageNotFoundPage implements OnInit {
  markdownText$: Observable<SafeHtml>;

  constructor(
    private mdContentService: MarkdownContentService,
    private sanitizer: DomSanitizer,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.markdownText$ = this.getMdContent(this.activeLocale + '-404');
  }

  private getMdContent(fileID: string): Observable<SafeHtml> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        return this.sanitizer.bypassSecurityTrustHtml(
          this.mdContentService.getParsedMd(res.content)
        );
      }),
      catchError((e: any) => {
        console.error('Error getting markdown page content from backend', e);
        return of(
          this.sanitizer.bypassSecurityTrustHtml(
            '<p>' +
            $localize`:@@PageNotFound.DefaultMessage:Något gick fel. Vi kan inte hitta sidan du försökte nå. Du kan gå tillbaka till föregående sida med hjälp av webbläsarens tillbaka-knapp, eller försöka rätta adressen i webbläsarens adressfält.`
            + '</p>'
          )
        );
      })
    );
  }

}
