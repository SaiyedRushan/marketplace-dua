#!/usr/bin/env python3
"""Generate the extension icons (no external deps).

Draws a minimalist emerald disc bearing a cream crescent beside a small
shopping bag — the crescent for the du'a, the bag for the marketplace.
Supersampled for smooth edges, written as PNGs at the sizes Chrome asks for.
"""

import math
import os
import struct
import zlib

# Palette
GREEN = (14, 124, 90)     # disc
CREAM = (250, 247, 237)   # crescent + bag

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


def rrect_sdf(px, py, cx, cy, hx, hy, r):
    """Signed distance to a rounded rectangle (negative = inside)."""
    qx = abs(px - cx) - (hx - r)
    qy = abs(py - cy) - (hy - r)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def render(size):
    n = size * SS
    c = n / 2.0
    R = n * 0.5 - 1

    # --- Crescent (left) ---
    moon_cx, moon_cy, r_moon = n * 0.355, n * 0.50, n * 0.182
    cut_cx, cut_cy, r_cut = n * 0.452, n * 0.452, n * 0.176

    # --- Shopping bag (right) ---
    bag_cx, bag_cy = n * 0.645, n * 0.565
    bag_hx, bag_hy = n * 0.105, n * 0.110
    bag_r = n * 0.028
    bag_top = bag_cy - bag_hy
    handle_cx, handle_cy = bag_cx, bag_top
    handle_ro, handle_ri = n * 0.082, n * 0.052

    hi = bytearray(n * n * 4)
    for y in range(n):
        for x in range(n):
            px, py = x + 0.5, y + 0.5
            if not in_circle(px, py, c, c, R):
                continue  # leave transparent

            crescent = in_circle(px, py, moon_cx, moon_cy, r_moon) and not in_circle(px, py, cut_cx, cut_cy, r_cut)

            body = rrect_sdf(px, py, bag_cx, bag_cy, bag_hx, bag_hy, bag_r) <= 0
            dh = math.hypot(px - handle_cx, py - handle_cy)
            handle = (handle_ri <= dh <= handle_ro) and (py <= handle_cy)
            bag = body or handle

            col = CREAM if (crescent or bag) else GREEN
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
