import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { IsExternalURLPipe } from '@pipes/is-external-url.pipe';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { ArticlePage } from './article.page';
import { ArticlePageRoutingModule } from './article-routing.module';
import { ArticleTocComponent } from '@components/article-toc/article-toc.component';

@NgModule({
  declarations: [
    ArticlePage
  ],
  imports: [
    CommonModule,
    IonicModule,
    IsExternalURLPipe,
    TrustHtmlPipe,
    ArticlePageRoutingModule,
    ArticleTocComponent
  ]
})
export class ArticlePageModule {}
