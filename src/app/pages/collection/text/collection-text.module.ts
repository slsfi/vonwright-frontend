import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { MathJaxDirective } from '@directives/math-jax.directive';
import { CommentsComponent } from '@components/collection-text-types/comments/comments.component';
import { FacsimilesComponent } from '@components/collection-text-types/facsimiles/facsimiles.component';
import { IllustrationsComponent } from '@components/collection-text-types/illustrations/illustrations.component';
import { LegendComponent } from '@components/collection-text-types/legend/legend.component';
import { ManuscriptsComponent } from '@components/collection-text-types/manuscripts/manuscripts.component';
import { MetadataComponent } from '@components/collection-text-types/metadata/metadata.component';
import { ReadingTextComponent } from '@components/collection-text-types/reading-text/reading-text.component';
import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { VariantsComponent } from '@components/collection-text-types/variants/variants.component';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionTextPage } from './collection-text.page';
import { CollectionTextPageRoutingModule } from './collection-text-routing.module';


@NgModule({
  declarations: [
    CollectionTextPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MathJaxDirective,
    CommentsComponent,
    FacsimilesComponent,
    IllustrationsComponent,
    LegendComponent,
    ManuscriptsComponent,
    MetadataComponent,
    ReadingTextComponent,
    TextChangerComponent,
    VariantsComponent,
    TrustHtmlPipe,
    CollectionTextPageRoutingModule
  ]
})
export class CollectionTextPageModule {}
