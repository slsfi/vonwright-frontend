import { Injectable, NgZone, inject } from '@angular/core';

import { ScrollPlan, ScrollYPos } from '@models/scroll.models';
import { isBrowser } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class ScrollService {
  private ngZone = inject(NgZone);

  private activeComHighl: Record<string, any> = {
    commentTimeOutId: null,
    commentLemmaElement: null,
  };
  private activeLemHighl: Record<string, any> = {
    lemmaTimeOutId: null,
    lemmaElement: null,
  };
  private intervalTimerId: number = 0;


  /**
   * Computes a scroll plan (read-only) to position a target element at a given
   * vertical location inside a scrollable container.
   *
   * Intended for split read/write flows with `afterRenderEffect`:
   * - Call in **earlyRead** (DOM read phase).
   * - Apply later with `applyScroll` in the **write** (DOM write) phase.
   *
   * If `container` is omitted, the nearest ancestor with class
   * `scroll-content-container` is used. Returns `null` if the element or
   * container cannot be resolved.
   *
   * @param element  The target element to bring into view.
   * @param yPosition  Desired vertical placement inside the container ('top' | 'center'). Defaults to `center`.
   * @param offset  Extra pixels to subtract from the computed top (e.g., for sticky headers). Defaults to `0`.
   * @param container  Optional scrollable container; if not provided, it is inferred.
   * @return  A plan describing where/how to scroll, or `null` if measurement was not possible.
   */
  computeScrollPlan(
    element: HTMLElement | null,
    yPosition: ScrollYPos = 'center',
    offset = 0,
    container: HTMLElement | null = null
  ): ScrollPlan | null {
    if (!element || (yPosition !== 'center' && yPosition !== 'top')) {
      return null;
    }

    // Find the scrollable container of the element which
    // is to be scrolled into view
    if (!container) {
      container = element.parentElement;
      while (
        container?.parentElement &&
        !container.classList.contains('scroll-content-container')
      ) {
        container = container.parentElement;
      }
      if (!container || !container.parentElement) {
        return null;
      }
    }

    // DOM reads
    const y = Math.floor(
      element.getBoundingClientRect().top +
      container.scrollTop -
      container.getBoundingClientRect().top
    );

    // Base offset: accounts for borders/scrollbar and optional header allowance
    let baseOffset = 10 + container.offsetHeight - container.clientHeight;
    if (yPosition === 'center') {
      baseOffset = Math.floor(container.offsetHeight / 2);
      if (baseOffset > 45) {
        baseOffset = baseOffset - 45;
      }
    }

    const top = y - baseOffset - offset;
    return { behavior: 'smooth', container, top };
  }


  /**
   * Applies a previously computed scroll plan (write-only), i.e. scrolls a
   * container to a target element. Use together with `computeScrollPlan`.
   *
   * @param plan  The plan returned by `computeScrollPlan`.
   */
  applyScroll(plan: ScrollPlan) {
    plan.container.scrollTo({ top: plan.top, behavior: plan.behavior });
  }


  /**
   * This function can be used to scroll a container so that the element which it
   * contains is placed either at the top edge of the container or in the center
   * of the container. This function can be called multiple times simultaneously
   * on elements in different containers, unlike the native scrollIntoView function
   * which cannot be called multiple times simultaneously in Chrome due to a bug.
   * Valid values for yPosition are 'top' and 'center'. The scroll behavior can
   * either be 'auto' or the default 'smooth'.
   */
  scrollElementIntoView(
    element: HTMLElement | null,
    yPosition = 'center',
    offset = 0,
    scrollBehavior = 'smooth',
    container?: HTMLElement
  ) {
    if (!element || (yPosition !== 'center' && yPosition !== 'top')) {
      return;
    }

    // Find the scrollable container of the element which is to be scrolled into view
    if (!container) {
      container = element.parentElement as HTMLElement;
      while (
        container?.parentElement &&
        !container.classList.contains('scroll-content-container')
      ) {
        container = container.parentElement;
      }
      if (container === null || container.parentElement === null) {
        return;
      }
    }

    const y = Math.floor(
      element.getBoundingClientRect().top
      + container.scrollTop
      - container.getBoundingClientRect().top
    );

    let baseOffset = 10 + container.offsetHeight - container.clientHeight;
    if (yPosition === 'center') {
      baseOffset = Math.floor(container.offsetHeight / 2);
      if (baseOffset > 45) {
        baseOffset = baseOffset - 45;
      }
    }

    if (scrollBehavior === 'smooth') {
      container.scrollTo({top: y - baseOffset - offset, behavior: 'smooth'});
    } else {
      container.scrollTo({top: y - baseOffset - offset, behavior: 'auto'});
    }
  }


  /**
   * Scrolls element into view and prepends arrow for the duration of timeOut.
   * @param element The target html element.
   * @param position Either 'top' or 'center'.
   * @param timeOut Timeout in milliseconds.
   * @param scrollBehavior Either 'smooth' or 'auto'.
   */
  scrollToHTMLElement(
    element: HTMLElement,
    position = 'top',
    timeOut = 5000,
    scrollBehavior = 'smooth'
  ) {
    try {
      this.ngZone.runOutsideAngular(() => {
        const tmpImage: HTMLImageElement = new Image();
        tmpImage.src = 'assets/images/ms_arrow_right.svg';
        tmpImage.alt = 'right arrow';
        tmpImage.classList.add('inl_ms_arrow');
        element.parentElement?.insertBefore(tmpImage, element);
        this.scrollElementIntoView(tmpImage, position, 0, scrollBehavior);
        setTimeout(() => {
          element.parentElement?.removeChild(tmpImage);
        }, timeOut);
      });
    } catch (e) {
      console.error(e);
    }
  }


  /**
   * Helper function for scrolling the collection text page horizontally.
   * @param columnElement which should be scrolled into view.
   * @param offset horizontal adjustment to scroll position.
   * @returns true on success, false on failure.
   */
  scrollCollectionTextColumnIntoView(columnElement: HTMLElement, offset: number = 26): boolean {
    if (!columnElement) {
      return false;
    }
    const scrollingContainer = document.querySelector(
      'page-text:not([ion-page-hidden]):not(.ion-page-hidden) ion-content.collection-ion-content'
    )?.shadowRoot?.querySelector('[part="scroll"]') as HTMLElement;
    if (scrollingContainer) {
      const x = columnElement.getBoundingClientRect().left
            + scrollingContainer.scrollLeft
            - scrollingContainer.getBoundingClientRect().left
            - offset;
      scrollingContainer.scrollTo({top: 0, left: x, behavior: 'smooth'});
      return true;
    } else {
      return false;
    }
  }


  /**
   * This function scrolls the collection text page horisontally to the last (rightmost) column.
   * It should be called after adding new views/columns.
   */
  scrollLastViewIntoView() {
    if (isBrowser()) {
      this.ngZone.runOutsideAngular(() => {
        let iterationsLeft = 10;
        clearInterval(this.intervalTimerId);
        const that = this;
        this.intervalTimerId = window.setInterval(function() {
          if (iterationsLeft < 1) {
            clearInterval(that.intervalTimerId);
          } else {
            iterationsLeft -= 1;
            const viewElements = document.querySelector(
              'page-text:not([ion-page-hidden]):not(.ion-page-hidden)'
            )?.getElementsByClassName('text-column');
            if (viewElements?.[0]) {
              const lastViewElement = viewElements[viewElements.length - 1] as HTMLElement;
              that.scrollCollectionTextColumnIntoView(lastViewElement, 0) && clearInterval(that.intervalTimerId);
            }
          }
        }.bind(this), 500);
      });
    }
  }


  /**
   * Searches for the first <mark> element that isn't in a footnote tooltip within
   * the given containerElement and scrolls it into view.
   * @param containerElement the context element to look for <mark> within
   * @param intervalTimerId reference to a variable where the return value of
   * window.setInterval can be stored
   */
  scrollToFirstSearchMatch(containerElement: HTMLElement, intervalTimerId: number) {
    if (isBrowser()) {
      this.ngZone.runOutsideAngular(() => {
        let iterationsLeft = 10;
        clearInterval(intervalTimerId);
        const that = this;

        intervalTimerId = window.setInterval(function() {
          if (iterationsLeft < 1) {
            clearInterval(intervalTimerId);
          } else {
            iterationsLeft -= 1;
            let target: HTMLElement | null | undefined = containerElement.querySelector('mark');

            if (
              target?.parentElement?.classList.contains('ttFixed') ||
              target?.parentElement?.parentElement?.classList.contains('ttFixed')
            ) {
              // The search match is in a footnote tooltip, look for next which isn't
              const targets: NodeListOf<HTMLElement> = containerElement.querySelectorAll('mark');
              let i = 0;

              while (
                target?.parentElement?.classList.contains('ttFixed') ||
                target?.parentElement?.parentElement?.classList.contains('ttFixed')
              ) {
                i++;
                target = targets[i];
              }
            }

            if (target) {
              that.scrollToHTMLElement(target);
              clearInterval(intervalTimerId);
            }
          }
        }.bind(this), 1000);
      });
    }
  }

  /**
   * Function used to scroll the lemma of a comment into view in the reading text view.
   * @param lemmaStartElem The html element marking the start of the lemma in the reading text view.
   * @param timeOut Duration for showing an arrow at the start of the lemma in the reading text view.
   */
  scrollToCommentLemma(lemmaStartElem: HTMLElement, timeOut = 5000) {
    if (lemmaStartElem?.classList.contains('anchor_lemma')) {
      if (this.activeLemHighl.lemmaTimeOutId !== null) {
        // Clear previous lemma highlight if still active
        this.activeLemHighl.lemmaElement.style.display = null;
        window.clearTimeout(this.activeLemHighl.lemmaTimeOutId);
      }

      lemmaStartElem.style.display = 'inline';
      this.scrollElementIntoView(lemmaStartElem);
      const settimeoutId = setTimeout(() => {
        lemmaStartElem.style.display = '';
        this.activeLemHighl = {
          lemmaTimeOutId: null,
          lemmaElement: null,
        };
      }, timeOut);

      this.activeLemHighl = {
        lemmaTimeOutId: settimeoutId,
        lemmaElement: lemmaStartElem,
      };
    }
  }

  /**
   * Function for scrolling to the comment with the specified numeric id
   * (excluding prefixes like 'end') in the first comments view on the page.
   * Alternatively, the comment element can be passed as an optional parameter.
   * @param numericId The numeric id of the comment as a string. Must not
   * contain prefixes like 'en', 'end' or 'start'.
   * @param commentElement Optionally passed comment element. If omitted, the
   * correct comment element will be searched for using numericId.
   */
  scrollToComment(numericId: string, commentElement?: HTMLElement) {
    if (!commentElement || !commentElement.classList.contains('en' + numericId)) {
      // Find the comment in the comments view.
      const commentsWrapper = document.querySelector(
        'page-text:not([ion-page-hidden]):not(.ion-page-hidden) comments'
      ) as HTMLElement;
      commentElement = commentsWrapper.getElementsByClassName(
        'en' + numericId
      )[0] as HTMLElement;
    }
    if (commentElement) {
      if (this.activeComHighl.commentTimeOutId !== null) {
        // Clear previous comment highlight if still active
        this.activeComHighl.commentLemmaElement.classList.remove(
          'highlight'
        );
        window.clearTimeout(this.activeComHighl.commentTimeOutId);
      }

      // Scroll the comment into view.
      this.scrollElementIntoView(commentElement, 'center', -5);
      const noteLemmaElem = commentElement.getElementsByClassName(
        'noteLemma'
      )[0] as HTMLElement;
      noteLemmaElem.classList.add('highlight');
      const settimeoutId = setTimeout(() => {
        noteLemmaElem.classList.remove('highlight');
        this.activeComHighl = {
          commentTimeOutId: null,
          commentLemmaElement: null,
        };
      }, 5000);

      this.activeComHighl = {
        commentTimeOutId: settimeoutId,
        commentLemmaElement: noteLemmaElem,
      };
    }
  }

  /**
   * Function used to scroll all corresponding variants in all variant columns into view.
   * @param element the variant element that was clicked.
   * @param container element that contains all variant columns.
   */
  scrollToVariant(element: HTMLElement, container: HTMLElement) {
    if (element.classList.contains('variantScrollTarget')) {
      const variantContElems: NodeListOf<HTMLElement> = container.querySelectorAll(
        'variants'
      );
      for (let v = 0; v < variantContElems.length; v++) {
        const elems: NodeListOf<HTMLElement> = variantContElems[v].querySelectorAll(
          '.teiVariant'
        );
        let variantNotScrolled = true;
        for (let i = 0; i < elems.length; i++) {
          if (elems[i].id === element.id) {
            if (!elems[i].classList.contains('highlight')) {
              elems[i].classList.add('highlight');
            }
            if (variantNotScrolled) {
              variantNotScrolled = false;
              this.scrollElementIntoView(elems[i]);
            }
            setTimeout(() => {
              elems[i]?.classList.remove('highlight');
            }, 5000);
          }
        }
      }
    } else if (element.classList.contains('anchorScrollTarget')) {
      const elems: NodeListOf<HTMLElement> = container.querySelectorAll(
        '.teiVariant.anchorScrollTarget'
      );
      const elementClassList = element.className.split(' ');
      let targetClassName = '';
      let targetCompClassName = '';
      for (let x = 0; x < elementClassList.length; x++) {
        if (elementClassList[x].startsWith('struct')) {
          targetClassName = elementClassList[x];
          break;
        }
      }
      if (targetClassName.endsWith('a')) {
        targetCompClassName = targetClassName.substring(0, targetClassName.length - 1) + 'b';
      } else {
        targetCompClassName = targetClassName.substring(0, targetClassName.length - 1) + 'a';
      }
      let iClassList = [];
      for (let i = 0; i < elems.length; i++) {
        iClassList = elems[i].className.split(' ');
        for (let y = 0; y < iClassList.length; y++) {
          if (iClassList[y] === targetClassName || iClassList[y] === targetCompClassName) {
            elems[i].classList.add('highlight');
            setTimeout(() => {
              elems[i]?.classList.remove('highlight');
            }, 5000);
            if (iClassList[y] === targetClassName) {
              this.scrollElementIntoView(elems[i]);
            }
          }
        }
      }
    }
  }

  /**
   * Finds the first element with the given attribute in the given
   * collection text type.
   * @param attrName name of the attribute to find.
   * @param attrValue value of the attribute to find.
   * @param textTypeSelector lowercase tag name of the collection text type.
   * @returns HTMLElement.
   */
  findElementInColumnByAttribute(
    attrName: string,
    attrValue: string,
    textTypeSelector: string
  ): HTMLElement {
    let el: HTMLElement = document.querySelector(
      'page-text:not([ion-page-hidden]):not(.ion-page-hidden) ' + textTypeSelector
    ) as HTMLElement;
    el = el?.querySelector('[' + attrName + '="' + attrValue + '"]') as HTMLElement;
    if (
      el?.parentElement?.classList.contains('ttFixed') ||
      el?.parentElement?.parentElement?.classList.contains('ttFixed')
    ) {
      // The element is in a footnote, so we should get the second element with matching dataId
      el = document.querySelector(
        'page-text:not([ion-page-hidden]):not(.ion-page-hidden) ' + textTypeSelector
      ) as HTMLElement;
      el = el.querySelectorAll('[' + attrName + '="' + attrValue + '"]')[1] as HTMLElement;
    }
    return el;
  }

}
