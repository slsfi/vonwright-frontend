import { Component, Inject, LOCALE_ID, OnInit, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { catchError, map, Observable, of } from 'rxjs';

import { MarkdownContentService } from '@services/markdown-content.service';


@Component({
  selector: 'page-content',
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss']
})
export class ContentPage implements OnInit {
  mdContent$: Observable<SafeHtml | null>;

  constructor(
    private mdContentService: MarkdownContentService,
    private sanitizer: DomSanitizer,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.mdContent$ = this.getMdContent(this.activeLocale + '-02').pipe(
      map((res: string) => {
        return this.sanitizer.sanitize(
          SecurityContext.HTML, this.sanitizer.bypassSecurityTrustHtml(res)
        );
      })
    );
  }

  getMdContent(fileID: string): Observable<string> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        return this.mdContentService.getParsedMd(res.content);
      }),
      catchError(e => {
        return of('');
      })
    );
  }

}
