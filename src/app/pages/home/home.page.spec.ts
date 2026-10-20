import type { MockedObject } from 'vitest';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MarkdownService } from '@services/markdown.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let markdownService: MockedObject<Pick<MarkdownService, 'getParsedMdContent'>>;
  let router: MockedObject<Pick<Router, 'navigate'>>;

  beforeEach(async () => {
    markdownService = {
      getParsedMdContent: vi.fn().mockName('MarkdownService.getParsedMdContent')
    };
    markdownService.getParsedMdContent.mockReturnValue(of('<p>Markdown</p>'));
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: MarkdownService, useValue: markdownService },
        { provide: Router, useValue: router }
      ]
    })
      .overrideTemplate(
        HomePage,
        '@let searchQuery = this.searchQuery(); <span>{{ searchQuery }}</span>'
      )
      .compileComponents();
  });

  it('loads configured Markdown and keeps search state zoneless-safe', async () => {
    const fixture = TestBed.createComponent(HomePage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith('sv-01');
    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith('sv-06');

    component.setSearchQuery('motiv');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('motiv');

    component.submitSearchQuery();
    await fixture.whenStable();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/search'],
      { queryParams: { query: 'motiv' } }
    );
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
