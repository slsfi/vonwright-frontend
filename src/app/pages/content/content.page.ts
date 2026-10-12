import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { ContentGridComponent } from '@components/content-grid/content-grid.component';


@Component({
  selector: 'page-content',
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  imports: [ContentGridComponent, IonContent]
})
export class ContentPage {
  private readonly introduction = $localize`:Optional HTML above the content grid. Leave empty to hide this block.@@Content.Introduction:`.trim();
}
