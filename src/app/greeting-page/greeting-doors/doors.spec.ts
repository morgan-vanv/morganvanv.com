import { computeLayout } from '../../../shared/sky/sky-render';
import { nightLights } from '../../../shared/sky/sky-landscape';
import { DOORS, EDGE, WINDOW_LEAD, fireLead, labelText, labelWidth, placeDoor } from './doors';

const [windowDoor, fireDoor] = DOORS;
const SCREEN = { width: 1440, height: 900 };
const WINDOW_LABEL = labelText(WINDOW_LEAD, windowDoor);

describe('the greeting\'s hidden doors', () => {
  it('are the farmhouse light to Projects and the campfire to Social', () => {
    expect(DOORS.map(door => [door.id, door.path, door.name])).toEqual([['window', '/projects', 'Projects'], ['fire', '/social', 'Social']]);
  });

  it('label the window, and the fire with how many are around it, or just that it\'s lit', () => {
    expect(WINDOW_LABEL).toBe('the light\'s on [ projects › ]');
    expect(labelText(fireLead(3), fireDoor)).toBe('3 around the fire [ social › ]');
    expect(fireLead(1)).toBe('1 around the fire');
    expect(fireLead(0)).toBe('the fire\'s lit');
    expect(fireLead(null)).toBe('the fire\'s lit');
  });

  it('know a label\'s width from its length (0.6 em a character at 0.8 rem, plus padding)', () => {
    expect(labelWidth(WINDOW_LABEL)).toBe(Math.ceil(29 * 7.68 + 26));
  });

  it('sit exactly where the sky puts its window light and campfire', () => {
    const lights = nightLights(computeLayout(SCREEN.width, SCREEN.height));
    expect(placeDoor(lights.window, SCREEN, WINDOW_LABEL, [])).toEqual({ x: lights.window.x, y: lights.window.y, shift: 0 });
    expect(placeDoor(lights.fire, SCREEN, WINDOW_LABEL, [])).toMatchObject(lights.fire);
  });

  it('hide when the sky hasn\'t placed its lights, or their spot is off screen (a phone crops the farmhouse away)', () => {
    expect(placeDoor(null, SCREEN, WINDOW_LABEL, [])).toBeNull();
    const phone = nightLights(computeLayout(390, 844));
    expect(phone.window.x).toBeLessThan(0);
    expect(placeDoor(phone.window, { width: 390, height: 844 }, WINDOW_LABEL, [])).toBeNull();
    expect(placeDoor({ x: 1430, y: 500 }, SCREEN, WINDOW_LABEL, [])).toBeNull();
    expect(placeDoor({ x: 500, y: 890 }, SCREEN, WINDOW_LABEL, [])).toBeNull();
  });

  it('hide when there\'s no room for the label above the spot', () => {
    expect(placeDoor({ x: 500, y: 50 }, SCREEN, WINDOW_LABEL, [])).toBeNull();
    expect(placeDoor({ x: 500, y: 70 }, SCREEN, WINDOW_LABEL, [])).not.toBeNull();
  });

  it('hide under the hero\'s words or buttons, with a little room to spare', () => {
    const button = { left: 176, top: 193, right: 382, bottom: 241 };
    expect(placeDoor({ x: 156, y: 237 }, SCREEN, WINDOW_LABEL, [button])).toBeNull();
    expect(placeDoor({ x: 150, y: 237 }, SCREEN, WINDOW_LABEL, [button])).toBeNull();
    expect(placeDoor({ x: 140, y: 237 }, SCREEN, WINDOW_LABEL, [button])).not.toBeNull();
    expect(placeDoor({ x: 250, y: 300 }, SCREEN, WINDOW_LABEL, [button])).not.toBeNull();
  });

  it('slide the label in from an edge rather than let it hang off the window', () => {
    const half = labelWidth(WINDOW_LABEL) / 2;
    const left = placeDoor({ x: 40, y: 400 }, SCREEN, WINDOW_LABEL, [])!;
    expect(left.x).toBe(40);
    expect(Math.abs(40 + left.shift - half - EDGE)).toBeLessThanOrEqual(0.5);
    const right = placeDoor({ x: 1400, y: 400 }, SCREEN, WINDOW_LABEL, [])!;
    expect(Math.abs(1400 + right.shift + half - (SCREEN.width - EDGE))).toBeLessThanOrEqual(0.5);
  });

  it('hide on a window too narrow for the label', () => {
    expect(placeDoor({ x: 100, y: 400 }, { width: 200, height: 900 }, WINDOW_LABEL, [])).toBeNull();
  });
});
