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

  /**
   * The app mode is set to 'desktop' if
   * a) the user agent string does NOT contain "Mobi" (see app.module.ts),
   * b) and the device is not a tablet (Ionic defines tablets as iPads,
   *    Android-devices and any device with viewport roughly between 390
   *    and 800 px).
   * In any other case the mode is set to 'mobile'. If the platform can’t
   * be determined, it’s set to 'desktop'.
   */
  private detectPlatform() {
    try {
      if (
        this.platform.is('desktop') &&
        !this.platform.is('tablet')
      ) {
        this.mode = 'desktop';
      } else {
        this.mode = 'mobile';
      }
    } catch (e) {
      this.mode = 'desktop';
    }
  }

}
