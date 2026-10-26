"""Builds the landscape the live sky sits behind: public/landscape/<look>.webp,
one per lighting look (darkness, sunrise, sunset, day). Each is Morgan's
painting (art/painting.png, the lossless original) with the sky cut out softly
and relit, at 3/4 size (1920x1279).

    python3 scripts/build-landscape.py art/painting.png public/landscape

Needs numpy, scipy and Pillow. Rerun if the painting or a colour ramp changes.

How:
1. A hard cut finds roughly where the sky is (flood from the top through the
   smooth painted gradient, then drop anything darker than the sky above it).
2. A soft matte settles the edges: the painted sky is modelled row by row, and
   each edge pixel (and any sky glimpsed through gaps in the crowns) is solved
   as a mix of that sky and the foreground beside it, then unmixed. Soft,
   antialiased silhouettes with no old sky left in them.
3. Relight. Every pixel is a soft mix of three materials, by colour: distant
   blue (the mountains), warm (the field, the farmhouse) and green (everything
   else). Each material's brightness is mapped through a colour ramp per look,
   so the painting's own light and shade drive the result. Sunrise and sunset
   add a rim of light on top edges, strongest near the valley where the staged
   Sun sits; sunrise adds low morning fog over the field and meadow, kept
   off the big trees in front. Darkness keeps the painting's own colours."""
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
# The glow low in the valley is as bright as the sky above it but fails the colour
# tests; carry the sky down each column while it stays that bright.
glow_lum = a[..., 1].astype(np.float32) + a[..., 2]
for x in range(W):
    col = sky[:, x]
    if not col.any():
        continue
    top_land = int(np.argmax(~col[np.argmax(col):]) + np.argmax(col))
    if not 870 <= top_land <= 930:
        continue
    reference = glow_lum[top_land - 2, x]
    y = top_land
    while y < 935 and glow_lum[y, x] >= reference - 18:
        sky[y, x] = True
        y += 1
# --- 2. soft matte -------------------------------------------------------------
# The hard cut above is only a trimap: pixels well inside either side are settled;
# the band between them (and sky glimpsed through gaps in the crowns) is solved
# properly. The painted sky is smooth, so it can be modelled exactly, row by row;
# each band pixel is then a mix of that sky and the foreground colour nearby:
#   pixel = a * foreground + (1 - a) * sky   →   a by projection, colour by unmixing.
# That gives soft, antialiased edges with none of the old sky left in them.
P = rgb_u8.astype(np.float32)
# border_value=1: the picture's own edges don't make anything less certain.
sure_sky = ndimage.binary_erosion(sky, iterations=6, border_value=1)
sure_land = ndimage.binary_erosion(~sky, iterations=6, border_value=1)
band = ~sure_sky & ~sure_land

lum_all = P.sum(2)
not_star = np.abs(lum_all - ndimage.median_filter(lum_all, size=5)) < 12
B = np.zeros_like(P)
last = None
first_fit = None
last_fit_row = -1
for y in range(H):
    sel = sure_sky[y] & not_star[y]
    if sel.sum() > 30:
        last = [np.polyfit(xs[sel], P[y, sel, c], 2) for c in range(3)]
        first_fit = y if first_fit is None else first_fit
        last_fit_row = y
    if last is not None:
        for c in range(3):
            B[y, :, c] = np.polyval(last[c], xs)
B[:first_fit] = B[first_fit]  # rows above the first fit take its colours
B = np.clip(B, 0, 255)

_, (iy, ix) = ndimage.distance_transform_edt(~sure_land, return_indices=True)
F = ndimage.uniform_filter(P[iy, ix], size=(5, 5, 1))

def solve(F):
    d = F - B
    return np.clip(((P - B) * d).sum(2) / ((d * d).sum(2) + 1e-3), 0, 1)

alpha = solve(F)
alpha = np.where(sure_land, 1, np.where(sure_sky, 0, alpha))
# Well below the last row with sky to model there's no sky to unmix from: it's all land.
alpha[last_fit_row + 40:] = np.where(sky[last_fit_row + 40:], alpha[last_fit_row + 40:], 1)

# Sky seen through gaps in the crowns (above the horizon, coloured like the sky there).
# (A little below the horizon too: the glow in the valley between the peaks is sky.)
HORIZON = 925
above = np.arange(H)[:, None] < HORIZON
candidate = above & ~sky & (np.abs(P - B).max(2) < 14)
# Real gaps are either open to the sky (the glow in the valley) or sit inside a green
# crown; sky-coloured patches on the mountains' lit slopes are neither and stay land.
labels, _ = ndimage.label(candidate, structure=np.ones((3, 3)))
open_ids = np.unique(labels[ndimage.binary_dilation(sky, iterations=2) & candidate])
greenish = (P[..., 1] >= P[..., 2] - 4).astype(np.float32)
in_crown = ndimage.uniform_filter(np.where(candidate, 0, greenish), size=15) > 0.45
crown_ids = np.unique(labels[candidate & in_crown])
pocket = np.isin(labels, np.setdiff1d(np.union1d(open_ids, crown_ids), [0]))
pocket = ndimage.binary_dilation(pocket, iterations=1) & above & ~sky
# The foreground colour around a gap: its non-gap, non-sky neighbours only.
solid = ~pocket & ~sky
weight = ndimage.uniform_filter(solid.astype(np.float32), size=9)
local_f = ndimage.uniform_filter(np.where(solid[..., None], P, 0), size=(9, 9, 1)) / np.maximum(weight, 1e-3)[..., None]
alpha = np.where(pocket, np.minimum(alpha, solve(local_f)), alpha)
F = np.where(pocket[..., None], local_f, F)
band |= pocket
alpha = np.where(band & (alpha < 0.08), 0, alpha)  # stars and specks caught in the band belong to the sky

a3 = alpha[..., None]
rgb = np.clip(np.where(a3 > 0.15, (P - (1 - a3) * B) / np.maximum(a3, 1e-3), F), 0, 255)
land = alpha > 0.5

# --- 3. relight ---------------------------------------------------------------
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

# Morning fog for the sunrise look: low banks over the field and meadow, kept off the big
# trees in front (anything connected to the top of the picture through non-mountain land).
yy = np.arange(H, dtype=np.float32)[:, None]
xx = np.arange(W, dtype=np.float32)[None, :]
labels, _ = ndimage.label(land & (w_blue < 0.5) & (yy < 1180))
near_ids = np.unique(labels[:760][labels[:760] > 0])
near = ndimage.gaussian_filter(np.isin(labels, near_ids).astype(np.float32), 4)
waves = np.random.default_rng(5).uniform(0.55, 1.0, 12)
drift = np.interp(xx, np.linspace(0, W, 12), waves)
fog = (0.38 * np.exp(-((yy - 1045) / 30) ** 2) * drift
       + 0.2 * np.exp(-((yy - 1190) / 26) ** 2) * (1.55 - drift)
       + 0.12 * np.exp(-((yy - 975) / 22) ** 2) * drift)
fog = fog * (1 - near)
FOG = np.array((214, 206, 218), np.float32)

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
    if look == 'sunrise':
        out = out * (1 - fog[..., None]) + FOG * fog[..., None]
    return out

assert alpha[:6][sure_sky[:6]].max(initial=0) == 0, 'open sky along the top edge must be fully transparent'
alpha_u8 = (alpha * 255).round().astype(np.uint8)
for look in ('darkness', 'sunrise', 'sunset', 'day'):
    pixels = np.dstack([np.clip(relit(look), 0, 255).astype(np.uint8), alpha_u8])
    path = f'{out_dir}/{look}.webp'
    # 3/4 size: plenty for any screen once the sky is drawn over it, and a lot lighter.
    image = Image.fromarray(pixels, 'RGBA').resize((W * 3 // 4, H * 3 // 4), Image.LANCZOS)
    image.save(path, quality=78, method=6, alpha_quality=90)
    print(path)
