import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AskMorganFormComponent } from './ask-morgan-form';

describe('AskMorganFormComponent', () => {
  let component: AskMorganFormComponent;
  let fixture: ComponentFixture<AskMorganFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AskMorganFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AskMorganFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
