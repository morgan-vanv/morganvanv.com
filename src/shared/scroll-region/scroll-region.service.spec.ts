import { TestBed } from '@angular/core/testing';
import { ScrollRegionService } from './scroll-region.service';

describe('ScrollRegionService', () => {
  let service: ScrollRegionService;
  const a = document.createElement('div');
  const b = document.createElement('div');

  beforeEach(() => {
  service = TestBed.inject(ScrollRegionService);
  });

  it('has no active region by default', () => {
  expect(service.active()).toBeNull();
  });

  it('the most recently registered region wins, then falls back on unregister', () => {
  service.register(a);
  service.register(b);
  expect(service.active()).toBe(b);
  service.unregister(b);
  expect(service.active()).toBe(a);
  service.unregister(a);
  expect(service.active()).toBeNull();
  });

  it('does not register the same element twice', () => {
  service.register(a);
  service.register(a);
  service.unregister(a);
  expect(service.active()).toBeNull();
  });
});
