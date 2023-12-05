import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';


@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private mode: string = 'desktop'; // mode is either desktop or mobile

  constructor(
    private platform: Platform
  ) {
    this.detectPlatform();
  }

  isMobile() {
    return this.mode === 'mobile';
  }

  isDesktop() {
    return this.mode === 'desktop';
  }

  private detectPlatform() {
    try {
      if (this.platform.is('desktop')) {
        this.mode = 'desktop';
      } else {
        this.mode = 'mobile';
      }
    } catch (e) {
      this.mode = 'desktop';
    }
  }

}
