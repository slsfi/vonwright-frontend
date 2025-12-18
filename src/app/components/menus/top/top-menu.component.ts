import { Component, ChangeDetectionStrategy, DestroyRef, ElementRef, Injector, LOCALE_ID, NgZone, Renderer2, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { config } from '@config';
import { Language } from '@models/config.models';


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
  protected readonly currentLanguageLabel = this.currentLanguage?.label ?? '';
  protected readonly showLanguageButton = config.component?.topMenu?.showLanguageButton ?? true;
  protected readonly showTopAboutButton = config.component?.topMenu?.showAboutButton ?? true;
  protected readonly showTopContentButton = config.component?.topMenu?.showContentButton ?? true;
  protected readonly showTopSearchButton = config.component?.topMenu?.showElasticSearchButton ?? true;

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

}
