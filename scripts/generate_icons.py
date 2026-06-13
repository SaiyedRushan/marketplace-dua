#!/usr/bin/env python3
"""Generate the extension icons (no external deps).

Draws a minimalist emerald disc with a cream crescent, supersampled for smooth
edges, and writes PNGs at the sizes Chrome asks for.
"""

import os
import struct
import zlib

# Palette
GREEN = (14, 124, 90)     # disc
CREAM = (250, 247, 237)   # crescent

SS = 4  # supersampling factor


def write_png(path, width, height, rgba):
    """rgba: flat list of length width*height*4 (0-255)."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type: none
        raw.extend(rgba[y * stride:(y + 1) * stride])

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def in_circle(x, y, cx, cy, r):
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def render(size):
    n = size * SS
    c = n / 2.0
    r_disc = n * 0.5 - 1

    # Crescent: a cream circle with a green circle carved out of its right side.
    r_moon = n * 0.30
    moon_cx, moon_cy = n * 0.45, c
    r_cut = n * 0.30
    cut_cx, cut_cy = n * 0.61, c

    hi = bytearray(n * n * 4)
    for y in range(n):
        for x in range(n):
            i = (y * n + x) * 4
            px, py = x + 0.5, y + 0.5
            if not in_circle(px, py, c, c, r_disc):
                continue  # leave transparent
            moon = in_circle(px, py, moon_cx, moon_cy, r_moon) and not in_circle(px, py, cut_cx, cut_cy, r_cut)
            col = CREAM if moon else GREEN
            hi[i] = col[0]
            hi[i + 1] = col[1]
            hi[i + 2] = col[2]
            hi[i + 3] = 255

    # Box-downsample SSxSS -> 1 for anti-aliasing.
    out = bytearray(size * size * 4)
    area = SS * SS
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    j = ((y * SS + sy) * n + (x * SS + sx)) * 4
                    r += hi[j]; g += hi[j + 1]; b += hi[j + 2]; a += hi[j + 3]
            o = (y * size + x) * 4
            out[o] = r // area
            out[o + 1] = g // area
            out[o + 2] = b // area
            out[o + 3] = a // area
    return out


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 32, 48, 128):
        png = render(size)
        write_png(os.path.join(out_dir, f"icon{size}.png"), size, size, png)
        print(f"wrote icons/icon{size}.png")


if __name__ == "__main__":
    main()
