"""Encodes the Favorite Media wall's covers: public/media/<id>.webp for each pick in
src/shared/constants/favorite-media.const.ts.

Give it a folder of originals named after the picks' ids (any common format, as large as you have:
good-will-hunting.jpg, modal-soul.png, ...). Each one is centre-cropped to its shelf's shape (2:3, or
square for albums), resized to 400x600 or 400x400 and saved as webp. Then set `cover` on each pick it
names (`cover: '/media/<id>.webp'`); the wall's spec checks every cover exists and nothing is orphaned.

One-off, like build-88x31.py: rerun it when a cover changes and commit the webp. Originals stay out
of the repo.

    pip install pillow
    python3 scripts/build-media-covers.py ~/Downloads/covers
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PICKS = ROOT / 'src/shared/constants/favorite-media.const.ts'
OUT = ROOT / 'public/media'
WIDTH = 400
SHAPES = {'album': (1, 1)}   # everything else is a 2:3 poster or book
DEFAULT_SHAPE = (2, 3)
QUALITY = 82                  # covers are small and busy; artefacts start to show below ~75


def picks() -> dict[str, str]:
    """id -> kind, read from the constant (one pick per line)."""
    found = re.findall(r"\{\s*id:\s*'([^']+)',\s*kind:\s*'([^']+)'", PICKS.read_text())
    return dict(found)


def crop(image: Image.Image, shape: tuple[int, int]) -> Image.Image:
    """Centre-crop to the shape, then resize to WIDTH wide."""
    w, h = shape
    size = (WIDTH, WIDTH * h // w)
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1]).expanduser()
    known = picks()
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for path in sorted(source.iterdir()):
        if path.is_dir() or path.name.startswith('.'):
            continue
        if path.stem not in known:
            print(f'skip  {path.name}: no pick has the id "{path.stem}"')
            continue
        shape = SHAPES.get(known[path.stem], DEFAULT_SHAPE)
        with Image.open(path) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            if image.width < WIDTH:
                print(f'note  {path.name} is only {image.width}px wide; it will look soft')
            cover = crop(image, shape)
        target = OUT / f'{path.stem}.webp'
        cover.save(target, 'WEBP', quality=QUALITY, method=6)
        done.append(path.stem)
        print(f'wrote {target.relative_to(ROOT)} ({cover.width}x{cover.height}, {target.stat().st_size // 1024} KB)')
    missing = [pick for pick in known if pick not in done and not (OUT / f'{pick}.webp').exists()]
    if done:
        print('\nSet on these picks:\n' + '\n'.join(f"  {pick}: cover: '/media/{pick}.webp'" for pick in done))
    if missing:
        print('\nStill without a cover: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
