#!/usr/bin/env python3
"""Generate FitTrack's PNG app icons — no image libraries needed.

Draws three ascending rounded bars (progress / tracking) on the app's dark
background, supersampled 4x for clean edges, and writes the three sizes iOS and
Android ask for.

    python3 Tools/make_icons.py      # run from the fittrack/ directory
"""

import struct
import zlib

BG = (0x0D, 0x15, 0x12)
BAR = (0x35, 0xD0, 0x7A)
BAR_HI = (0x62, 0xE8, 0x9E)
SS = 4  # supersampling factor

# (x_centre, height) in unit coordinates; bars sit on a common baseline
BARS = [(0.285, 0.30), (0.500, 0.45), (0.715, 0.62)]
BAR_W = 0.135
BASELINE = 0.775
RADIUS = 0.055  # corner radius of each bar, in unit coords


def rounded_rect_hit(px, py, x0, y0, x1, y1, r):
    """True when the point is inside a rounded rectangle."""
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def render(size):
    """Return RGB bytes for one icon, anti-aliased by supersampling."""
    big = size * SS
    # Per-pixel accumulation in the supersampled grid, then box-filter down.
    hi_rows = []
    for y in range(big):
        py = (y + 0.5) / big
        row = bytearray()
        for x in range(big):
            px = (x + 0.5) / big
            colour = BG
            for index, (cx, height) in enumerate(BARS):
                x0, x1 = cx - BAR_W / 2, cx + BAR_W / 2
                y0, y1 = BASELINE - height, BASELINE
                if rounded_rect_hit(px, py, x0, y0, x1, y1, RADIUS):
                    colour = BAR_HI if index == len(BARS) - 1 else BAR
                    break
            row += bytes(colour)
        hi_rows.append(row)

    out = bytearray()
    for y in range(size):
        out.append(0)  # PNG filter type 0 for this scanline
        for x in range(size):
            r = g = b = 0
            for dy in range(SS):
                row = hi_rows[y * SS + dy]
                for dx in range(SS):
                    off = ((x * SS) + dx) * 3
                    r += row[off]
                    g += row[off + 1]
                    b += row[off + 2]
            n = SS * SS
            out += bytes((r // n, g // n, b // n))
    return bytes(out)


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def write_png(path, size):
    raw = render(size)
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", header)
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as handle:
        handle.write(png)
    print("wrote %s (%dx%d, %d bytes)" % (path, size, size, len(png)))


if __name__ == "__main__":
    for name, size in (("icon-180.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
        write_png(name, size)
