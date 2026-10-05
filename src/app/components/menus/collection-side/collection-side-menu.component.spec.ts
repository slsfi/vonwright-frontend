import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { ScrollService } from '@services/scroll.service';
import { CollectionSideMenuComponent } from './collection-side-menu.component';

type TestCollectionSideMenuComponent = {
  scrollHighlightedMenuItemIntoView: (itemId: string, timeout?: number) => void;
};

describe('CollectionSideMenuComponent', () => {
  let menuElement: HTMLElement;
  let sideNavigation: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionSideMenuComponent],
      providers: [
        provideRouter([]),
        {
          provide: CollectionTableOfContentsService,
          useValue: { getCurrentCollectionToc: () => of(null) }
        },
        {
          provide: ScrollService,
          useValue: { scrollElementIntoView: jasmine.createSpy('scrollElementIntoView') }
        }
      ]
    })
      .overrideComponent(CollectionSideMenuComponent, {
        set: { template: '' }
      })
      .compileComponents();

    jasmine.clock().install();

    sideNavigation = document.createElement('div');
    sideNavigation.className = 'side-navigation';
    menuElement = document.createElement('collection-side-menu');
    for (const id of ['first', 'second', 'destroyed']) {
      const item = document.createElement('div');
      item.dataset['id'] = `toc_${id}`;
      const highlight = document.createElement('span');
      highlight.className = 'menu-highlight';
      item.appendChild(highlight);
      menuElement.appendChild(item);
    }
    document.body.append(sideNavigation, menuElement);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    sideNavigation.remove();
    menuElement.remove();
  });

  it('keeps only the latest deferred scroll and cancels it on destroy', () => {
    const fixture = TestBed.createComponent(CollectionSideMenuComponent);
    const component = fixture.componentInstance as unknown as TestCollectionSideMenuComponent;
    const scrollService = TestBed.inject(ScrollService);
    const scrollSpy = scrollService.scrollElementIntoView as jasmine.Spy;

    component.scrollHighlightedMenuItemIntoView('first', 100);
    component.scrollHighlightedMenuItemIntoView('second', 200);

    jasmine.clock().tick(100);
    expect(scrollSpy).not.toHaveBeenCalled();

    jasmine.clock().tick(100);
    const secondTarget = menuElement.querySelector(
      '[data-id="toc_second"] .menu-highlight'
    );
    expect(scrollSpy).toHaveBeenCalledOnceWith(
      secondTarget,
      'center',
      0,
      'smooth',
      sideNavigation
    );

    component.scrollHighlightedMenuItemIntoView('destroyed', 100);
    fixture.destroy();
    jasmine.clock().tick(100);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });
});
