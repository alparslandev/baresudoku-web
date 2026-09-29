import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WHITE = (255, 255, 255, 255)
DARK = (32, 33, 36, 255)
BLUE = (26, 115, 232, 255)
NONE = (0, 0, 0, 0)


def inside_rounded(x, y, size, radius):
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def pixel(x, y, size):
    if not inside_rounded(x + 0.5, y + 0.5, size, size * 0.2):
        return NONE
    left = size * 0.28
    span = size * 0.44
    line = max(2.0, size * 0.028)
    cell = span / 3
    fx = x + 0.5 - left
    fy = y + 0.5 - left
    if fx < -line or fy < -line or fx > span + line or fy > span + line:
        return WHITE
    for k in range(4):
        edge = k * cell
        if abs(fx - edge) <= line / 2 or abs(fy - edge) <= line / 2:
            return DARK
    if cell < fx < 2 * cell and cell < fy < 2 * cell:
        return BLUE
    return WHITE


def png(size):
    rows = []
    for y in range(size):
        row = bytearray(b"\x00")
        for x in range(size):
            row += bytes(pixel(x, y, size))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def write(out_dir):
    for size in (192, 512):
        with open(os.path.join(out_dir, "icon-%d.png" % size), "wb") as f:
            f.write(png(size))


if __name__ == "__main__":
    write(os.path.join(ROOT, "dist"))
