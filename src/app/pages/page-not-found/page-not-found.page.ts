import { Component, OnInit, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';


@Component({
  selector: 'page-not-found',
  templateUrl: './page-not-found.page.html',
  styleUrls: ['./page-not-found.page.scss'],
  imports: [IonContent, IonIcon, RouterLink]
})
export class PageNotFoundPage implements OnInit {
  private response = inject(RESPONSE_INIT, { optional: true });

  ngOnInit() {
    if (this.response) {
      this.response.status = 404;
    }
  }

}
