import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { DateHistogramComponent } from '@components/date-histogram/date-histogram.component';
import { CollectionTitlePipe } from '@pipes/collection-title.pipe';
import { ElasticHitPagePathPipe } from '@pipes/elastic-hit-page-path.pipe';
import { ElasticHitQueryparamsPipe } from '@pipes/elastic-hit-queryparams.pipe';
import { LangNamePipe } from '@pipes/lang-name.pipe';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { ElasticSearchPageRoutingModule } from './elastic-search-routing.module';
import { ElasticSearchPage } from './elastic-search.page';


@NgModule({
  declarations: [
    ElasticSearchPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DateHistogramComponent,
    CollectionTitlePipe,
    ElasticHitPagePathPipe,
    ElasticHitQueryparamsPipe,
    LangNamePipe,
    TrustHtmlPipe,
    ElasticSearchPageRoutingModule
  ]
})
export class ElasticSearchPageModule {}
