import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeadingNode } from '@models/article.models';
import { HtmlParserService } from '@services/html-parser.service';


@Component({
  selector: 'article-toc',
  templateUrl: './article-toc.component.html',
  styleUrls: ['./article-toc.component.scss'],
  imports: [NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticleTocComponent {
  private readonly htmlParser = inject(HtmlParserService);

  htmlContent = input<string | null>(null);
  tocMenuOpen = input<boolean>(false);

  readonly nestedHeadings = computed<HeadingNode[]>(() => {
    const html = this.htmlContent();
    return html ? this.htmlParser.getHeadingsFromHtml(html) : [];
  });
}
