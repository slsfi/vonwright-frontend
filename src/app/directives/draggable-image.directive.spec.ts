import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DraggableImageDirective } from './draggable-image.directive';

@Component({
  template: `
    <div
      [draggableImage]="[10, 20]"
      (finalCoordinates)="coordinates = $event"
    ></div>
  `,
  imports: [DraggableImageDirective]
})
class DraggableImageHostComponent {
  coordinates: number[] | undefined;
}

describe('DraggableImageDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraggableImageHostComponent]
    }).compileComponents();
  });

  it('updates the transform and emits final coordinates after dragging', () => {
    const fixture = TestBed.createComponent(DraggableImageHostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('div') as HTMLDivElement;

    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 200
    }));
    element.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 120,
      clientY: 230
    }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(element.style.transform).toBe(
      'scale(1) translate3d(30px, 50px, 0px) rotate(0deg)'
    );
    expect(fixture.componentInstance.coordinates).toEqual([30, 50]);
  });
});
