import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

import { MarkdownContentService } from '@services/markdown-content.service';


@Component({
  selector: 'page-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss']
})
export class AboutPage implements OnInit {
  markdownText$: Observable<SafeHtml>;

  constructor(
    private mdContentService: MarkdownContentService,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.markdownText$ = this.route.params.pipe(
      switchMap(({id}) => {
        return this.getMdContent(this.activeLocale + '-' + id);
      })
    );
  }

  getMdContent(fileID: string): Observable<SafeHtml> {
    return this.mdContentService.getMdContent(fileID).pipe(
      map((res: any) => {
        return this.sanitizer.bypassSecurityTrustHtml(
          this.mdContentService.getParsedMd(res.content)
        );
      }),
      catchError((e: any) => {
        console.error('Error loading markdown content', e);
        return of($localize`:@@About.LoadingError:Sidans innehåll kunde inte laddas.`);
      })
    );
  }

}
