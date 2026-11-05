"""Build the Windows program: python build_exe.py  ->  dist/Email Writing Coach.exe

Uses a private virtual environment (or SUITE_VENV), installs PyInstaller there, draws the icon, and packs the
launcher together with the web folder into one .exe that needs no install."""
import os
import struct
import subprocess
import sys
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
NAME = "Email Writing Coach"
COLOR = "#0e7490"
LETTERS = "WC"
GLYPHS = {
    "A": "01110 10001 10001 11111 10001 10001 10001", "B": "11110 10001 10001 11110 10001 10001 11110",
    "C": "01111 10000 10000 10000 10000 10000 01111", "D": "11110 10001 10001 10001 10001 10001 11110",
    "E": "11111 10000 10000 11110 10000 10000 11111", "F": "11111 10000 10000 11110 10000 10000 10000",
    "G": "01111 10000 10000 10111 10001 10001 01111", "H": "10001 10001 10001 11111 10001 10001 10001",
    "I": "01110 00100 00100 00100 00100 00100 01110", "J": "00111 00010 00010 00010 00010 10010 01100",
    "K": "10001 10010 10100 11000 10100 10010 10001", "L": "10000 10000 10000 10000 10000 10000 11111",
    "M": "10001 11011 10101 10101 10001 10001 10001", "N": "10001 11001 10101 10101 10011 10001 10001",
    "O": "01110 10001 10001 10001 10001 10001 01110", "P": "11110 10001 10001 11110 10000 10000 10000",
    "Q": "01110 10001 10001 10001 10101 10010 01101", "R": "11110 10001 10001 11110 10100 10010 10001",
    "S": "01111 10000 10000 01110 00001 00001 11110", "T": "11111 00100 00100 00100 00100 00100 00100",
    "U": "10001 10001 10001 10001 10001 10001 01110", "V": "10001 10001 10001 10001 10001 01010 00100",
    "W": "10001 10001 10001 10101 10101 11011 10001", "X": "10001 10001 01010 00100 01010 10001 10001",
    "Y": "10001 10001 01010 00100 00100 00100 00100", "Z": "11111 00001 00010 00100 01000 10000 11111"}


def pixel(x, y):
    bg = tuple(int(COLOR[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    r = 0.2
    dx, dy = max(r - x, x - (1 - r), 0), max(r - y, y - (1 - r), 0)
    if dx * dx + dy * dy > r * r:
        return (0, 0, 0, 0)
    u, v = (x - 0.14) / 0.72 * 11, (y - 0.3) / 0.4 * 7
    col, row = int(u), int(v)
    if 0 <= v < 7 and 0 <= u < 11 and col != 5:
        glyph = GLYPHS[LETTERS[0 if col < 5 else 1]].split()
        if glyph[row][col if col < 5 else col - 6] == "1":
            return (255, 255, 255, 255)
    return bg


def png(size):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = [pixel((x + i / 4) / size, (y + j / 4) / size) for i in (0.5, 1.5, 2.5, 3.5) for j in (0.5, 1.5, 2.5, 3.5)]
            alpha = sum(s[3] for s in samples) / 16
            if alpha == 0:
                rows += b"\0\0\0\0"
            else:
                rows += bytes(int(sum(s[k] * s[3] for s in samples) / (16 * alpha)) for k in range(3)) + bytes([int(alpha)])

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b""))


def write_icon(path):
    sizes = [16, 32, 48, 64, 128, 256]
    images = [png(s) for s in sizes]
    head = struct.pack("<HHH", 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = b""
    for s, img in zip(sizes, images):
        entries += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(img), offset)
        offset += len(img)
    with open(path, "wb") as fh:
        fh.write(head + entries + b"".join(images))


def main():
    venv = os.environ.get("SUITE_VENV") or os.path.join(ROOT, ".venv")
    py = os.path.join(venv, "Scripts", "python.exe")
    if not os.path.exists(py):
        subprocess.check_call([sys.executable, "-m", "venv", venv])
    if subprocess.call([py, "-m", "PyInstaller", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL):
        subprocess.check_call([py, "-m", "pip", "install", "--quiet", "pyinstaller==6.22.3"])
    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    icon = os.path.join(ROOT, "assets", "app.ico")
    write_icon(icon)
    work = os.path.join(ROOT, "build")
    subprocess.check_call([py, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--windowed", "--name", NAME,
                           "--icon", icon, "--add-data", os.path.join(ROOT, "web") + os.pathsep + "web",
                           "--exclude-module", "tkinter", "--exclude-module", "unittest", "--exclude-module", "pydoc",
                           "--workpath", work, "--specpath", work, os.path.join(ROOT, "run_app.py")], cwd=ROOT)
    print(os.path.join(ROOT, "dist", NAME + ".exe"))


if __name__ == "__main__":
    main()
