import { Component, EventEmitter, Inject, Input, LOCALE_ID, OnDestroy, OnInit, Output } from '@angular/core';
import { DOCUMENT, NgFor, NgIf, NgStyle } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';

import { config } from '@config';
import { ReferenceDataModal } from '@modals/reference-data/reference-data.modal';
import { isBrowser } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'top-menu',
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss'],
  imports: [NgFor, NgIf, NgStyle, IonicModule, RouterLink]
})
export class TopMenuComponent implements OnDestroy, OnInit {
  @Input() currentRouterUrl: string = '';
  @Input() showSideNav: boolean = false;
  @Output() sideNavClick = new EventEmitter();

  currentLanguageLabel: string = '';
  firstAboutPageId: string = '';
  handleLanguageMenuClosure: any = null;
  languageMenuOpen: boolean = false;
  languageMenuWidth: number | null;
  languages: {
    code: string;
    label: string
  }[] = [];
  showLanguageButton: boolean = true;
  showSiteLogo: boolean = false;
  showTopAboutButton: boolean = true;
  showTopContentButton: boolean = true;
  showTopSearchButton: boolean = true;
  showTopURNButton: boolean = true;
  siteLogoDefaultImageUrl: string = 'assets/images/logo/SLS_logo_full_white_346x112.png';
  siteLogoLinkUrl: string = 'https://www.sls.fi/';
  siteLogoMobileImageUrl: string = 'assets/images/logo/SLS_logo_symbol_white_112x112.png';
  siteLogoDimensions: any = {};
  _window: Window;

  constructor(
    private modalController: ModalController,
    @Inject(LOCALE_ID) public activeLocale: string,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    this._window = <any>this.document.defaultView;
    this.showLanguageButton = config.component?.topMenu?.showLanguageButton ?? true;
    this.showTopURNButton = config.component?.topMenu?.showURNButton ?? true;
    this.showTopSearchButton = config.component?.topMenu?.showElasticSearchButton ?? true;
    this.showTopContentButton = config.component?.topMenu?.showContentButton ?? true;
    this.showTopAboutButton = config.component?.topMenu?.showAboutButton ?? true;
    this.showSiteLogo = config.component?.topMenu?.showSiteLogo ?? false;

    this.siteLogoLinkUrl = config.component?.topMenu?.siteLogoLinkURL ?? 'https://www.sls.fi/';
    this.siteLogoDefaultImageUrl = config.component?.topMenu?.siteLogoDefaultImageURL ?? 'assets/images/logo/SLS_logo_full_white_346x112.png';
    this.siteLogoMobileImageUrl = config.component?.topMenu?.siteLogoMobileImageURL ?? 'assets/images/logo/SLS_logo_symbol_white_112x112.png';
    this.siteLogoDimensions = config.component?.topMenu?.siteLogoDimensions ?? {};

    if (!this.siteLogoMobileImageUrl && this.siteLogoDefaultImageUrl) {
      this.siteLogoMobileImageUrl = this.siteLogoDefaultImageUrl;
    }

    const initialAboutPageNode = config.page?.about?.initialPageNode ?? '01';
    this.firstAboutPageId = "03-" + initialAboutPageNode;

    this.languages = config.app?.i18n?.languages ?? [];
    this.languages.forEach((languageObj: any) => {
      if (languageObj.code === this.activeLocale) {
        this.currentLanguageLabel = languageObj.label;
      }
    });
    this.languageMenuWidth = null;
  }

  ngOnDestroy() {
    if (this.handleLanguageMenuClosure) {
      window.removeEventListener('click', this.handleLanguageMenuClosure, false);
      window.removeEventListener('focusin', this.handleLanguageMenuClosure, false);
    }
  }

  public toggleSideMenu(event: any) {
    event.preventDefault();
    this.sideNavClick.emit();
  }

  public toggleLanguageMenu(event: any) {
    event.stopPropagation();

    if (!this.languageMenuOpen) {
      // Set width of the language menu to the width of the toggle button
      const languageToggleButtonElem = this.document.getElementById('language-menu-toggle-button');
      if (languageToggleButtonElem && languageToggleButtonElem.offsetWidth > 100) {
        this.languageMenuWidth = languageToggleButtonElem.offsetWidth;
      } else {
        this.languageMenuWidth = null;
      }

      // Open language menu
      this.languageMenuOpen = true;

      // Add event listeners so the language menu can be closed by clicking or moving focus outside it
      if (isBrowser() && !this.handleLanguageMenuClosure) {
        const languageMenuElem = this.document.getElementById('language-menu');
        if (languageMenuElem) {
          this.handleLanguageMenuClosure = (event: any) => !languageMenuElem.contains(event.target) && this.hideLanguageMenu();
          window.addEventListener('click', this.handleLanguageMenuClosure, { passive: true });
          window.addEventListener('focusin', this.handleLanguageMenuClosure, { passive: true });
        }
      }
    } else {
      // Close language menu
      this.languageMenuOpen = false;
    }
  }

  private hideLanguageMenu() {
    if (this.languageMenuOpen) {
      this.languageMenuOpen = false;
    }
  }

  public async showReference(event: any) {
    event.preventDefault();
    // Get URL of Page and then the URI
    const modal = await this.modalController.create({
      component: ReferenceDataModal,
      componentProps: { origin: 'top-menu' }
    });
    modal.present();
  }

}
