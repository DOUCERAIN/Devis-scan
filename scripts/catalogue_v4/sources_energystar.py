"""
Observations issues des listes publiques de produits certifiés ENERGY STAR (Agence américaine de protection de
l'environnement, EPA) — ajout de la version 4 (26/11/2026).

Licence : chaque jeu renvoie à https://edg.epa.gov/EPA_Data_License.html : « sauf mention contraire, les données
produites par l'EPA sont dans le domaine public » (17 U.S.C. § 105) ; le jeu des lave-vaisselle affiche en plus
« Public Domain ». Réutilisation commerciale autorisée, sans attribution obligatoire (mention recommandée).

Téléchargement : API publique sans clé (Socrata), https://data.energystar.gov/resource/<id>.json, paginée
(voir rapport_sources.md). Fichiers dans data/catalogue-v4/cache/energystar/ (non versionnés).

Règles :
  - dimensions publiées en pouces, converties en centimètres (× 2,54), jamais complétées : les réfrigérateurs n'ont
    que la hauteur et la largeur, les lave-vaisselle que la largeur et la profondeur ; ces fiches restent partielles ;
  - modèles du marché nord-américain (États-Unis, Canada) : souvent plus grands que les modèles européens, signalé ;
  - un modèle = marque + référence ; aucune image, aucune autre donnée reprise.
"""
from __future__ import annotations
import json
import os

from taxonomie import PAR_ID

LICENCE = "Domaine public (données de l'EPA, 17 U.S.C. § 105 — https://edg.epa.gov/EPA_Data_License.html)"
STATUT = "commerciale autorisée (domaine public)"
URL_JEU = "https://data.energystar.gov"
NOM = "ENERGY STAR — produits certifiés (EPA, États-Unis)"

# jeu → (fichier, champs H/L/P, champ de type, correspondance type → sous-catégorie, sous-catégorie par défaut)
JEUX = {
    "p5st-her9": ("Réfrigérateurs", ("height_in", "width_in", None), "type", {
        "Compact Refrigerator": "ELM-REF-TOP", "Bottom Freezer": "ELM-REF-COMBI", "Top Freezer": "ELM-REF",
        "Freezerless and Single Door": "ELM-REF-1P", "Side-by-Side": "ELM-REF-US", "Cooler": "ELM-CAVE",
        "Compact Cooler": "ELM-CAVE", "Upright Freezer": "ELM-CONG", "Chest Freezer": "ELM-CONG-COFFRE"}, None),
    "bghd-e2wd": ("Lave-linge", ("height_inches", "width_inches", "depth_inches"), None, {}, "ELM-LL"),
    "t9u7-4d2j": ("Sèche-linge", ("height_inches", "width_inches", "depth_inches"), None, {}, "ELM-SL"),
    "9jai-gs6t": ("Lave-linge séchants", ("height_inches", "width_inches", "depth_inches"), None, {}, "ELM-LAVANTE-SECHANTE"),
    "q8py-6w3f": ("Lave-vaisselle", (None, "width_inches", "depth_inches"), None, {}, "ELM-LV"),
    # Appareils de cuisson électriques : seules les cuisinières (« Range ») sont retenues ; les plaques encastrées
    # (« Cooktop ») ne se déménagent pas comme un meuble.
    "m6gi-ng33": ("Cuisinières électriques", ("height_inches", "width_inches", "depth_inches"), "product_type", {"Range": "ELM-CUISINIERE"}, None),
}
# Congélateurs (8t9c-g3tn) : téléchargés mais sans aucune dimension publiée — non utilisables.


def _cm(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return round(x * 2.54, 1) if x > 0 else None


def lire_energystar(dossier: str, date_collecte: str):
    rep = os.path.join(dossier, "energystar")
    for jeu, (libelle, (kh, kw, kd), ktype, table, defaut) in JEUX.items():
        chemin = os.path.join(rep, f"{jeu}.jsonl")
        if not os.path.exists(chemin):
            continue
        for ligne in open(chemin, encoding="utf-8"):
            r = json.loads(ligne)
            type_src = r.get(ktype) if ktype else (r.get("load_configuration") or r.get("type") or "")
            sid = table.get(r.get(ktype), defaut) if ktype else defaut
            if not sid:
                continue
            sc = PAR_ID[sid]
            h, w, d = _cm(r.get(kh)) if kh else None, _cm(r.get(kw)) if kw else None, _cm(r.get(kd)) if kd else None
            if h is None and w is None and d is None:
                continue
            horiz = sorted([x for x in (w, d) if x], reverse=True)
            ident = r.get("energy_star_model_identifier") or r.get("pd_id") or f"{r.get('brand_name')}-{r.get('model_number')}"
            remarques = ["modèle du marché nord-américain (États-Unis, Canada)"]
            if r.get("installation_type"):
                remarques.append(f"installation : {r['installation_type']}")
            if r.get("built_in") == "Yes":
                remarques.append("appareil encastrable")
            if r.get("standard_or_counter_depth") not in (None, "", "No"):
                remarques.append("profondeur « comptoir » (counter depth) indiquée, valeur non publiée")
            if kh is None:
                remarques.append("hauteur non publiée par ENERGY STAR")
            if kd is None:
                remarques.append("profondeur non publiée par ENERGY STAR")
            if r.get("capacity_total_volume_ft3"):
                remarques.append(f"capacité {r['capacity_total_volume_ft3']} pi³ (volume intérieur, pas la taille de l'appareil)")
            yield {
                "id_observation": f"OBS-ENERGYSTAR-{jeu}-{r.get('pd_id') or ident}",
                "source": "ENERGYSTAR",
                "nom_source": f"{NOM} — {libelle}",
                "url_source": f"{URL_JEU}/d/{jeu}",
                "url_jeu_de_donnees": f"{URL_JEU}/resource/{jeu}.json",
                "licence": LICENCE,
                "statut_reutilisation": STATUT,
                "date_collecte": date_collecte,
                "fabricant": "",
                "marque": (r.get("brand_name") or "").strip(),
                "nom_commercial": f"{r.get('brand_name', '')} {r.get('model_name') or ''} {r.get('model_number', '')} ({libelle.lower()}, {type_src})".replace("  ", " ")[:200],
                "reference_produit": r.get("model_number") or "",
                "identifiant_source": str(ident),
                "domaine": "data.energystar.gov",
                "pays": "US/CA",
                "type_produit_source": type_src or libelle,
                "categorie_source": libelle,
                "hauteur_cm": h,
                "largeur_cm": horiz[0] if horiz else None,
                "profondeur_cm": horiz[1] if len(horiz) > 1 else None,
                "dimensions_origine": "; ".join(f"{k}={r.get(k)} in" for k in (kh, kw, kd) if k and r.get(k)),
                "unite_origine": "pouces (in), convertis × 2,54",
                "type_dimensions": "appareil (dimensions hors tout déclarées pour la certification)",
                "dimensions_du_nom": [],
                "texte_classement": f"{libelle} | {type_src}",
                "commentaire_source": " ; ".join(remarques),
            }, sc
