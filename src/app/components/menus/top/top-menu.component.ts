import { Component, ChangeDetectionStrategy, DestroyRef, ElementRef, Injector, LOCALE_ID, NgZone, Renderer2, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { config } from '@config';
import { Language } from '@models/config.models';
import { AuthService } from '@services/auth.service';
import { RouteLocalizationService } from '@services/route-localization.service';
import { AUTH_ENABLED } from '@tokens/auth.tokens';
import { parseRelativeUrl } from '@utility-functions';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'top-menu',
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss'],
  imports: [IonicModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopMenuComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  protected readonly activeLocale = inject(LOCALE_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly ngZone = inject(NgZone);
  private readonly renderer = inject(Renderer2);
  private readonly router = inject(Router);
  private readonly routeLocalizationService = inject(RouteLocalizationService);
  private readonly authEnabled = inject(AUTH_ENABLED);
  private authService: AuthService | null = null;
  private readonly authMenuLoginLabel = $localize`:@@TopMenu.Login:Logga in`;
  private readonly authMenuLogoutLabel = $localize`:@@TopMenu.Logout:Logga ut`;

  readonly currentRouterUrl = input<string>('');
  readonly showSideNav = input<boolean>(false);
  readonly sideNavClick = output();

  private readonly languageMenu = viewChild<ElementRef<HTMLElement>>('languageMenu');
  private readonly languageMenuToggleBtn =
    viewChild<ElementRef<HTMLElement>>('languageMenuToggleBtn');

  protected readonly firstAboutPageId = `03-${config.page?.about?.initialPageNode ?? '01'}`;
  protected readonly languages: Language[] = config.app?.i18n?.languages ?? [];
  private readonly currentLanguage?: Language = this.languages.find(
    (l: Language) => l.code === this.activeLocale
  );
  protected readonly languageHrefByCode = computed<Record<string, string>>(() => {
    const currentUrl = this.resolveCurrentRouterUrl();

    return this.languages.reduce<Record<string, string>>((hrefByCode, language) => {
      hrefByCode[language.code] = `/${language.code}${
        this.routeLocalizationService.localizeRouterUrl(currentUrl, language.code)
      }`;
      return hrefByCode;
    }, {});
  });
  protected readonly currentLanguageLabel = this.currentLanguage?.label ?? '';
  protected readonly showLanguageButton = config.component?.topMenu?.showLanguageButton ?? true;
  protected readonly showTopAboutButton = config.component?.topMenu?.showAboutButton ?? true;
  protected readonly showTopContentButton = config.component?.topMenu?.showContentButton ?? true;
  protected readonly showTopSearchButton = config.component?.topMenu?.showElasticSearchButton ?? true;
  protected readonly showTopAuthButton = this.authEnabled;
  protected readonly hideTopSearchButtonOnMobile = this.authEnabled && this.showLanguageButton;
  protected readonly isAuthenticated = computed(() => this.authEnabled
    ? this.getAuthService().isAuthenticated()
    : false
  );
  protected readonly authMenuTitle = computed(() => this.isAuthenticated()
    ? this.authMenuLogoutLabel
    : this.authMenuLoginLabel
  );

  readonly languageMenuOpen = signal<boolean>(false);
  readonly languageMenuWidth = signal<number | null>(null);

  private unlistenClick?: () => void;
  private unlistenFocusIn?: () => void;


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire after-render DOM listeners and cleanup
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.attachDomListeners();
    this.registerCleanup();
  }

  private attachDomListeners() {
    // Post-render wiring (browser-only): attach global listeners
    // once the menu exists
    afterNextRender({
      earlyRead: () => {
        return this.languageMenu()?.nativeElement ?? null;
      },
      write: (languageMenuElem) => {
        if (languageMenuElem) {
          // Attach listeners: close the language menu on click or focus 
          // outside the menu.
          const handler = (evt: Event) => {
            const target = evt.target as Node | null;
            if (target && !languageMenuElem.contains(target)) {
              this.languageMenuOpen.set(false);
            }
          };
          this.ngZone.runOutsideAngular(() => {
            this.unlistenClick = this.renderer.listen('window', 'click', handler);
            this.unlistenFocusIn = this.renderer.listen('window', 'focusin', handler);
          });
        }
      }
    }, { injector: this.injector });
  }

  private registerCleanup() {
    this.destroyRef.onDestroy(() => {
      this.unlistenClick?.();
      this.unlistenFocusIn?.();
    });
  }

  /**
   * Lazy auth service resolution so projects with disabled auth do not
   * initialize AuthService from this component.
   */
  private getAuthService(): AuthService {
    if (!this.authService) {
      this.authService = this.injector.get(AuthService);
    }
    return this.authService;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // UI actions
  // ─────────────────────────────────────────────────────────────────────────────

  toggleSideMenu(event: Event) {
    event.preventDefault();
    this.sideNavClick.emit();
  }

  toggleLanguageMenu(event: Event) {
    event.stopPropagation();

    if (!this.languageMenuOpen()) {
      // Set width of the language menu to the width of the toggle button
      // and open language menu.
      const btn = this.languageMenuToggleBtn()?.nativeElement;
      const w = btn?.offsetWidth ?? 0;
      this.languageMenuWidth.set(w > 100 ? w : null);
      this.languageMenuOpen.set(true);
    } else {
      // Close language menu
      this.languageMenuOpen.set(false);
    }
  }

  logout(event: Event) {
    event.preventDefault();
    this.getAuthService().logout();
    this.router.navigateByUrl('/login');
  }

  /**
   * Returns the route URL used for language links, preserving query params
   * from the live router URL if the input URL is a same-path stale snapshot.
   */
  private resolveCurrentRouterUrl(): string {
    const currentUrl = this.currentRouterUrl();
    const routerUrl = this.router.url;

    if (!currentUrl) {
      return routerUrl || '/';
    }

    const currentParsedUrl = parseRelativeUrl(currentUrl);
    const routerParsedUrl = parseRelativeUrl(routerUrl);

    if (
      currentParsedUrl &&
      routerParsedUrl &&
      currentParsedUrl.pathname === routerParsedUrl.pathname &&
      !currentParsedUrl.search &&
      !!routerParsedUrl.search
    ) {
      return routerUrl;
    }

    return currentUrl;
  }

}
