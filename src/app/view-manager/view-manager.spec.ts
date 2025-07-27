import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewManager } from './view-manager';

describe('ViewManager', () => {
  let component: ViewManager;
  let fixture: ComponentFixture<ViewManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
