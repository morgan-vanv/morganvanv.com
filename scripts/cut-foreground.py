"""Cut public/foreground.webp (trees, mountains, field; sky transparent) out of
the flat public/background.webp, for the Tonight's sky layer to sit behind.
One-off: rerun only if background.webp changes. If the background is ever
redrawn with layers, export the foreground directly and delete this script.

    python3 scripts/cut-foreground.py public/background.webp public/foreground.webp

Needs numpy, scipy and Pillow.

1. Flood the sky from the top edge through blue pixels whose neighbours change
   gently; tree silhouettes are sharp jumps and stop it.
2. The mountains are blue too, so the flood runs through them. Keep only what
   is not darker than the sky gradient expected at that row, fitted row by row
   and never allowed to get darker going down: anything in front of the sky is
   darker than the sky just above it.
3. Fill stars back in, grow the foreground by a pixel, save with alpha."""
import sys
from collections import deque
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert('RGB'))
a = rgb.astype(np.int16)
H, W, _ = a.shape

# 1. tree cut
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

# 2. drop whatever is darker than the expected sky
MARGIN = 12
lum = ndimage.gaussian_filter(a[..., 1].astype(np.float32) + a[..., 2], 2)
xs = np.arange(W, dtype=np.float64)
sky = np.zeros((H, W), bool)
prev = None
for y in range(H):
    row = flood[y].copy()
    if prev is not None:
        row &= lum[y] >= prev - MARGIN
    if row.sum() >= 40:
        fit = np.polyval(np.polyfit(xs[row], lum[y, row], 2), xs)
        keep = row & (lum[y] >= fit - MARGIN)
        if keep.sum() >= 40:
            fit = np.polyval(np.polyfit(xs[keep], lum[y, keep], 2), xs)
        ref = fit if prev is None else np.maximum(fit, prev - 1.0)
    elif prev is None:
        continue
    else:
        ref = prev
    sky[y] = flood[y] & (lum[y] >= ref - MARGIN)
    prev = ref

# 3. tidy and save
lab, _ = ndimage.label(sky)
sky = np.isin(lab, list(set(np.unique(lab[0])) - {0}))
holes, n = ndimage.label(~sky)
sizes = ndimage.sum(np.ones_like(holes), holes, range(1, n + 1))
small = np.zeros(n + 1, bool)
small[1:] = sizes < 400
sky |= small[holes]
sky = ndimage.binary_erosion(sky, iterations=1, border_value=1)
alpha = np.where(sky, 0, 255).astype(np.uint8)
Image.fromarray(np.dstack([rgb, alpha]), 'RGBA').save(out, quality=88, method=6, alpha_quality=100)
print(f'sky {sky.mean():.1%} of the image -> {out}')
