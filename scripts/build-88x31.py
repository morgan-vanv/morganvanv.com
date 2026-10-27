"""Draws public/88x31.gif: the site's own 88x31 button, for other people to link to this site with.

Night sky blue, a classic bevel (lit top left), two stars, the farmhouse with its window lit gold,
and the name in JetBrains Mono. The /now page shows the same design in HTML at 1.5x
(src/shared/badges/own-button-badge/); keep the two in step if either changes.

One-off, like build-landscape.py: rerun it after changing the design and commit the gif.

    pip install pillow fonttools brotli
    python3 scripts/build-88x31.py
"""
from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'node_modules/@fontsource/jetbrains-mono/files'
OUT = ROOT / 'public/88x31.gif'

W, H = 88, 31
SKY = (0, 29, 44)        # $background-sky-color
DEEP = (0, 18, 17)       # $background-color
WHITE = (255, 255, 255)
GOLD = (201, 146, 42)    # $accent-color


def font(weight: int, size: int) -> ImageFont.FreeTypeFont:
    """The bundled webfont, unpacked from woff2 so Pillow can read it."""
    ttf = BytesIO()
    face = TTFont(FONTS / f'jetbrains-mono-latin-{weight}-normal.woff2')
    face.flavor = None
    face.save(ttf)
    ttf.seek(0)
    return ImageFont.truetype(ttf, size)


def mix(color, over, alpha):
    return tuple(round(c * alpha + o * (1 - alpha)) for c, o in zip(color, over))


img = Image.new('RGB', (W, H), SKY)
d = ImageDraw.Draw(img)

# The bevel: light along the top and left, shadow along the bottom and right.
light, shadow = mix(WHITE, SKY, 0.45), mix((0, 0, 0), SKY, 0.75)
d.line([(0, H - 1), (0, 0), (W - 1, 0)], fill=light)
d.line([(1, H - 1), (W - 1, H - 1), (W - 1, 1)], fill=shadow)

# Stars.
d.point((5, 5), fill=WHITE)
d.rectangle([21, 4, 22, 5], fill=GOLD)
d.point((14, 3), fill=mix(WHITE, SKY, 0.6))

# The farmhouse: dark walls, white outline, the window left on.
house = [(5, 26), (5, 15), (13, 8), (21, 15), (21, 26)]
d.polygon(house, fill=DEEP, outline=WHITE)
d.rectangle([11, 18, 14, 21], fill=GOLD)

# The name, and the TLD in small gold caps. Unsmoothed: at this size antialiasing just blurs it.
d.fontmode = '1'
d.text((26, 5), 'morganvanv', font=font(700, 10), fill=WHITE)
d.text((26, 18), '.COM', font=font(700, 7), fill=GOLD)

img.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT, optimize=True)
print(f'build-88x31: wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')
