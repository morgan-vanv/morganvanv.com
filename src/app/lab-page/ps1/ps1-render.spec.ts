import { PS1_MODELS, PS1_MODEL_KEYS, Ps1Model, isPs1ModelKey } from './ps1-models';
import { PS1_TURN_SPEED, ps1Triangles, renderPs1 } from './ps1-render';

const W = 110;
const H = 84;
const pose = { turn: 0, time: 0 };

/** Every opaque pixel's colour, as "r,g,b". */
function opaqueColours(data: Uint8ClampedArray): string[] {
  const colours: string[] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 255) colours.push(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  return colours;
}

/** What a channel of `hex` can come out as at `shade`, after the dither (±half a 15-bit step) and the 15-bit grid. */
function possible(hex: string, channel: 0 | 1 | 2, shade: number): Set<number> {
  const value = parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16) * shade;
  const out = new Set<number>();
  for (let step = 0; step < 16; step++) out.add(Math.max(0, Math.min(255, value + (step / 16 - 0.5) * 8)) & 0xf8);
  return out;
}

const onlyBox = (emissive: boolean): Ps1Model => ({
  scale: 1, phase: 0.6, bobs: false,
  parts: [{ kind: 'box', x: 0, y: 0, z: 0, w: 1.4, h: 0.8, d: 1.2, color: '#808080', emissive }],
});

describe('renderPs1', () => {
  it('has the six models, each made of triangles', () => {
    expect([...PS1_MODEL_KEYS].sort()).toEqual(['hoss', 'jetkvm', 'nas', 'pihole', 'switch', 'ups', 'vps']);
    for (const key of PS1_MODEL_KEYS) {
      expect(isPs1ModelKey(key)).toBe(true);
      expect(ps1Triangles(PS1_MODELS[key]).length).toBeGreaterThan(10);
    }
    expect(isPs1ModelKey('toaster')).toBe(false);
    // Worked out once per model.
    expect(ps1Triangles(PS1_MODELS.nas)).toBe(ps1Triangles(PS1_MODELS.nas));
  });

  it('draws every model into the middle of the buffer, leaving the corners transparent', () => {
    for (const key of PS1_MODEL_KEYS) {
      const { data, width, height } = renderPs1(PS1_MODELS[key], pose, W, H);
      expect([width, height, data.length]).toEqual([W, H, W * H * 4]);
      expect(opaqueColours(data).length, key).toBeGreaterThan(W * H * 0.05);
      for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) expect(data[(y * W + x) * 4 + 3], key).toBe(0);
      // The middle of the stage is the model.
      expect(data[(Math.round(H * 0.5) * W + W / 2) * 4 + 3], key).toBe(255);
    }
  });

  it('casts a half-transparent, dithered shadow on the floor', () => {
    const { data } = renderPs1(PS1_MODELS.pihole, pose, W, H);
    const shadow = [];
    for (let i = 3; i < data.length; i += 4) if (data[i] === 110) shadow.push(data.slice(i - 3, i));
    expect(shadow.length).toBeGreaterThan(50);
    expect(shadow.every(p => p[0] === 0 && p[1] === 0 && p[2] === 0)).toBe(true);
  });

  it('gives the same pixels for the same inputs, and draws into a buffer it is handed', () => {
    const first = renderPs1(PS1_MODELS.hoss, { turn: 1.2, time: 3 }, W, H).data;
    const again = renderPs1(PS1_MODELS.hoss, { turn: 1.2, time: 3 }, W, H).data;
    expect(again).toEqual(first);
    const into = new Uint8ClampedArray(W * H * 4).fill(77);
    expect(renderPs1(PS1_MODELS.hoss, { turn: 1.2, time: 3 }, W, H, into).data).toBe(into);
    expect(into).toEqual(first);
  });

  it('keeps every colour on the 15-bit grid', () => {
    for (const key of PS1_MODEL_KEYS) {
      const { data } = renderPs1(PS1_MODELS[key], { turn: 0.7, time: 1 }, W, H);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        expect([data[i] & 7, data[i + 1] & 7, data[i + 2] & 7]).toEqual([0, 0, 0]);
      }
    }
  });

  it('turns: a different yaw is a different picture', () => {
    for (const key of PS1_MODEL_KEYS) {
      const front = renderPs1(PS1_MODELS[key], { turn: 0, time: 0 }, W, H).data;
      const later = renderPs1(PS1_MODELS[key], { turn: PS1_TURN_SPEED, time: 0 }, W, H).data;
      expect(later, key).not.toEqual(front);
    }
  });

  it('shades faces by the light, but lights LEDs at full brightness whichever way they face', () => {
    const lit = new Set(opaqueColours(renderPs1(onlyBox(false), pose, W, H).data));
    // Three faces in view, each its own shade (and its dither), so several colours.
    expect(lit.size).toBeGreaterThan(4);

    const allowed = (shade: number) => [0, 1, 2].map(c => possible('#808080', c as 0 | 1 | 2, shade));
    const [r, g, b] = allowed(1.1);
    for (const turn of [0, 1, 2.5, 4]) {
      const colours = opaqueColours(renderPs1(onlyBox(true), { turn, time: 0 }, W, H).data);
      expect(colours.length).toBeGreaterThan(100);
      expect(colours.every(c => {
        const [cr, cg, cb] = c.split(',').map(Number);
        return r.has(cr) && g.has(cg) && b.has(cb);
      })).toBe(true);
    }
  });

  it("shows the NAS's four green bay lights, at the LEDs' full brightness", () => {
    const { data } = renderPs1(PS1_MODELS.nas, pose, W, H);
    const [r, g, b] = [0, 1, 2].map(c => possible('#7bd389', c as 0 | 1 | 2, 1.1));
    let leds = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 255 && r.has(data[i]) && g.has(data[i + 1]) && b.has(data[i + 2])) leds++;
    expect(leds).toBeGreaterThanOrEqual(4);
  });

  it('bobs the VPS with time, and nothing else', () => {
    const at = (key: 'vps' | 'hoss', time: number) => renderPs1(PS1_MODELS[key], { turn: 0, time }, W, H).data;
    expect(at('vps', 0.8)).not.toEqual(at('vps', 0));
    expect(at('hoss', 0.8)).toEqual(at('hoss', 0));
  });

  it('draws the nearer part in front where two overlap', () => {
    // A big red slab at the back and a small green box in front of it, seen head on.
    const model: Ps1Model = {
      parts: [
        { kind: 'box', x: 0, y: 0, z: 0.7, w: 1.6, h: 1.2, d: 0.1, color: '#c03030' },
        { kind: 'box', x: 0, y: 0, z: -0.7, w: 0.5, h: 0.5, d: 0.5, color: '#30c030' },
      ],
      scale: 1, phase: 0, bobs: false,
    };
    const { data, width, height } = renderPs1(model, { turn: 0, time: 0 }, 120, 90);
    const at = (x: number, y: number) => { const i = (y * width + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
    // Find the green box's pixels: every one of them must be green, never the slab showing through.
    let green = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const [r, g, , a] = at(x, y);
      if (a === 255 && g > r) green++;
    }
    expect(green).toBeGreaterThan(50);
    const [r, g] = at(width / 2, Math.round(height * 0.54));
    expect(g).toBeGreaterThan(r);
  });
});
