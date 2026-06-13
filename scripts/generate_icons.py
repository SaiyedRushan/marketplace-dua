#!/usr/bin/env python3
"""Generate the extension icons (no external deps).

Draws a minimalist emerald disc bearing a cream crescent beside a small
market storefront (an awning over a shopfront with a doorway) — the crescent
for the du'a, the storefront for the marketplace. Supersampled for smooth
edges, written as PNGs at the sizes Chrome asks for.
"""

import os
import struct
import zlib

# Palette
GREEN = (14, 124, 90)     # disc
CREAM = (250, 247, 237)   # crescent + storefront

SS = 4  # supersampling factor


def write_png(path, width, height, rgba):
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


def in_circle(px, py, cx, cy, r):
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def is_crescent(px, py, n):
    return in_circle(px, py, 0.355 * n, 0.50 * n, 0.182 * n) and \
        not in_circle(px, py, 0.452 * n, 0.452 * n, 0.176 * n)


def is_storefront(px, py, n):
    # Awning band with a scalloped bottom edge.
    if 0.45 * n <= py <= 0.515 * n and 0.545 * n <= px <= 0.755 * n:
        if not any(in_circle(px, py, k * n, 0.515 * n, 0.036 * n) for k in (0.58, 0.65, 0.72)):
            return True
    # Shopfront body with a doorway cut out of the bottom centre.
    if 0.55 * n <= py <= 0.665 * n and 0.555 * n <= px <= 0.745 * n:
        if 0.618 * n <= px <= 0.682 * n and 0.565 * n <= py <= 0.665 * n:
            return False  # doorway
        return True
    return False


def render(size):
    n = size * SS
    c = n / 2.0
    R = n * 0.5 - 1

    hi = bytearray(n * n * 4)
    for y in range(n):
        for x in range(n):
            px, py = x + 0.5, y + 0.5
            if not in_circle(px, py, c, c, R):
                continue  # leave transparent
            cream = is_crescent(px, py, n) or is_storefront(px, py, n)
            col = CREAM if cream else GREEN
            i = (y * n + x) * 4
            hi[i], hi[i + 1], hi[i + 2], hi[i + 3] = col[0], col[1], col[2], 255

    # Box-downsample SSxSS -> 1 for anti-aliasing.
    out = bytearray(size * size * 4)
    area = SS * SS
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                base = ((y * SS + sy) * n + x * SS) * 4
                for sx in range(SS):
                    j = base + sx * 4
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
