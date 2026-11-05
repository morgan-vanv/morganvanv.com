/**
 * The Lab's cast: one low-poly model per kind of machine, for the PS1-style stage on the spec sheet
 * (`ps1-render.ts` draws them). Each is a handful of boxes (and, for the VPS, a droplet), in model units
 * centred on the origin: x to the right, y up, z away from the viewer, so a machine's front face is at
 * negative z. Colours are `#rrggbb`; an `emissive` part (an LED, a lit screen) ignores the light.
 * From the approved PS1 looks mockup (look C, 2026-11-05); change them only with a new mockup.
 */

export type Ps1ModelKey = 'hoss' | 'nas' | 'pihole' | 'switch' | 'ups' | 'vps';

/** A box: its centre, its size along each axis, its colour. */
export interface Ps1Box {
  kind: 'box';
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  emissive?: boolean;
}

/** A droplet: a six-sided double cone, its top half `color` and its underside `underside`. */
export interface Ps1Drop {
  kind: 'drop';
  color: string;
  underside: string;
}

export type Ps1Part = Ps1Box | Ps1Drop;

export interface Ps1Model {
  parts: readonly Ps1Part[];
  /** How big it's drawn, so the small ones fill the stage too. */
  scale: number;
  /** Where its turn starts (radians added to the yaw), so the first frame is a three-quarter view. */
  phase: number;
  /** Whether it bobs up and down (the VPS floats; everything else sits on the floor). */
  bobs: boolean;
}

const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, emissive = false): Ps1Box =>
  ({ kind: 'box', x, y, z, w, h, d, color, emissive });

const LED_GREEN = '#7bd389';

export const PS1_MODELS: Readonly<Record<Ps1ModelKey, Ps1Model>> = {
  // A 4U chassis: the case, its front panel, a vent, the power light, a drive slot, the rack ears, the lid.
  hoss: {
    scale: 0.95, phase: 0.6, bobs: false,
    parts: [
      box(0, 0, 0, 2.0, 0.55, 1.5, '#3a4246'), box(0, 0, -0.77, 1.96, 0.52, 0.04, '#2b3236'),
      box(0.42, 0.02, -0.8, 0.95, 0.3, 0.03, '#14181a'), box(-0.82, 0.13, -0.8, 0.07, 0.07, 0.03, LED_GREEN, true),
      box(-0.55, -0.13, -0.8, 0.42, 0.08, 0.03, '#9a7426'), box(1.06, 0, -0.73, 0.12, 0.55, 0.08, '#5d686c'),
      box(-1.06, 0, -0.73, 0.12, 0.55, 0.08, '#5d686c'), box(0, 0.285, 0.1, 1.9, 0.02, 1.2, '#454e52'),
    ],
  },
  // Four bays with a light each, a display strip and a blue status light.
  nas: {
    scale: 1.05, phase: 0.6, bobs: false,
    parts: [
      box(0, 0, 0, 0.92, 1.05, 1.15, '#1c2023'),
      ...[-0.31, -0.105, 0.105, 0.31].flatMap(x => [
        box(x, -0.06, -0.59, 0.18, 0.78, 0.05, '#30383c'), box(x, 0.27, -0.625, 0.05, 0.05, 0.02, LED_GREEN, true),
      ]),
      box(0, 0.44, -0.59, 0.5, 0.06, 0.03, '#0f1214'), box(0.36, 0.44, -0.6, 0.05, 0.05, 0.02, '#6aa8ff', true),
    ],
  },
  // A bare Pi 2: the green board, two USB stacks, the chip, the header pins, two lights, the Ethernet jack.
  pihole: {
    scale: 1.25, phase: 0.6, bobs: false,
    parts: [
      box(0, 0, 0, 1.15, 0.06, 0.75, '#2f7d3a'), box(0.47, 0.18, 0.2, 0.25, 0.3, 0.27, '#b9c0c4'),
      box(0.47, 0.18, -0.12, 0.25, 0.3, 0.27, '#b9c0c4'), box(-0.12, 0.06, 0.02, 0.26, 0.05, 0.26, '#1b1d1e'),
      box(-0.12, 0.1, 0.34, 0.85, 0.1, 0.07, '#141516'),
      box(-0.5, 0.05, -0.3, 0.05, 0.04, 0.05, '#ff5a4f', true), box(-0.42, 0.05, -0.3, 0.05, 0.04, 0.05, LED_GREEN, true),
      box(0.1, 0.07, -0.32, 0.3, 0.08, 0.12, '#c9ced1'),
    ],
  },
  // The white Flex Mini: five ports, a light, the logo plate on top.
  switch: {
    scale: 1.25, phase: 0.6, bobs: false,
    parts: [
      box(0, 0, 0, 1.05, 0.26, 0.78, '#e6e9eb'),
      ...[-0.36, -0.18, 0, 0.18, 0.36].map(x => box(x, -0.02, -0.4, 0.13, 0.11, 0.03, '#26292b')),
      box(0.43, 0.08, -0.4, 0.04, 0.04, 0.02, LED_GREEN, true), box(0, 0.135, 0, 0.5, 0.01, 0.35, '#d4d8db'),
    ],
  },
  // A UPS: a little green screen, an amber light, two vents.
  ups: {
    scale: 0.95, phase: 0.6, bobs: false,
    parts: [
      box(0, 0, 0, 1.7, 0.52, 1.3, '#23282b'), box(0, 0, -0.66, 1.66, 0.48, 0.03, '#2f363a'),
      box(-0.35, 0.05, -0.685, 0.42, 0.2, 0.02, '#3f6b47', true), box(0.15, 0.05, -0.69, 0.07, 0.07, 0.02, '#e2a33a', true),
      box(0.45, -0.1, -0.69, 0.5, 0.06, 0.02, '#14181a'), box(0.45, 0.04, -0.69, 0.5, 0.06, 0.02, '#14181a'),
    ],
  },
  // The droplet, floating over a thin square pad.
  vps: {
    scale: 0.95, phase: 0.3, bobs: true,
    parts: [{ kind: 'drop', color: '#4d8fd6', underside: '#3a74b8' }, box(0, -0.95, 0, 0.9, 0.04, 0.9, '#1d3c5c')],
  },
};

export const PS1_MODEL_KEYS = Object.keys(PS1_MODELS) as readonly Ps1ModelKey[];

export function isPs1ModelKey(key: string): key is Ps1ModelKey {
  return Object.hasOwn(PS1_MODELS, key);
}
