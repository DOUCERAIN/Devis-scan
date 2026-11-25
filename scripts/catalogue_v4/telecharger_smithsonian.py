"""
Téléchargement filtré de Smithsonian Open Access (CC0, stockage public AWS, sans clé).
Chaque fichier est lu puis abandonné : seules les fiches CC0 d'objets transportables portant une
description physique (dimensions) sont conservées dans cache/smithsonian/<unité>.jsonl.
Reprise possible : les fichiers déjà traités sont listés dans <unité>.fait.
Usage : python3 telecharger_smithsonian.py nmah chndm
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
BASE = "https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan"
DOSSIER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "catalogue-v3", "cache", "smithsonian")
MOTS = re.compile(r"\b(?:chair|table|desk|bed|cradle|crib|sofa|settee|couch|chest|cabinet|cupboard|wardrobe|armoire|bureau|dresser|bookcase|shelf|shelves|stool|bench|clock|piano|organ|harp|harpsichord|refrigerator|icebox|freezer|washing machine|washer|dryer|stove|range|oven|microwave|dishwasher|television|tv set|radio|phonograph|record player|jukebox|sewing machine|typewriter|computer|bicycle|tricycle|scooter|stroller|baby carriage|pram|safe|trunk|mirror|lamp|vacuum|fan|heater|air conditioner|sideboard|buffet|highboy|lowboy|secretary|screen|cot|mattress|loom|spinning wheel|cello|double bass|drum|xylophone|marimba|vending machine|cash register|furniture)\b", re.I)

def garder(rec):
    c = rec.get("content", {})
    if c.get("descriptiveNonRepeating", {}).get("metadata_usage", {}).get("access") != "CC0":
        return False
    phys = c.get("freetext", {}).get("physicalDescription", [])
    if not any(re.search(r"\d\s*(?:cm|mm|in\b|in\.|inches|\")", p.get("content", "")) for p in phys):
        return False
    ot = c.get("indexedStructured", {}).get("object_type", [])
    ot = ot if isinstance(ot, list) else [ot]
    titre = c.get("descriptiveNonRepeating", {}).get("title", {})
    titre = titre.get("content", "") if isinstance(titre, dict) else str(titre)
    texte = " ".join([titre] + [o.get("content", "") for o in c.get("freetext", {}).get("objectType", []) if isinstance(o, dict)] + [str(x) for x in ot])
    return bool(MOTS.search(texte))

def traiter(url):
    r = subprocess.run(["curl", "-s", "-m", "300", url], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout:
        return url, None
    gardes = []
    for ligne in r.stdout.splitlines():
        try:
            rec = json.loads(ligne)
            ok = garder(rec)
        except Exception:
            continue
        if ok:
            gardes.append(ligne)
    return url, gardes

for unite in sys.argv[1:]:
    os.makedirs(DOSSIER, exist_ok=True)
    fait_path = os.path.join(DOSSIER, f"{unite}.v2.fait")
    fait = set(open(fait_path).read().split()) if os.path.exists(fait_path) else set()
    urls = [u for u in subprocess.run(["curl", "-s", f"{BASE}/{unite}/index.txt"], capture_output=True, text=True).stdout.split() if u not in fait]
    print(unite, "fichiers à traiter :", len(urls), flush=True)
    with ThreadPoolExecutor(4) as ex, open(os.path.join(DOSSIER, f"{unite}.v2.jsonl"), "a") as out, open(fait_path, "a") as f_fait:
        for url, gardes in ex.map(traiter, urls):
            if gardes is None:
                print("échec", url, flush=True); continue
            for g in gardes: out.write(g + "\n")
            f_fait.write(url + "\n"); f_fait.flush(); out.flush()
    print(unite, "terminé", flush=True)
