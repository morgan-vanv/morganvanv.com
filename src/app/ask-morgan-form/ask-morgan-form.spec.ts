import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AskMorganForm } from './ask-morgan-form';

describe('AskMorganForm', () => {
  let component: AskMorganForm;
  let fixture: ComponentFixture<AskMorganForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AskMorganForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AskMorganForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
