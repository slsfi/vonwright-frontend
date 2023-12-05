import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DigitalEditionApp } from './app.component';

describe('DigitalEditionApp', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DigitalEditionApp],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(DigitalEditionApp);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

});
