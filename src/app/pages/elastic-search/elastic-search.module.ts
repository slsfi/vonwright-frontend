import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { DateHistogramComponent } from '@components/date-histogram/date-histogram.component';
import { ElasticHitCollectionPagePathPipe } from '@pipes/elastic-hit-collection-page-path.pipe';
import { ElasticHitCollectionPageQueryparamsPipe } from '@pipes/elastic-hit-collection-page-queryparams.pipe';
import { TrustHtmlPipe } from '@pipes/trust-html-pipe';
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
    ElasticHitCollectionPagePathPipe,
    ElasticHitCollectionPageQueryparamsPipe,
    TrustHtmlPipe,
    ElasticSearchPageRoutingModule
  ]
})
export class ElasticSearchPageModule {}
