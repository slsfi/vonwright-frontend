import { Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Request } from 'express';

import { REQUEST } from 'src/express.tokens';
import { isBrowser } from '@utility-functions';


/**
 * User agent sniffing is used to set the mode of the app (either mobile
 * or desktop). On the server, the request headers are used to get the
 * user agent string, in the browser, the window object has the information.
 * 
 * The app starts in mobile mode if the user agent string contains any
 * of the substrings defined in the regex in the setMode() function below.
 * 
 * This sets the mode correctly for mobile and tablet devices in most
 * browsers. One notable exception is Safari on iPads with iOS 13+, which
 * are recognized as desktop devices. Using only the user agent string, it
 * is not possible to distinguish Safari on iPads with iOS 13+ from Safari
 * on MacBooks with MacOS.
 * 
 * Since the app mode must be set to the same both on the server and in the
 * browser, we can only use the user agent string to set the mode. If the SSR
 * app runs in one mode, and the browser app in another, hydration fails.
 * 
 * Preferrably we wouldn't need to do browser sniffing and instead rely
 * solely on a responsive design. However, with the current layout
 * differences between mobile and desktop mode, it is not  easily achievable
 * or maybe even possible.
 */
@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private mode: string = 'desktop'; // mode is either 'desktop' or 'mobile'

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    @Optional() @Inject(REQUEST) private request: Request
  ) {
    this.setMode();
  }

  private setMode() {
    let userAgent = '';
    if (isPlatformServer(this.platformId)) {
      userAgent = (this.request?.headers?.['user-agent'] as string) || '';
    } else if (isBrowser()) {
      userAgent = window?.navigator?.userAgent;
    }

    /**
     * Checking the user agent string for 'Mobi' covers most cases where the
     * device is a mobile, as indicated by: https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#mobile_tablet_or_desktop
     * The other options have been added to also better cover tablets,
     * inspired by the regex here: https://ionicframework.com/docs/angular/platform#customizing-platform-detection-functions
     */
    const isMobile = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    this.mode = isMobile ? 'mobile' : 'desktop';
  }

  isMobile() {
    return this.mode === 'mobile';
  }

}
