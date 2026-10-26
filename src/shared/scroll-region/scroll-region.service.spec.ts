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

  it('prefers a region nested inside another region, whatever the registration order', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    outer.appendChild(inner);
    service.register(inner);
    service.register(outer);
    expect(service.active()).toBe(inner);
    service.unregister(inner);
    expect(service.active()).toBe(outer);
    service.unregister(outer);
  });

  it('does not register the same element twice', () => {
    service.register(a);
    service.register(a);
    service.unregister(a);
    expect(service.active()).toBeNull();
  });
});
