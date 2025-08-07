import { Component, EventEmitter, Inject, Input, LOCALE_ID, OnDestroy, OnInit, Output, DOCUMENT } from '@angular/core';
import { NgStyle } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { config } from '@config';
import { isBrowser } from '@utility-functions';


@Component({
  selector: 'top-menu',
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss'],
  imports: [NgStyle, IonicModule, RouterLink]
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
  showTopAboutButton: boolean = true;
  showTopContentButton: boolean = true;
  showTopSearchButton: boolean = true;
  _window: Window;

  constructor(
    @Inject(LOCALE_ID) public activeLocale: string,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    this._window = <any>this.document.defaultView;
    this.showLanguageButton = config.component?.topMenu?.showLanguageButton ?? true;
    this.showTopSearchButton = config.component?.topMenu?.showElasticSearchButton ?? true;
    this.showTopContentButton = config.component?.topMenu?.showContentButton ?? true;
    this.showTopAboutButton = config.component?.topMenu?.showAboutButton ?? true;

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

}
