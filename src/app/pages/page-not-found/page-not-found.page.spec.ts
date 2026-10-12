import { APP_BASE_HREF } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PageNotFoundPage } from './page-not-found.page';

describe('PageNotFoundPage', () => {
  it.each(['sv', 'fi', 'en'])('renders without a backend request and links to the %s home page', async (locale) => {
    await TestBed.configureTestingModule({
      imports: [PageNotFoundPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: locale },
        { provide: APP_BASE_HREF, useValue: `/${locale}/` }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PageNotFoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')?.textContent).toContain('404 Sidan hittas inte');
    expect(element.querySelector('.markdown p')?.textContent)
      .toContain('Vi kan inte hitta sidan du försökte nå.');
    expect(element.querySelector('.markdown a')?.getAttribute('href')).toBe(`/${locale}/`);
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
  });

  it('sets the server response status to 404', async () => {
    const response: ResponseInit = {};

    await TestBed.configureTestingModule({
      imports: [PageNotFoundPage],
      providers: [
        { provide: RESPONSE_INIT, useValue: response }
      ]
    })
      .overrideTemplate(PageNotFoundPage, '')
      .compileComponents();

    const fixture = TestBed.createComponent(PageNotFoundPage);
    fixture.detectChanges();

    expect(response.status).toBe(404);
  });
});
