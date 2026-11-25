#!/usr/bin/env bash
# Crée, pour chaque photo réelle de tests/ai-eval/images, une vidéo de 10 s (panoramique lent
# sur la photo, 1280×720, H.264) imitant un client qui filme la pièce. Les vidéos passent ensuite
# par le vrai pipeline de la phase 3 (navigateur : compression, extraction et sélection d'images).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p videos
for img in images/*.jpg; do
  file "$img" | grep -q "JPEG image" || continue   # téléchargement incomplet : ignoré
  name=$(basename "$img" .jpg)
  out="videos/$name.mp4"
  [ -f "$out" ] && continue
  ffmpeg -loglevel error -y -loop 1 -i "$img" \
    -vf "scale=2560:-2,zoompan=z='1.3-0.001*on':x='(iw-iw/zoom)*on/300':y='(ih-ih/zoom)/2':d=300:s=1280x720:fps=30,format=yuv420p" \
    -t 10 -c:v libx264 -preset veryfast -crf 23 -an "$out"
  echo "vidéo : $out"
done
