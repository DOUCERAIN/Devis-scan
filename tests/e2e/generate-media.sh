#!/usr/bin/env bash
# Génère les vidéos de test du parcours client (nécessite ffmpeg). Fichiers non versionnés.
set -euo pipefail
cd "$(dirname "$0")/media"
# Panoramique sur une grande image (comme quand on filme une pièce en tournant), avec du son.
ffmpeg -loglevel error -y -f lavfi -i "mandelbrot=size=5760x1080:rate=30" -f lavfi -i "sine=frequency=440:duration=10" -t 10 \
  -vf "crop=1920:1080:x='t*380':y=0" -c:v libvpx-vp9 -b:v 6M -deadline realtime -cpu-used 8 -c:a libopus salon-1080p.webm
ffmpeg -loglevel error -y -f lavfi -i "testsrc=size=1280x720:rate=30:duration=6" -c:v libx264 -pix_fmt yuv420p -b:v 3M cuisine-h264.mp4
ffmpeg -loglevel error -y -f lavfi -i "nullsrc=size=1920x1080:rate=30:duration=10" -vf "geq=random(1)*255:128:128" \
  -c:v libx264 -preset ultrafast -b:v 52M -maxrate 52M -bufsize 10M -pix_fmt yuv420p trop-lourde.mp4
printf 'ceci n est pas une video' > faux.mp4
ffmpeg -loglevel error -y -f lavfi -i "mandelbrot=size=2400x480:rate=30" -t 5 -vf "crop=640:480:x='t*340':y=0" -pix_fmt yuv420p camera.y4m
echo "Vidéos de test générées dans $(pwd)"
