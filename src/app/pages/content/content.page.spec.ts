import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { clearTranslations, loadTranslations } from '@angular/localize';

import { ContentGridComponent } from '@components/content-grid/content-grid.component';
import { ContentPage } from './content.page';

@Component({
  selector: 'content-grid',
  template: ''
})
class ContentGridStubComponent {}

describe('ContentPage', () => {
  beforeEach(async () => {
    clearTranslations();
    await TestBed.configureTestingModule({
      imports: [ContentPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
      .overrideComponent(ContentPage, {
        remove: { imports: [ContentGridComponent] },
        add: { imports: [ContentGridStubComponent] }
      })
      .compileComponents();
  });

  afterEach(() => {
    clearTranslations();
    TestBed.inject(HttpTestingController).verify();
  });

  it('defaults to an empty introduction without fetching backend Markdown', async () => {
    const fixture = TestBed.createComponent(ContentPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.info')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Innehåll');
    expect(element.querySelector('content-grid')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('renders translated HTML with two paragraphs and a search link', async () => {
    loadTranslations({
      'Content.Introduction': '<p>Welcome to the edition!</p><p>Browse or <a href="search">search</a> the content.</p>'
    });
    const fixture = TestBed.createComponent(ContentPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(Array.from(element.querySelectorAll('.info p'), paragraph => paragraph.textContent))
      .toEqual(['Welcome to the edition!', 'Browse or search the content.']);
    expect(element.querySelector('.info a')?.getAttribute('href')).toBe('search');
    expect(element.querySelector('content-grid')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('omits the introduction block for a whitespace-only translation', async () => {
    loadTranslations({ 'Content.Introduction': ' \n ' });
    const fixture = TestBed.createComponent(ContentPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.info')).toBeNull();
  });

  it('renders translated HTML with a single paragraph, line breaks, and a link', async () => {
    loadTranslations({
      'Content.Introduction': '<p>Welcome to the edition!<br><br>Browse or <a href="search">search</a> the content.</p>'
    });
    const fixture = TestBed.createComponent(ContentPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.info p')).toHaveLength(1);
    expect(element.querySelectorAll('.info br')).toHaveLength(2);
    expect(element.querySelector('.info p')?.textContent)
      .toBe('Welcome to the edition!Browse or search the content.');
    expect(element.querySelector('.info a')?.getAttribute('href')).toBe('search');
  });
});
