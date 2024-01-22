import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'page-content',
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss']
})
export class ContentPage implements OnInit {
  mdContent$: Observable<string | null>;

  constructor(
    private mdService: MarkdownService,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {}

  ngOnInit() {
    this.mdContent$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-02'
    );
  }

}
