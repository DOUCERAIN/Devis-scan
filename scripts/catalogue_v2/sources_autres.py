"""
Observations issues de Wikidata (CC0) et du catalogue ouvert ItemFits (réutilisation commerciale incertaine).
"""
from __future__ import annotations
import csv
import json
import os

from sources_abo import normaliser
from taxonomie import PAR_ID, classer

# --------------------------------------------------------------------------- Wikidata
LICENCE_WD = "CC0 1.0 (domaine public)"

# Classes Wikidata retenues comme mobilier transportable (les objets religieux, funéraires ou archéologiques
# — retables, autels, sarcophages, reliquaires… — sont hors périmètre d'un déménagement).
CLASSES_ANCIEN = [
    ("ANC-ARMOIRE", r"\b(?:armoire|wardrobe|kleiderschrank|schrank|kast|garderobe|armadio|armario|klerenkast)\b"),
    ("ANC-COMMODE", r"\b(?:commode|chest of drawers|kommode|ladekast|cassettone|comoda|chiffonnier|semainier|dresser)\b"),
    ("ANC-BUFFET", r"\b(?:buffet|cabinet|kabinet|dressoir|sideboard|vaisselier|bahut|credenza|kabinetkast|cupboard|vitrine|display case|bookcase|bibliotheque)\b"),
    ("ANC-COFFRE", r"\b(?:coffre|chest|kist|truhe|cassone|trunk|malle|arca|baule)\b"),
    ("ANC-FAUTEUIL", r"\b(?:fauteuil|armchair|bergere|sessel|leunstoel|poltrona|sillon|easy chair|wing chair)\b"),
    ("ANC-CHAISE", r"\b(?:chaise|chair|stoel|stuhl|sedia|silla|tabouret|stool|bench|banc|bank|settle)\b"),
    ("ANC-TABLE", r"\b(?:table|tafel|tisch|tavolo|mesa|gueridon|console)\b"),
    ("ANC-BUREAU", r"\b(?:bureau|desk|secretaire|secretary|schreibtisch|schrijfbureau|scrittoio|escritorio|writing)\b"),
    ("ANC-LIT", r"\b(?:lit|bed|bett|letto|cama|daybed|cradle|berceau|wieg)\b"),
    ("DIV-HORLOGE-COMTOISE", r"\b(?:longcase|grandfather clock|horloge comtoise|horloge de parquet|staande klok|standuhr)\b"),
    ("MUS-PIANO-DROIT", r"\b(?:upright piano|piano droit|pianino)\b"),
    ("MUS-PIANO-QUEUE", r"\b(?:grand piano|piano a queue|flugel|vleugel)\b"),
    ("ANC-AUTRE", r"\b(?:screen|paravent|kamerscherm|furniture|meuble|mobel|meubel|mobile|mueble|stand|etagere|shelf)\b"),
]
EXCLUS_WD = r"\b(?:retable|altar|autel|sarcophag|coffin|cercueil|votive|votif|tabernacle|predell|font|fonts|pulpit|chaire|reliquar|reliquaire|triptych|polyptych|antependium|inscription|mummy|momie|archaeolog|archeolog|headrest|appui[- ]tete|flagpole|candlestick|chandelier|candelabr|sundial|cadran|model|maquette|ex[- ]voto|shrine|chasse|ark|torah|iconostas|bier|ossuary|altarpiece|painting|peinture|sculpture|relief|fragment|doll|poupee|miniature)\b"


def lire_wikidata(dossier: str, date_collecte: str):
    """Observations Wikidata : objets réels (souvent de musée) avec au moins une dimension."""
    import re
    ent_path = os.path.join(dossier, "wikidata", "entities.json")
    entites = json.load(open(ent_path)) if os.path.exists(ent_path) else {}
    items: dict[str, dict] = {}
    for fichier in sorted(os.listdir(os.path.join(dossier, "wikidata"))):
        if not fichier.startswith("Q") or not fichier.endswith(".json"):
            continue
        try:
            data = json.load(open(os.path.join(dossier, "wikidata", fichier)))
        except Exception:
            continue
        for b in data["results"]["bindings"]:
            qid = b["item"]["value"].rsplit("/", 1)[-1]
            it = items.setdefault(qid, {"classes": set(), "w": set(), "h": set(), "l": set(), "d": set(), "th": set(), "diam": set()})
            it["classes"].add(b["class"]["value"].rsplit("/", 1)[-1])
            for k in ("w", "h", "l", "d", "th", "diam"):
                if k in b:
                    it[k].add(round(float(b[k]["value"]) * 100, 1))  # mètres → cm
    lire_wikidata.sans_libelle = 0
    for qid, it in items.items():
        e = entites.get(qid)
        if e is None:
            lire_wikidata.sans_libelle += 1
            continue
        labels = e["labels"]
        nom = labels.get("fr") or labels.get("en") or next(iter(labels.values()), qid)
        classes_txt = " | ".join(
            normaliser(" ".join(entites.get(c, {}).get("labels", {}).get(l, "") for l in ("en", "fr", "nl", "de")))
            for c in sorted(it["classes"])
        )
        texte = normaliser(" ".join(labels.get(l, "") for l in ("en", "fr", "nl", "de"))) + " | " + classes_txt
        if re.search(EXCLUS_WD, texte):
            continue
        ancien = bool(e["collection"]) or any(t and t[:5].lstrip("+-").isdigit() and int(t[1:5]) < 1950 for t in e["inception"])
        sc = None
        if ancien:
            for sid, motif in CLASSES_ANCIEN:
                if re.search(motif, classes_txt) or re.search(motif, texte):
                    sc = PAR_ID[sid]
                    break
        else:
            sc = classer(texte, None)
        if sc is None:
            continue
        def premier(k):
            v = sorted(it[k])
            return v[0] if v else None
        h = premier("h")
        horiz = sorted([x for x in (premier("w"), premier("l"), premier("d") or premier("th"), premier("diam")) if x], reverse=True)[:2]
        multiples = [k for k in ("w", "h", "l", "d") if len(it[k]) > 1]
        yield {
            "id_observation": f"OBS-WD-{qid}",
            "source": "WIKIDATA",
            "nom_source": "Wikidata (Wikimedia Foundation)",
            "url_source": f"https://www.wikidata.org/wiki/{qid}",
            "url_jeu_de_donnees": "https://www.wikidata.org",
            "licence": LICENCE_WD,
            "statut_reutilisation": "commerciale autorisée (CC0)",
            "date_collecte": date_collecte,
            "fabricant": ", ".join(entites.get(m, {}).get("labels", {}).get("fr") or entites.get(m, {}).get("labels", {}).get("en") or m for m in e["manufacturer"][:2]),
            "marque": "",
            "nom_commercial": nom[:200],
            "reference_produit": ", ".join(e.get("inventory", [])[:1]),
            "identifiant_source": qid,
            "domaine": "wikidata.org",
            "pays": "",
            "type_produit_source": "objet de collection" if ancien else "objet référencé",
            "categorie_source": classes_txt[:200],
            "hauteur_cm": h,
            "largeur_cm": horiz[0] if horiz else None,
            "profondeur_cm": horiz[1] if len(horiz) > 1 else None,
            "dimensions_origine": "; ".join(f"{k}={sorted(it[k])}" for k in ("w", "l", "d", "h", "th", "diam") if it[k]),
            "unite_origine": "m (valeurs normalisées Wikidata)",
            "type_dimensions": "objet réel (dimensions hors tout, souvent mesurées par un musée)",
            "dimensions_du_nom": [],
            "texte_classement": texte[:300],
            "commentaire_source": ("plusieurs valeurs pour " + ", ".join(multiples) + " (la plus petite est retenue)") if multiples else "",
        }, sc


# --------------------------------------------------------------------------- ItemFits
def lire_itemfits(dossier: str, date_collecte: str):
    """Catalogue ouvert ItemFits : conservé à titre documentaire (conditions contradictoires, voir rapport_sources.md)."""
    chemin = os.path.join(dossier, "itemfits-catalog.csv")
    if not os.path.exists(chemin):
        return
    lignes = (l for l in open(chemin, encoding="utf-8-sig") if not l.startswith("#"))
    for r in csv.DictReader(lignes):
        if r["section"] not in ("furniture", "mattresses", "appliances", "ikea"):
            continue
        texte = normaliser(r["name"] + " " + r.get("configuration", "") + " " + r.get("notes", ""))
        sc = classer(texte, None)
        if sc is None:
            continue
        mm = lambda k: round(float(r[k]) / 10, 1) if r.get(k) not in (None, "", "0") else None
        horiz = sorted([x for x in (mm("width_mm"), mm("depth_mm")) if x], reverse=True)
        yield {
            "id_observation": f"OBS-ITEMFITS-{r['id']}",
            "source": "ITEMFITS",
            "nom_source": "ItemFits Open Catalog Database" + (f" (d'après : {r['source_name']})" if r.get("source_name") else ""),
            "url_source": r.get("source_url") or "https://itemfits.com/data/catalog",
            "url_jeu_de_donnees": "https://itemfits.com/data/catalog",
            "licence": "« Free to reuse with attribution » (page du catalogue) ; conditions générales restrictives",
            "statut_reutilisation": "incertaine — documentaire uniquement",
            "date_collecte": date_collecte,
            "fabricant": "IKEA" if r["section"] == "ikea" else "",
            "marque": "IKEA" if r["section"] == "ikea" else "",
            "nom_commercial": r["name"][:200],
            "reference_produit": (r.get("notes") or "").replace("SKU ", "") if "SKU" in (r.get("notes") or "") else "",
            "identifiant_source": r["id"],
            "domaine": "itemfits.com",
            "pays": "",
            "type_produit_source": r["section"],
            "categorie_source": r.get("configuration", ""),
            "hauteur_cm": mm("height_mm"),
            "largeur_cm": horiz[0] if horiz else None,
            "profondeur_cm": horiz[1] if len(horiz) > 1 else None,
            "dimensions_origine": f"width={r['width_mm']} mm; depth={r['depth_mm']} mm; height={r['height_mm']} mm",
            "unite_origine": "mm",
            "type_dimensions": "référence générique" if r["section"] != "ikea" else "produit (fiche fabricant citée par ItemFits)",
            "dimensions_du_nom": [],
            "texte_classement": texte[:300],
            "commentaire_source": f"niveau ItemFits : {r.get('tier', '')} ; provenance : {r.get('dimension_provenance', '')}".strip(),
        }, sc
