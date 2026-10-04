#!/usr/bin/env python3
"""Make a QR code for a URL, entirely on this machine (nothing is sent to any online service).

Usage:  python scripts/make_qr.py <url> [--out-dir DIR]
Writes: qr-demo.png (needs Pillow) and qr-demo.svg, and prints a text QR to the terminal.
Needs:  pip install qrcode pillow     (the SVG and text QR need only `qrcode`)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

PIP_HINT = "pip install qrcode pillow"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Create qr-demo.png and qr-demo.svg for a URL.")
    ap.add_argument("url", help="address to encode, for example http://192.168.1.20:5173/welcome")
    ap.add_argument("--out-dir", default=".", help="where to write the files (default: current folder)")
    args = ap.parse_args(argv)

    parsed = urlparse(args.url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        print("Please pass a full http:// or https:// address.", file=sys.stderr)
        return 2

    try:
        import qrcode
        import qrcode.image.svg
    except ImportError:
        print("The 'qrcode' package is not installed. Install it with one command:\n")
        print(f"    {PIP_HINT}\n")
        print("(Use a virtual environment outside the project if you prefer.) Address to share meanwhile:")
        print(f"    {args.url}")
        return 1

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(args.url)
    qr.make(fit=True)

    svg_path = out / "qr-demo.svg"
    qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(str(svg_path))
    print(f"Wrote {svg_path}")

    try:
        png_path = out / "qr-demo.png"
        qr.make_image(fill_color="black", back_color="white").save(str(png_path))
        print(f"Wrote {png_path}")
    except Exception:  # Pillow missing: the PNG is optional
        print(f"Skipped the PNG (needs Pillow: {PIP_HINT}). The SVG and the text QR below still work.")

    print(f"\nAddress: {args.url}\n")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to cp1252
        qr.print_ascii(invert=True)
    except Exception:
        print("(Could not draw the text QR in this terminal; use the PNG or SVG file.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
