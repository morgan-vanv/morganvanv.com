"""Builds the landscape the live sky sits behind, from scratch, as pixel art:
public/landscape/<look>.webp (darkness, sunrise, sunset, day) and
public/background.webp (the night look over a plain night sky, the first paint).

    python3 scripts/build-landscape.py public

Needs numpy, scipy and Pillow. Deterministic: same seeds, same picture.

The scene is composed after Morgan's painting (itself after a photo he took):
mountains with a flat-topped peak and a sharp one, a valley between them where
the staged Sun sets and rises, a treeline, a farmhouse, a golden field behind a
split-rail fence, a meadow, a tall pine on the left and a broadleaf and a pine
on the right. Nothing is copied from the image; every element is drawn here.

Native size is 640x427 (the painting's 2560x1706 at 1/4); the site rasterises
it onto its own art-pixel grid. Each element is drawn into two maps, material
and shade (0 dark .. 1 light, independent of lighting). Each look maps shade
through per-material colour ramps with ordered dithering, so the same drawing
is lit four ways. Sunrise and sunset add rim light on top edges near the
valley; sunrise adds low morning fog."""
import sys
import math
import sys
import numpy as np
from PIL import Image

W, H = 640, 427
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

SKY, MOUNTAIN, RIDGE, FOREST, FIELD, WALL, ROOF, FENCE, MEADOW, TREE, TRUNK, GABLE = range(12)
mat = np.zeros((H, W), np.uint8)
shade = np.zeros((H, W), np.float32)

def put(mask, material, value):
    mat[mask] = material
    shade[mask] = value[mask] if isinstance(value, np.ndarray) else value

def noise(scale, octaves=3, seed=0):
    """Cheap value noise in 0..1."""
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        s = max(1, int(scale / (2 ** o)))
        grid = r.random((H // s + 2, W // s + 2)).astype(np.float32)
        img = np.asarray(Image.fromarray((grid * 255).astype(np.uint8)).resize(((W // s + 2) * s, (H // s + 2) * s), Image.BILINEAR)).astype(np.float32) / 255
        out += img[:H, :W] * amp
        total += amp
        amp *= 0.5
    return out / total

def polygon(points):
    from PIL import ImageDraw
    img = Image.new('L', (W, H), 0)
    ImageDraw.Draw(img).polygon([(float(x), float(y)) for x, y in points], fill=255)
    return np.asarray(img) > 0

def ellipse(cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1

# --- mountains ------------------------------------------------------------------
ridge = [(0, 230), (20, 226), (40, 222), (80, 219), (120, 216), (150, 209), (165, 204), (175, 202), (190, 203),
         (215, 208), (232, 214), (242, 219), (252, 214), (262, 206), (268, 203), (274, 206), (286, 215),
         (300, 222), (320, 227), (338, 230), (352, 226), (366, 218), (382, 213), (400, 212), (430, 214),
         (470, 216), (520, 214), (560, 205), (600, 196), (625, 190), (640, 188)]
pts = [(x + rng.uniform(-0.4, 0.4), y) for x, y in ridge]
mountain = polygon(pts + [(640, 262), (0, 262)])
peaks = [175, 268, 400, 625]
ridge_y = np.interp(xx, [p[0] for p in pts], [p[1] for p in pts])
face = np.zeros((H, W), np.float32)
for p in peaks:
    face += np.tanh((p - xx) / 18) * np.exp(-((xx - p) / 70) ** 2)
depth = np.clip((yy - ridge_y) / 35, 0, 1)
streaks = (noise(6, 2, 1) - 0.5) * 0.1
put(mountain, MOUNTAIN, 0.42 + 0.16 * face + 0.22 * (1 - depth) ** 2 - 0.12 * depth + streaks)

# Lower, nearer ridge in haze.
low_top = 240 + 3 * np.sin(xx / 37) + 2 * np.sin(xx / 13 + 1) - 4 * np.exp(-((xx - 300) / 60) ** 2)
put((yy >= low_top) & (xx > 150), RIDGE, 0.45 + (noise(8, 2, 2) - 0.5) * 0.15)

# --- distant forest band -----------------------------------------------------------------
forest_top = 250 + 3 * np.sin(xx / 9) + 2 * np.sin(xx / 4.3) + 3 * noise(6, 2, 3)[0][None, :].repeat(H, 0)[:, :]
forest = yy >= forest_top
def pine_spire(cx, tip, base, half):
    """A narrow conifer silhouette with stepped, ragged sides."""
    t = np.clip((yy - tip) / max(1, base - tip), 0, 1)
    wobble = 0.8 * np.sin(yy * 1.7 + cx) + 0.6 * np.sin(yy * 0.9 + cx * 3)
    return (yy >= tip) & (yy <= base) & (np.abs(xx - cx) <= half * t + wobble * t)
spires = []
for cx in list(range(-2, 128, 6)) + [196, 204, 252]:
    tip = 205 + (cx * 0.18 if cx < 130 else 31) + rng.uniform(-7, 5)
    spires.append((cx + rng.uniform(-2, 2), tip, rng.uniform(4.5, 7.5)))
for cx, cy, r in [(150, 243, 17), (138, 248, 11), (163, 249, 10), (217, 248, 14), (232, 252, 9), (190, 252, 8),
                  (262, 254, 8), (300, 255, 7)]:
    for k in range(9):
        a = rng.uniform(0, 2 * math.pi); d = rng.uniform(0, r * 0.55)
        forest |= ellipse(cx + d * math.cos(a), cy + d * math.sin(a) * 0.7, r * rng.uniform(0.45, 0.7), r * rng.uniform(0.4, 0.6))
forest &= yy < 266
f_shade = 0.3 + 0.2 * np.clip((266 - yy) / 40, 0, 1) + (noise(4, 2, 4) - 0.5) * 0.3
put(forest, FOREST, f_shade)
FOREST_SPIRES = spires  # drawn after the tree helpers exist

# --- field ---------------------------------------------------------------------------------
field = (yy >= 262) & (yy < 284)
f = 0.55 + 0.3 * np.exp(-((xx - 330) / 160) ** 2) + (noise(3, 2, 5) - 0.5) * 0.25 + 0.06 * np.sin(yy * 1.9)
f -= 0.25 * np.clip((yy - 276) / 8, 0, 1)
put(field, FIELD, f)

# --- farmhouse and shed -----------------------------------------------------------------------
put(polygon([(140, 259), (157, 259), (157, 268), (140, 268)]), WALL, 0.75 + (noise(2, 1, 6) - 0.5) * 0.15)
put(polygon([(131, 259), (140, 259), (140, 268), (131, 268)]), GABLE, 0.3)
put(polygon([(131, 259), (135.5, 252), (140, 259)]), GABLE, 0.25)
put(polygon([(135.5, 252), (156, 252), (159, 259), (140, 259)]), ROOF, 0.55 - 0.25 * np.clip((yy - 252) / 7, 0, 1))
put(polygon([(109, 261), (111, 258), (120, 258), (121, 261), (121, 265), (109, 265)]), ROOF, 0.4)
put(polygon([(110, 262), (120, 262), (120, 265), (110, 265)]), WALL, 0.45)

# --- meadow ------------------------------------------------------------------------------------
meadow = yy >= 282
grass = noise(2, 2, 7)
m = 0.55 - 0.45 * np.clip((yy - 282) / 140, 0, 1) + (grass - 0.5) * 0.3
m += 0.12 * np.exp(-((yy - 286) / 4) ** 2)
put(meadow, MEADOW, m)

# --- fence -------------------------------------------------------------------------------------
fence = np.zeros((H, W), bool)
for y in (272, 280):
    fence |= (yy >= y) & (yy < y + 1.6) & (xx < 430)
for x in (21, 56, 137, 188, 235, 278, 323, 373, 409):
    fence |= (np.abs(xx - x) <= 1) & (yy >= 268) & (yy <= 287)
put(fence, FENCE, 0.4 - 0.2 * ((yy % 8) > 1))

# --- big trees ---------------------------------------------------------------------------------
LIGHT = np.array([-0.55, -0.7, 0.45])  # from the upper left and a little in front (moonlight)
LIGHT = LIGHT / np.linalg.norm(LIGHT)

def foliage(envelope, cx, cy, rx, ry, seed, count, size=(1.6, 3.6), droop=0.0, core_inset=3):
    """Fill an envelope with leaf clusters; each is shaded as a little ball lit from LIGHT,
    darkened toward the tree's core (self-shadowing). Returns mask, shade."""
    r = np.random.default_rng(seed)
    ys, xs = np.nonzero(envelope)
    pick = r.integers(0, len(xs), count)
    # A solid, dark core so the crown never shows sky through it; clusters sit on top.
    from scipy import ndimage
    core = ndimage.binary_erosion(envelope, iterations=core_inset) if core_inset else envelope.copy()
    mask = core.copy()
    sh = np.where(core, 0.1, 0).astype(np.float32)
    zbuf = np.full((H, W), -1e9, np.float32)
    order = np.argsort(ys[pick])  # back (top) to front doesn't matter much; draw lower clusters last
    for k in order:
        px, py = xs[pick[k]] + r.uniform(-0.5, 0.5), ys[pick[k]] + r.uniform(-0.5, 0.5)
        rad = r.uniform(*size)
        x0, x1 = int(max(0, px - rad - 1)), int(min(W, px + rad + 2))
        y0, y1 = int(max(0, py - rad - 1)), int(min(H, py + rad + 2))
        gx, gy = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
        dx, dy = (gx - px) / rad, (gy - py - droop * ((gx - px) / rad) ** 2 * rad) / (rad * 0.8)
        inside = dx * dx + dy * dy <= 1
        dz = np.sqrt(np.clip(1 - dx * dx - dy * dy, 0, 1))
        lambert = np.clip(dx * LIGHT[0] + dy * LIGHT[1] + dz * LIGHT[2], 0, 1)
        # where this cluster sits on the whole tree: outer, upper-left parts catch more light
        ox, oy = (px - cx) / rx, (py - cy) / ry
        outer = np.clip(np.hypot(ox, oy), 0, 1)
        facing = np.clip(0.5 - 0.5 * (ox * 0.8 + oy * 0.6), 0, 1)
        value = 0.12 + 0.5 * lambert * (0.35 + 0.65 * outer) + 0.25 * facing * outer
        z = py + r.uniform(0, 3)
        upd = inside & (z >= zbuf[y0:y1, x0:x1])
        sh[y0:y1, x0:x1] = np.where(upd, value, sh[y0:y1, x0:x1])
        zbuf[y0:y1, x0:x1] = np.where(upd, z, zbuf[y0:y1, x0:x1])
        mask[y0:y1, x0:x1] |= inside
    return mask, sh

def conifer_envelope(cx, top, base, max_half, seed, tiers=11):
    """Classic conifer: tiers that flare out and droop at their lower edge, ragged tips."""
    r = np.random.default_rng(seed)
    t = np.clip((yy - top) / (base - top), 0, 1)
    profile = max_half * (np.sin(np.clip(t, 0, 1) * math.pi * 0.62) ** 0.9)  # widest ~60% down, then tucks in
    tier_pos = (t * tiers + 0.18 * np.sin(yy * 0.37 + seed) + 0.12 * np.sin(yy * 0.11 + 2 * seed)) % 1.0
    flare = 0.42 + 0.58 * tier_pos ** 2.2            # each tier widens toward its bottom
    side_noise = np.zeros((H, W), np.float32)
    for side in (-1, 1):
        n = np.interp(yy, np.arange(0, H, 3), r.uniform(-1, 1, H // 3 + 1))
        side_noise = np.where((xx - cx) * side > 0, n, side_noise)
    half = profile * flare * (1 + 0.12 * side_noise)
    return (yy >= top) & (yy <= base) & (np.abs(xx - cx) <= half + 0.5)

def broadleaf_envelope(lobes, seed):
    r = np.random.default_rng(seed)
    env = np.zeros((H, W), bool)
    for cx, cy, rx, ry in lobes:
        wob = 1 + 0.12 * np.sin(np.arctan2(yy - cy, xx - cx) * r.integers(5, 9) + r.uniform(0, 6))
        env |= ((xx - cx) / (rx * wob)) ** 2 + ((yy - cy) / (ry * wob)) ** 2 <= 1
    return env

trees = np.zeros((H, W), bool)
tree_shade = np.zeros((H, W), np.float32)
trunks = np.zeros((H, W), bool)

def add(mask, sh):
    global trees, tree_shade
    tree_shade = np.where(mask, sh, tree_shade)
    trees |= mask

# Trunks first (foliage covers them where it should).
def limb(x0, y0, x1, y1, w0, w1):
    m = np.zeros((H, W), bool)
    for t in np.linspace(0, 1, 60):
        m |= ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t, w0 + (w1 - w0) * t)
    return m
trunks |= limb(95, 300, 96, 150, 8.5, 4) | limb(95, 222, 70, 205, 2.5, 1) | limb(96, 218, 124, 203, 2.5, 1)
trunks |= limb(572, 299, 572, 120, 6.5, 2.5)
trunks |= limb(462, 288, 452, 170, 4, 2) | limb(470, 288, 486, 160, 3.5, 1.5) | limb(458, 260, 425, 205, 2.5, 1)

# Left pine: tall, slightly lopsided.
env = conifer_envelope(97, 2, 222, 76, seed=21, tiers=9)
add(*foliage(env, 97, 120, 70, 110, seed=22, count=2600, size=(1.4, 3.2), droop=0.25))
# Right pine.
env = conifer_envelope(572, 50, 262, 68, seed=23, tiers=8)
add(*foliage(env, 572, 160, 62, 105, seed=24, count=2300, size=(1.4, 3.2), droop=0.25))
# Right broadleaf: tall, lumpy crown over a few trunks, lower-left bulge.
env = broadleaf_envelope([(468, 150, 40, 48), (440, 200, 38, 44), (495, 215, 30, 50), (420, 235, 22, 30),
                          (470, 255, 40, 26), (485, 118, 22, 20)], seed=25)
add(*foliage(env, 462, 190, 55, 90, seed=26, count=3200, size=(1.6, 3.8)))
# Woods filling in at the right edge, darker and further back.
env = broadleaf_envelope([(630, 200, 22, 60), (620, 268, 26, 24), (527, 262, 14, 22)], seed=27)
m, sh = foliage(env, 620, 230, 30, 60, seed=28, count=900, size=(1.6, 3.4))
add(m & ~trees, sh * 0.6)

tree_shade = np.clip(tree_shade + (noise(1, 1, 15) - 0.5) * 0.08, 0, 1)

# The distant conifers along the left of the treeline: small trees of the same make.
for k, (cx, tip, half) in enumerate(FOREST_SPIRES):
    env = conifer_envelope(cx, tip, 262, half, seed=100 + k, tiers=5)
    m, sh = foliage(env, cx, (tip + 262) / 2, half, (262 - tip) / 2, seed=200 + k, count=140, size=(1.0, 1.8), droop=0.2, core_inset=1)
    sel = m & (mat != TREE) & (mat != TRUNK)
    put(sel, FOREST, sh * 0.85)
put(trunks & ~trees, TRUNK, 0.25 + 0.25 * np.clip((97 - xx) / 6, 0, 1))
put(trees, TREE, tree_shade)


# --- colour: one ramp per material per look ------------------------------------------------
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16
LEVELS = 7  # shade steps per material: few enough to read as pixel art

RAMPS = {
  'darkness': {
    MOUNTAIN: [(0, 22, 38), (2, 33, 52), (6, 45, 64), (14, 58, 78)],
    RIDGE: [(0, 28, 36), (2, 36, 48), (4, 44, 60)],
    FOREST: [(0, 14, 14), (1, 21, 20), (3, 30, 32), (7, 42, 48)],
    FIELD: [(16, 28, 18), (32, 36, 16), (50, 46, 16), (68, 56, 18)],
    WALL: [(36, 38, 18), (60, 50, 16), (84, 64, 22)],
    GABLE: [(4, 20, 20), (8, 28, 28)],
    ROOF: [(4, 22, 24), (10, 34, 36), (16, 44, 46)],
    FENCE: [(0, 12, 12), (6, 22, 18), (16, 32, 24)],
    MEADOW: [(0, 13, 12), (1, 19, 17), (4, 25, 20), (12, 33, 22)],
    TREE: [(0, 12, 12), (0, 18, 17), (2, 26, 26), (8, 38, 44)],
    TRUNK: [(0, 10, 9), (3, 17, 15), (6, 24, 22)],
  },
}
RAMPS['day'] = {
    MOUNTAIN: [(64, 92, 128), (104, 136, 172), (150, 176, 206)],
    RIDGE: [(84, 114, 142), (112, 142, 170)],
    FOREST: [(14, 34, 22), (30, 62, 34), (60, 96, 48)],
    FIELD: [(120, 96, 44), (196, 160, 74), (240, 206, 120)],
    WALL: [(170, 130, 70), (222, 182, 112)],
    GABLE: [(90, 70, 50), (120, 95, 65)],
    ROOF: [(58, 58, 68), (92, 92, 102)],
    FENCE: [(60, 48, 36), (104, 86, 62)],
    MEADOW: [(20, 46, 22), (46, 84, 36), (84, 120, 52)],
    TREE: [(10, 28, 16), (30, 64, 32), (70, 110, 50), (124, 154, 76)],
    TRUNK: [(40, 30, 24), (74, 58, 42)],
}
RAMPS['sunset'] = {
    MOUNTAIN: [(36, 34, 62), (70, 56, 88), (130, 90, 104)],
    RIDGE: [(42, 36, 60), (68, 52, 74)],
    FOREST: [(8, 12, 14), (20, 24, 24), (42, 38, 32)],
    FIELD: [(100, 54, 28), (200, 112, 52), (255, 170, 90)],
    WALL: [(150, 80, 40), (240, 150, 80)],
    GABLE: [(30, 22, 24), (50, 36, 32)],
    ROOF: [(30, 26, 34), (62, 46, 50)],
    FENCE: [(10, 10, 12), (32, 24, 22)],
    MEADOW: [(8, 12, 12), (20, 24, 20), (46, 40, 30)],
    TREE: [(6, 10, 12), (18, 22, 22), (44, 40, 34), (110, 80, 52)],
    TRUNK: [(6, 8, 10), (22, 18, 18)],
}
RAMPS['sunrise'] = {
    MOUNTAIN: [(56, 60, 96), (100, 96, 132), (176, 146, 164)],
    RIDGE: [(82, 84, 112), (112, 110, 136)],
    FOREST: [(12, 22, 26), (30, 44, 46), (60, 72, 70)],
    FIELD: [(120, 90, 70), (210, 160, 120), (250, 206, 160)],
    WALL: [(170, 120, 90), (240, 190, 150)],
    GABLE: [(50, 46, 54), (72, 66, 72)],
    ROOF: [(50, 50, 62), (82, 80, 92)],
    FENCE: [(20, 24, 28), (46, 48, 52)],
    MEADOW: [(14, 26, 28), (32, 48, 46), (66, 80, 72)],
    TREE: [(10, 20, 24), (28, 42, 44), (64, 76, 72), (130, 130, 116)],
    TRUNK: [(14, 18, 22), (36, 38, 42)],
}
RIM = {'sunset': (255, 150, 80), 'sunrise': (255, 190, 150)}
FOG = (196, 190, 204)
VALLEY_X = 337.5

def ramp(stops, t):
    stops = np.array(stops, np.float32)
    x = t * (len(stops) - 1); i = np.clip(np.floor(x).astype(int), 0, len(stops) - 2); f = (x - i)[..., None]
    return stops[i] * (1 - f) + stops[i + 1] * f

def bake(look):
    out = np.zeros((H, W, 4), np.uint8)
    threshold = np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
    q = np.clip(np.floor(np.clip(shade, 0, 0.999) * LEVELS + threshold) / LEVELS, 0, 1)
    rgb = np.zeros((H, W, 3), np.float32)
    for m, stops in RAMPS[look].items():
        sel = mat == m
        rgb[sel] = ramp(stops, q[sel])
    land = mat > 0
    yy, xx = np.mgrid[0:H, 0:W]
    if look in RIM:
        # Light catching the tops of things, strongest toward the valley where the Sun sits.
        sky_above = np.zeros((H, W), np.float32)
        run = np.full(W, 99.0)
        for y in range(H):
            run = np.where(land[y], run + 1, 0)
            sky_above[y] = run
        rim = (sky_above <= 1.5) * np.exp(-((xx - VALLEY_X) / 170.0) ** 2) * 0.75
        rim += (sky_above <= 3.5) * (sky_above > 1.5) * np.exp(-((xx - VALLEY_X) / 170.0) ** 2) * 0.3
        rgb = rgb * (1 - rim[..., None]) + np.array(RIM[look], np.float32) * rim[..., None]
    if look == 'sunrise':
        # Morning fog: a band lying in the valley over the treeline and field, and wisps over the meadow.
        rng = np.random.default_rng(3)
        wave = np.interp(xx, np.arange(0, W + 40, 40), rng.uniform(0.55, 1.0, len(np.arange(0, W + 40, 40))))
        fog = 0.3 * np.exp(-((yy - 266) / 7.0) ** 2) * wave + 0.16 * np.exp(-((yy - 296) / 6.0) ** 2) * (1.5 - wave)
        fog *= np.clip((yy - 240) / 14, 0, 1)  # nothing up in the crowns
        fog = np.floor(fog * 8 + threshold) / 8  # stepped, like everything else
        rgb = rgb * (1 - fog[..., None]) + np.array(FOG, np.float32) * fog[..., None]
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(land, 255, 0)
    return out


import os
out = sys.argv[1] if len(sys.argv) > 1 else 'public'
os.makedirs(f'{out}/landscape', exist_ok=True)
for look in ('darkness', 'sunrise', 'sunset', 'day'):
    Image.fromarray(bake(look), 'RGBA').save(f'{out}/landscape/{look}.webp', lossless=True, method=6)
    print(f'{out}/landscape/{look}.webp')

# First paint: the night look over the night sky, 4x so it covers like the old painting.
SKY_TOP, SKY_HORIZON, HORIZON_Y = (1, 32, 49), (27, 78, 88), 226.25
t = np.clip(np.arange(H, dtype=np.float32) / HORIZON_Y, 0, 1) ** 2
sky_rows = np.array(SKY_TOP, np.float32) * (1 - t[:, None]) + np.array(SKY_HORIZON, np.float32) * t[:, None]
threshold = np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
first = np.floor(sky_rows[:, None, :] / 4 + threshold[..., None]) * 4
night = bake('darkness')
first = np.where(night[..., 3:4] > 0, night[..., :3], first).astype(np.uint8)
Image.fromarray(first).resize((W * 4, H * 4), Image.NEAREST).crop((0, 0, 2560, 1706)).save(f'{out}/background.webp', lossless=True, method=6)
print(f'{out}/background.webp')
