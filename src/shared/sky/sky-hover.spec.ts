import { hoverLabel, isOpenSky, sameHover } from './sky-hover';
import { SkyTarget, hitTest } from './sky-render';

const regulus: SkyTarget = { kind: 'star', name: 'Regulus', constellation: 'Leo', x: 100, y: 50, radius: 3 };
const moon: SkyTarget = { kind: 'moon', name: 'the Moon', detail: '40% lit', x: 200, y: 80, radius: 6 };
const segments = [{ figure: 'Ori', ax: 10, ay: 10, bx: 30, by: 10 }];

describe('sky hover', () => {
  it('finds the nearest target within reach, else a figure line, else nothing', () => {
    expect(hitTest(101, 51, [regulus, moon], segments).target).toBe(regulus);
    expect(hitTest(101, 51, [regulus, moon], segments).figure).toBe('Leo');
    expect(hitTest(204, 80, [regulus, moon], segments).target).toBe(moon);
    expect(hitTest(20, 11, [regulus, moon], segments)).toEqual({ target: null, figure: 'Ori' });
    expect(hitTest(20, 20, [regulus, moon], segments)).toEqual({ target: null, figure: null });
  });

  it('labels stars with their constellation, the Moon with its phase, figures by name', () => {
    expect(hoverLabel({ target: regulus, figure: 'Leo' })).toBe('Regulus · Leo');
    expect(hoverLabel({ target: moon, figure: null })).toBe('the Moon · 40% lit');
    expect(hoverLabel({ target: { kind: 'planet', name: 'Jupiter', x: 0, y: 0, radius: 4 }, figure: null })).toBe('Jupiter');
    expect(hoverLabel({ target: null, figure: 'UMa' })).toBe('Ursa Major');
    expect(hoverLabel({ target: null, figure: null })).toBeNull();
  });

  it('only open sky counts: text, controls and page cards block it', () => {
    const page = document.createElement('div');
    page.innerHTML = '<main><section id="open"></section><div class="page-container"><span id="card"></span></div><h1 id="title">x</h1><button id="b">b</button></main>';
    document.body.append(page);
    expect(isOpenSky(page.querySelector('#open'))).toBe(true);
    expect(isOpenSky(page.querySelector('#card'))).toBe(false);
    expect(isOpenSky(page.querySelector('#title'))).toBe(false);
    expect(isOpenSky(page.querySelector('#b'))).toBe(false);
    expect(isOpenSky(null)).toBe(false);
    page.remove();
  });

  it('compares hovers by what they point at', () => {
    expect(sameHover({ target: regulus, figure: 'Leo' }, { target: { ...regulus, x: 5 }, figure: 'Leo' })).toBe(true);
    expect(sameHover({ target: regulus, figure: 'Leo' }, { target: null, figure: 'Leo' })).toBe(false);
  });
});
