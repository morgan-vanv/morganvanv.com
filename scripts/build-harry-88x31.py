"""Draws public/friends/harryrosenberg.gif: an 88x31 button for Harry's site (harryrosenberg.net),
which didn't have one. For the "my friends" row on /now, and his to use if he wants it.

His site's look, shrunk: a white page, and his hand-lettered "Harry's Site" on a scrap of torn
orange paper with a blue edge under it. The lettering is Caveat (the site's bundled handwriting).

One-off, like build-88x31.py: rerun it after changing the design and commit the gif.

    pip install pillow fonttools brotli
    python3 scripts/build-harry-88x31.py
"""
import random
from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'node_modules/@fontsource/caveat/files'
OUT = ROOT / 'public/friends/harryrosenberg.gif'

W, H = 88, 31
PAGE = (246, 242, 234)    # his white page, lamp-lit a touch for the night card
PAPER = (236, 168, 98)     # the scrap in his header
PAPER_DARK = (214, 140, 72)
EDGE = (58, 150, 236)      # the blue under its torn edge
INK = (20, 18, 16)


def font(weight: int, size: int) -> ImageFont.FreeTypeFont:
    """The bundled webfont, unpacked from woff2 so Pillow can read it."""
    ttf = BytesIO()
    face = TTFont(FONTS / f'caveat-latin-{weight}-normal.woff2')
    face.flavor = None
    face.save(ttf)
    ttf.seek(0)
    return ImageFont.truetype(ttf, size)


def mix(color, over, alpha):
    return tuple(round(c * alpha + o * (1 - alpha)) for c, o in zip(color, over))


def torn(x0, x1, y0, y1, jitter, step, rng):
    """A ragged edge from (x0, y0) to (x1, y1), left to right."""
    points, x = [], x0
    while x < x1:
        y = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        points.append((x, round(y) + rng.randint(-jitter, jitter)))
        x += rng.randint(step - 1, step + 1)
    points.append((x1, y1 + rng.randint(-jitter, jitter)))
    return points


rng = random.Random(7)  # the same tear every run
img = Image.new('RGB', (W, H), PAGE)
d = ImageDraw.Draw(img)

# The scrap: a ragged top and bottom, ragged ends, and the blue showing under its lower edge.
# Tilted a touch, like a scrap stuck on by hand.
top = torn(4, 84, 5, 3, 1, 3, rng)
bottom = torn(4, 84, 25, 23, 1, 3, rng)
d.polygon([(x, y + 2) for x, y in bottom] + [(84, 15), (4, 15)], fill=EDGE)
d.polygon(top + [(85, 9), (83, 13), (85, 18)] + bottom[::-1] + [(3, 19), (5, 14), (3, 10)], fill=PAPER)
# A little shading along the bottom of the paper.
d.line([(x, y - 1) for x, y in bottom[1:-1]], fill=PAPER_DARK)

# The lettering.
text, face = "Harry's Site", font(700, 17)
left, top_, right, bottom_ = d.textbbox((0, 0), text, font=face)
x = (W - (right - left)) // 2 - left
y = 4 + (20 - (bottom_ - top_)) // 2 - top_
d.text((x, y), text, font=face, fill=INK)

# The bevel: light along the top and left, shadow along the bottom and right.
shadow = mix((0, 0, 0), PAGE, 0.35)
d.line([(0, H - 1), (0, 0), (W - 1, 0)], fill=mix((0, 0, 0), PAGE, 0.08))
d.line([(1, H - 1), (W - 1, H - 1), (W - 1, 1)], fill=shadow)

OUT.parent.mkdir(exist_ok=True)
img.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT, optimize=True)
print(f'build-harry-88x31: wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')
