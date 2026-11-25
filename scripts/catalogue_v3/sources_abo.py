"""
Extraction des observations Amazon Berkeley Objects (ABO, CC BY 4.0).

Une observation = une fiche produit (item_id, domaine). Les dimensions sont celles du champ
`item_dimensions` (dimensions déclarées du produit). Aucune valeur n'est corrigée ni complétée :
les incohérences sont signalées, jamais réparées.
"""
from __future__ import annotations
import glob
import gzip
import json
import os
import re
import unicodedata

from taxonomie import classer

CONVERSIONS_CM = {"inches": 2.54, "centimeters": 1.0, "millimeters": 0.1, "meters": 100.0, "feet": 30.48, "micrometer": 0.0001}
LICENCE = "CC BY 4.0"
NOM_SOURCE = "Amazon Berkeley Objects (ABO) — Amazon.com"
URL_JEU = "https://amazon-berkeley-objects.s3.amazonaws.com/index.html"


def normaliser(texte: str) -> str:
    t = unicodedata.normalize("NFD", texte.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = t.replace(" ", " ").replace("”", '"').replace("″", '"').replace("’", "'")
    return re.sub(r"[^a-z0-9\"'.,x/&+ -]+", " ", t)


def valeurs(champ, langue_preferee="en") -> list[str]:
    if not champ:
        return []
    out = [c.get("value") for c in champ if isinstance(c, dict) and c.get("value")]
    pref = [c.get("value") for c in champ if isinstance(c, dict) and str(c.get("language_tag", "")).startswith(langue_preferee) and c.get("value")]
    return pref + [v for v in out if v not in pref]


# Dimensions annoncées dans le nom du produit (pour corroborer, jamais pour remplacer).
MOTIF_TRIPLE = re.compile(r"(\d{1,4}(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d{1,4}(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d{1,4}(?:[.,]\d+)?)\s*(cm|mm|in|inch|inches|\")")
MOTIF_POUCES = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*(?:\"|in\b|inch(?:es)?\b|-inch\b)\s*([whdl])?\b")


def dimensions_du_nom(nom: str) -> list[float]:
    """Valeurs en cm explicitement écrites dans le nom (triplets « 101 x 40 x 113 cm », « 47.2"W »)."""
    n = nom.lower().replace("”", '"').replace("″", '"')
    vals: list[float] = []
    for m in MOTIF_TRIPLE.finditer(n):
        unite = m.group(4)
        f = 0.1 if unite == "mm" else 2.54 if unite in ("in", "inch", "inches", '"') else 1.0
        vals += [float(g.replace(",", ".")) * f for g in m.groups()[:3]]
    for m in MOTIF_POUCES.finditer(n):
        if m.group(2):  # « 47.2"W », « 72 inch H » : dimension explicitement nommée
            vals.append(float(m.group(1)) * 2.54)
    return vals


def lire_abo(dossier: str, date_collecte: str):
    """Génère (observation, sous-catégorie) pour chaque fiche ABO classée ; compte les fiches hors périmètre."""
    hors = {}
    for chemin in sorted(glob.glob(os.path.join(dossier, "listings", "metadata", "listings_*.json.gz"))):
        with gzip.open(chemin, "rt", encoding="utf-8") as f:
            for ligne in f:
                d = json.loads(ligne)
                pt = d.get("product_type")
                pt = pt[0]["value"] if isinstance(pt, list) and pt else pt
                noms = valeurs(d.get("item_name"))
                if not noms:
                    continue
                texte = " | ".join(normaliser(n) for n in noms)
                sc = classer(texte, pt)
                if sc is None:
                    hors[pt] = hors.get(pt, 0) + 1
                    continue
                dims = d.get("item_dimensions") or {}
                brut = {}
                for k in ("height", "length", "width"):
                    v = dims.get(k)
                    if not v or v.get("value") in (None, 0) or v.get("unit") not in CONVERSIONS_CM:
                        continue
                    brut[k] = (float(v["value"]), v["unit"])
                cm = {k: round(val * CONVERSIONS_CM[u], 1) for k, (val, u) in brut.items()}
                horiz = sorted([cm[k] for k in ("length", "width") if k in cm], reverse=True)
                marque = (valeurs(d.get("brand")) or [""])[0].strip()
                modele = (valeurs(d.get("model_number")) or [""])[0].strip()
                obs = {
                    "id_observation": f"OBS-ABO-{d['item_id']}-{d.get('domain_name', '')}",
                    "source": "ABO",
                    "nom_source": NOM_SOURCE,
                    "url_source": f"https://www.{d.get('domain_name', 'amazon.com')}/dp/{d['item_id']}",
                    "url_jeu_de_donnees": URL_JEU,
                    "licence": LICENCE,
                    "statut_reutilisation": "commerciale autorisée (attribution obligatoire)",
                    "date_collecte": date_collecte,
                    "fabricant": "",
                    "marque": marque,
                    "nom_commercial": noms[0][:200],
                    "reference_produit": modele or "",
                    "identifiant_source": d["item_id"],
                    "domaine": d.get("domain_name", ""),
                    "pays": d.get("country", ""),
                    "type_produit_source": pt or "",
                    "categorie_source": " > ".join(n.get("path", "") for n in (d.get("node") or [])[:1]),
                    "hauteur_cm": cm.get("height"),
                    "largeur_cm": horiz[0] if horiz else None,
                    "profondeur_cm": horiz[1] if len(horiz) > 1 else None,
                    "dimensions_origine": "; ".join(f"{k}={brut[k][0]} {brut[k][1]}" for k in ("length", "width", "height") if k in brut),
                    "unite_origine": ",".join(sorted({u for _, u in brut.values()})),
                    "type_dimensions": "produit (déclarées sur la fiche, monté supposé)",
                    "dimensions_du_nom": dimensions_du_nom(noms[0]),
                    "texte_classement": texte,
                }
                yield obs, sc
    lire_abo.hors_perimetre = hors
