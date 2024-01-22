import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, switchMap } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'page-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss']
})
export class AboutPage implements OnInit {
  markdownText$: Observable<string | null>;

  constructor(
    private mdService: MarkdownService,
    private route: ActivatedRoute,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.markdownText$ = this.route.params.pipe(
      switchMap(({id}) => {
        return this.mdService.getParsedMdContent(
          this.activeLocale + '-' + id,
          '<p>' + $localize`:@@About.LoadingError:Sidans innehåll kunde inte laddas.` + '</p>'
        );
      })
    );
  }

}
