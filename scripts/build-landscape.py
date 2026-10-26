"""Builds the landscape the live sky sits behind: public/landscape/<look>.webp,
one per lighting look (darkness, sunrise, sunset, day). Each is the painting
with the sky cut out, relit, at half size (the site draws it as pixel art at
a third of screen resolution, so half size is plenty up to 4K).

    python3 scripts/build-landscape.py public/background.webp public/landscape

Needs numpy, scipy and Pillow. Rerun if background.webp or a ramp changes.

How:
1. Cut the sky out (same flood + gradient test as before), then clean the edge:
   pixels in a thin band along the silhouettes take the colour of the nearest
   pixel further inside, so no old sky colour bleeds into a new sky.
2. Relight. Every pixel is a soft mix of three materials, by colour: distant
   blue (the mountains), warm (the field, the farmhouse) and green (everything
   else). Each material's brightness is mapped through a colour ramp per look,
   so the painting's own light and shade drive the result. Sunrise and sunset
   add a rim of light along the silhouettes, strongest near the valley where
   the staged Sun sits, on edges with open sky directly above. Darkness is the original painting, untouched."""
import sys
from collections import deque
import numpy as np
from PIL import Image
from scipy import ndimage

src, out_dir = sys.argv[1], sys.argv[2]
rgb_u8 = np.asarray(Image.open(src).convert('RGB'))
a = rgb_u8.astype(np.int16)
H, W, _ = a.shape

# --- 1. cut -------------------------------------------------------------------
TOL = 7
blue = (a[..., 2] - a[..., 1] >= 6) & (a[..., 2] >= 30)
flood = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    if blue[0, x]:
        flood[0, x] = True
        q.append((0, x))
while q:
    y, x = q.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < H and 0 <= nx < W and not flood[ny, nx] and blue[ny, nx]:
            if np.abs(a[ny, nx] - a[y, x]).max() <= TOL:
                flood[ny, nx] = True
                q.append((ny, nx))
labels, n = ndimage.label(~flood)
sizes = ndimage.sum(np.ones_like(labels), labels, index=np.arange(1, n + 1))
small = np.zeros(n + 1, bool)
small[1:] = sizes < 600
flood |= small[labels]

MARGIN = 12
lum_s = ndimage.gaussian_filter(a[..., 1].astype(np.float32) + a[..., 2], 2)
xs = np.arange(W, dtype=np.float64)
sky = np.zeros((H, W), bool)
prev = None
for y in range(H):
    row = flood[y].copy()
    if prev is not None:
        row &= lum_s[y] >= prev - MARGIN
    if row.sum() >= 40:
        fit = np.polyval(np.polyfit(xs[row], lum_s[y, row], 2), xs)
        keep = row & (lum_s[y] >= fit - MARGIN)
        if keep.sum() >= 40:
            fit = np.polyval(np.polyfit(xs[keep], lum_s[y, keep], 2), xs)
        ref = fit if prev is None else np.maximum(fit, prev - 1.0)
    elif prev is None:
        continue
    else:
        ref = prev
    sky[y] = flood[y] & (lum_s[y] >= ref - MARGIN)
    prev = ref
lab, _ = ndimage.label(sky)
sky = np.isin(lab, list(set(np.unique(lab[0])) - {0}))
holes, n = ndimage.label(~sky)
sizes = ndimage.sum(np.ones_like(holes), holes, range(1, n + 1))
small = np.zeros(n + 1, bool)
small[1:] = sizes < 400
sky |= small[holes]
land = ~ndimage.binary_erosion(sky, iterations=1, border_value=1)

# Edge clean-up: the outermost EDGE_PX of the land take the colour of the nearest pixel deeper inside.
EDGE_PX = 4
depth = ndimage.distance_transform_edt(land)
inner = depth > EDGE_PX
_, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
rgb = rgb_u8.astype(np.float32)
band = land & ~inner
rgb[band] = rgb[iy[band], ix[band]]

# --- 2. relight ---------------------------------------------------------------
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b

def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

w_blue = ss(4, 18, b - g) * ss(0, 30, b)
w_warm = ss(5, 35, r - b)
w_green = np.clip(1 - w_blue - w_warm, 0, 1)
total = w_blue + w_warm + w_green
w_blue, w_warm, w_green = w_blue / total, w_warm / total, w_green / total

def brightness(weight):
    vals = lum[(weight > 0.5) & land]
    lo, hi = np.percentile(vals, 2), np.percentile(vals, 99)
    return np.clip((lum - lo) / (hi - lo), 0, 1)

t_blue, t_warm, t_green = brightness(w_blue), brightness(w_warm), brightness(w_green)

def ramp(t, stops):
    stops = np.array(stops, np.float32)
    x = t * (len(stops) - 1)
    i = np.clip(np.floor(x).astype(int), 0, len(stops) - 2)
    f = (x - i)[..., None]
    return stops[i] * (1 - f) + stops[i + 1] * f

RAMPS = {
    'day': dict(green=[(14, 30, 18), (44, 78, 38), (96, 128, 58), (150, 170, 90)],
                blue=[(64, 92, 128), (104, 136, 172), (150, 176, 206)],
                warm=[(110, 84, 40), (196, 160, 74), (246, 216, 132)]),
    'sunset': dict(green=[(6, 12, 14), (26, 32, 30), (70, 62, 46), (130, 96, 60)],
                   blue=[(36, 34, 62), (80, 62, 92), (150, 100, 108)],
                   warm=[(100, 54, 28), (214, 122, 56), (255, 184, 100)]),
    'sunrise': dict(green=[(10, 18, 22), (36, 52, 50), (92, 102, 88), (150, 140, 116)],
                    blue=[(56, 60, 96), (112, 104, 140), (196, 158, 170)],
                    warm=[(120, 82, 66), (220, 160, 122), (255, 214, 172)]),
}
RIM = {'sunset': (255, 140, 70), 'sunrise': (255, 176, 120)}
VALLEY_X = 1350
toward_valley = np.exp(-((np.arange(W)[None, :] - VALLEY_X) / 700.0) ** 2)
# Rim light only on edges lit from above (the sky is directly overhead), so it reads
# as light catching the tops of things rather than a halo all the way round.
below_sky = np.zeros((H, W), np.float32)
run = np.full(W, 1e6, np.float32)
for y in range(H):
    run = np.where(land[y], run + 1, 0)
    below_sky[y] = run
rim_shape = np.exp(-below_sky / 8)

def relit(look):
    if look == 'darkness':
        return rgb
    stops = RAMPS[look]
    out = (w_green[..., None] * ramp(t_green, stops['green'])
           + w_blue[..., None] * ramp(t_blue, stops['blue'])
           + w_warm[..., None] * ramp(t_warm, stops['warm']))
    if look in RIM:
        rim = (rim_shape * toward_valley * 0.6)[..., None]
        out = out * (1 - rim) + np.array(RIM[look], np.float32) * rim
    return out

alpha = np.where(land, 255, 0).astype(np.uint8)
for look in ('darkness', 'sunrise', 'sunset', 'day'):
    pixels = np.dstack([np.clip(relit(look), 0, 255).astype(np.uint8), alpha])
    image = Image.fromarray(pixels, 'RGBA').resize((W // 2, H // 2), Image.BOX)
    path = f'{out_dir}/{look}.webp'
    image.save(path, quality=90, method=6, alpha_quality=100)
    print(path)
