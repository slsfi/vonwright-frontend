import { AsyncPipe } from '@angular/common';
import { Component, LOCALE_ID, OnInit, inject } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Observable } from 'rxjs';

import { ContentGridComponent } from '@components/content-grid/content-grid.component';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { MarkdownService } from '@services/markdown.service';


@Component({
  selector: 'page-content',
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  imports: [AsyncPipe, ContentGridComponent, IonContent, TrustHtmlPipe]
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
