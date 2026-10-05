import { ScrollService } from './scroll.service';


describe('ScrollService', () => {
  let service: ScrollService;

  beforeEach(() => {
    jasmine.clock().install();
    service = new ScrollService();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  describe('scrollToFirstSearchMatch', () => {
    it('returns a handle that can cancel the retry interval', () => {
      const container = document.createElement('div');
      const querySelectorSpy = spyOn(container, 'querySelector').and.callThrough();

      const intervalTimerId = service.scrollToFirstSearchMatch(container);
      clearInterval(intervalTimerId);
      jasmine.clock().tick(2000);

      expect(intervalTimerId).toEqual(jasmine.any(Number));
      expect(querySelectorSpy).not.toHaveBeenCalled();
    });

    it('scrolls to the first match outside a fixed tooltip and stops retrying', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <span class="ttFixed"><mark id="tooltip-match"></mark></span>
        <p><mark id="content-match"></mark></p>
      `;
      const target = container.querySelector('#content-match') as HTMLElement;
      const scrollSpy = spyOn(service, 'scrollToHTMLElement');

      service.scrollToFirstSearchMatch(container);
      jasmine.clock().tick(1000);
      jasmine.clock().tick(5000);

      expect(scrollSpy).toHaveBeenCalledOnceWith(target);
    });

    it('stops after ten unsuccessful attempts', () => {
      const container = document.createElement('div');
      const querySelectorSpy = spyOn(container, 'querySelector').and.callThrough();

      service.scrollToFirstSearchMatch(container);
      jasmine.clock().tick(11000);

      expect(querySelectorSpy).toHaveBeenCalledTimes(10);
    });
  });
});
