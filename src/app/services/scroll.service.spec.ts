import { ScrollService } from './scroll.service';


describe('ScrollService', () => {
  let service: ScrollService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ScrollService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('scrollToFirstSearchMatch', () => {
    it('returns a handle that can cancel the retry interval', () => {
      const container = document.createElement('div');
      const querySelectorSpy = vi.spyOn(container, 'querySelector');

      const intervalTimerId = service.scrollToFirstSearchMatch(container);
      clearInterval(intervalTimerId);
      vi.advanceTimersByTime(2000);

      // Node fake timers return an object; browser timer handles are numbers.
      expect(intervalTimerId).toBeDefined();
      expect(querySelectorSpy).not.toHaveBeenCalled();
    });

    it('scrolls to the first match outside a fixed tooltip and stops retrying', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <span class="ttFixed"><mark id="tooltip-match"></mark></span>
        <p><mark id="content-match"></mark></p>
      `;
      const target = container.querySelector('#content-match') as HTMLElement;
      const scrollSpy = vi.spyOn(service, 'scrollToHTMLElement').mockReturnValue(undefined);

      service.scrollToFirstSearchMatch(container);
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(5000);

      expect(scrollSpy).toHaveBeenCalledTimes(1);

      expect(scrollSpy).toHaveBeenCalledWith(target);
    });

    it('stops after ten unsuccessful attempts', () => {
      const container = document.createElement('div');
      const querySelectorSpy = vi.spyOn(container, 'querySelector');

      service.scrollToFirstSearchMatch(container);
      vi.advanceTimersByTime(11000);

      expect(querySelectorSpy).toHaveBeenCalledTimes(10);
    });
  });
});
