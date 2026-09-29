#!/bin/sh
set -e
cd "$(dirname "$0")/.."
rsvg-convert -w 1200 -h 630 art/og.svg -o static/og.png
wc -c static/og.png
