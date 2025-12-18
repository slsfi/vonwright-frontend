import { Directive, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, inject, output, input } from '@angular/core';


@Directive({
  standalone: true,
  selector: '[draggableImage]'
})
export class DraggableImageDirective implements OnInit, OnDestroy {
  private elRef = inject(ElementRef);
  private ngZone = inject(NgZone);
  private renderer = inject(Renderer2);

  readonly initialCoordinates = input<number[]>([0, 0], { alias: "draggableImage" });
  readonly angle = input<number>(0);
  readonly zoom = input<number>(1);
  readonly mouseOnly = input<boolean>(false);
  readonly finalCoordinates = output<number[]>();

  private activeDrag: boolean = false;
  private currentCoordinates: number[] = [0, 0];
  private isMouseMoveListenerAdded: boolean = false;
  private isTouchMoveListenerAdded: boolean = false;
  private offsetX: number = 0;
  private offsetY: number = 0;

  private unlistenMouseDownEvents: () => void;
  private unlistenMouseMoveEvents: () => void;
  private unlistenMouseUpEvents: () => void;
  private unlistenTouchStartEvents: () => void;
  private unlistenTouchMoveEvents: () => void;
  private unlistenTouchEndEvents: () => void;

  ngOnInit() {
    this.unlistenMouseDownEvents = this.renderer.listen(
      this.elRef.nativeElement, 'mousedown', (event: any) => {
        this.ngZone.runOutsideAngular(() => {
          if (!this.isMouseMoveListenerAdded) {
            this.unlistenMouseMoveEvents = this.renderer.listen(
              this.elRef.nativeElement, 'mousemove', (event: any) => {
                this.dragElement(event);
              }
            );
          }
          this.isMouseMoveListenerAdded = true;
          this.startDrag(event);
        });
      }
    );
    this.unlistenMouseUpEvents = this.renderer.listen(
      this.elRef.nativeElement, 'mouseup', (event: any) => {
        this.removeMoveEventListeners();
        this.stopDrag(event);
      }
    );

    if (!this.mouseOnly()) {
      this.unlistenTouchStartEvents = this.renderer.listen(
        this.elRef.nativeElement, 'touchstart', (event: any) => {
          this.ngZone.runOutsideAngular(() => {
            if (!this.isTouchMoveListenerAdded) {
              this.unlistenTouchMoveEvents = this.renderer.listen(
                this.elRef.nativeElement, 'touchmove', (event: any) => {
                  this.dragElement(event);
                }
              );
            }
            this.isTouchMoveListenerAdded = true;
            this.startDrag(event);
          });
        }
      );
      this.unlistenTouchEndEvents = this.renderer.listen(
        this.elRef.nativeElement, 'touchend', (event: any) => {
          this.removeMoveEventListeners();
          this.stopDrag(event);
        }
      );
    }
  }

  ngOnDestroy() {
    this.unlistenMouseDownEvents?.();
    this.unlistenMouseUpEvents?.();
    this.unlistenTouchStartEvents?.();
    this.unlistenTouchEndEvents?.();
    this.removeMoveEventListeners();
  }

  private removeMoveEventListeners(): void {
    if (this.isMouseMoveListenerAdded) {
      this.unlistenMouseMoveEvents?.();
      this.isMouseMoveListenerAdded = false;
    }
    if (this.isTouchMoveListenerAdded) {
      this.unlistenTouchMoveEvents?.();
      this.isTouchMoveListenerAdded = false;
    }
  }

  private startDrag(event: any) {
    if (!this.activeDrag) {
      if (event.preventDefault) {
        event.preventDefault();
      }

      if (event.type === 'touchstart') {
        this.offsetX = event.touches[0].clientX;
        this.offsetY = event.touches[0].clientY;
      } else {
        this.offsetX = event.clientX;
        this.offsetY = event.clientY;
      }

      this.activeDrag = true;
    }
  }

  private dragElement(event: any) {
    if (this.activeDrag) {
      this.currentCoordinates = this.calculateCoordinates(event);
      if (this.elRef.nativeElement) {
        this.renderer.setStyle(
          this.elRef.nativeElement,
          'transform', 'scale(' + this.zoom() + ') translate3d(' + this.currentCoordinates[0] + 'px, ' + this.currentCoordinates[1] + 'px, 0px) rotate(' + this.angle() + 'deg)'
        );
      }
    }
  }

  private stopDrag(event?: any) {
    if (this.activeDrag) {
      this.activeDrag = false;
      this.finalCoordinates.emit([this.currentCoordinates[0], this.currentCoordinates[1]]);
    }
  }

  private calculateCoordinates(event: any) {
    let x = 0;
    let y = 0;
    let deltaX = 0;
    let deltaY = 0;

    if (event.type === "touchmove") {
      deltaX = event.touches[0].clientX - this.offsetX;
      deltaY = event.touches[0].clientY - this.offsetY;
    } else if (event.type !== "touchend") {
      // touchend event has no touches property
      deltaX = event.clientX - this.offsetX;
      deltaY = event.clientY - this.offsetY;
    }

    x = this.initialCoordinates()[0] + deltaX / this.zoom();
    y = this.initialCoordinates()[1] + deltaY / this.zoom();

    return [x, y];
  }

}
