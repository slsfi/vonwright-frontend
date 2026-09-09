import { Component, LOCALE_ID, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'page-content',
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ContentPage implements OnInit {
  private mdService = inject(MarkdownService);
  private activeLocale = inject(LOCALE_ID);

  mdContent$: Observable<string | null>;

  ngOnInit() {
    this.mdContent$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-02'
    );
  }

}
