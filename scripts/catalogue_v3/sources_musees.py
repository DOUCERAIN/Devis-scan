"""
Observations issues des collections muséales en accès ouvert (métadonnées CC0) — ajout de la version 3.

Sources (fichiers téléchargés dans data/catalogue-v3/cache/, non versionnés ; voir rapport_sources.md) :
  - Metropolitan Museum of Art : MetObjects.csv (dépôt GitHub metmuseum/openaccess, CC0) ;
  - Museum of Modern Art : Artworks.csv (dépôt GitHub MuseumofModernArt/collection, CC0) ;
  - Cleveland Museum of Art : data.csv (dépôt GitHub ClevelandMuseumArt/openaccess), lignes « CC0 » uniquement ;
  - Smithsonian Open Access (dont Cooper Hewitt, musée national d'histoire américaine) : fichiers EDAN publics,
    enregistrements dont `metadata_usage.access` vaut « CC0 » uniquement.

Règles :
  - un objet de musée = un objet réel mesuré ; ses dimensions sont hors tout (« overall ») quand le musée le précise ;
  - les dimensions écrites sans lettres (H, W, D) suivent la convention muséale hauteur × largeur × profondeur :
    l'ordre est alors SUPPOSÉ et signalé dans les commentaires ;
  - une ou deux dimensions seulement : conservées telles quelles, jamais complétées ;
  - maquettes, miniatures, jouets, modèles de brevet, fragments, éléments de meuble, gravures, photos : exclus ;
  - objet daté d'avant 1950 ou non daté : classé en mobilier ancien s'il s'agit d'un meuble (les instruments,
    machines et appareils gardent leur sous-catégorie d'usage).
"""
from __future__ import annotations
import csv
import json
import os
import re

from dims_texte import extraire, vers_hlp
from sources_abo import normaliser
from sources_autres import classer_objet

LICENCE = "CC0 1.0 (domaine public)"
STATUT = "commerciale autorisée (CC0)"
TYPE_DIM = "objet réel (dimensions mesurées par le musée)"

# Objets qui ne sont pas des biens à déménager tels quels, ou dont les dimensions ne sont pas celles de l'objet réel.
EXCLUS = re.compile(
    r"\b(?:model|models|maquette|miniature|miniatures|toy|toys|dolls?|doll'?s furniture|patent|salesman'?s sample|sample|"
    r"photograph|photo|print|prints|engraving|etching|lithograph|drawing|drawings|design for|sketch|study for|plan for|elevation|"
    r"poster|postcard|trade card|advertis\w*|catalog\w*|brochure|manual|book|label|stereograph|negative|lantern slide|"
    r"fragment|fragments|panel from|panels from|element|elements|part of|parts|section of|frontal|veneer|"
    r"leg|legs|foot|feet|finial|mount|mounts|hardware|handle|handles|key|keys|escutcheon|pull|pulls|hinge|lock|caster|castor|"
    r"slipcover|cover|upholstery|cushion|seat cover|textile|sampler|lace|swatch|wallpaper|tile|tiles|"
    r"altar|altarpiece|retable|reliquar\w*|tabernacle|sarcophag\w*|coffin|funerary|tomb|shrine|votive|ex[- ]voto|"
    r"sword|tsuba|kozuka|kogai|menuki|fuchi|kashira|armor|armour|helmet|gun|rifle|pistol|"
    r"painting|sculpture|statue|statuette|figure|figurine|bust|relief|medal|coin|stamp|jewel\w*|"
    r"bulb|circuit|chassis|cabinet only|case only|knob|speaker cone|cartridge|record(?! player)|cylinder record)\b"
)
# Exclusions propres aux collections (constatées sur échantillon) : enregistrements sonores, manuscrits, composants
# électroniques, mobilier de poupée, objets portatifs homonymes (éventail ≠ ventilateur, miroir à main ≠ grand miroir…).
EXCLUS_COLLECTIONS = re.compile(
    r"\b(?:sound recording|recording|transcription|audio tape|tape(?! recorder)|codices|codex|manuscript|folio|illustrated|"
    r"chess|chessman|gaming piece|game piece|doll ?house \w+|kiln|headrest|socket|decal|component|peripheral|logbook|log|"
    r"preparation|pills|match safe|blueprint|schematic|electron tube|vacuum tube|triode|tetrode|pentode|diode|rectifier|"
    r"incandescent|filament|chimney|hand mirror|mouth mirror|mirror case|fan leaf|pleated fan|brise fan|folding fan|hand fan|"
    r"costume|t-shirt|shirt|garment|roller organ roll|piano roll|music roll|glass-stained|stained glass|button|badge|pin|"
    r"fork|knife|spoon|linen|linens|napkin|tablecloth|cloth|galvanometer|gauge|meter|thermopile|detector|insulator|condenser|"
    r"capacitor|vaccine|biological|newspaper|pamphlet|document|slide|photoprint|photography|album|computer game|"
    r"synchrotron|chamber|specimen|sherd|shard|bottle|jar lid|candle|candlestick|script|documentation|coil|dentist'?s?|"
    r"mirror back|slide rule|tracing|plan|on paper|offset|screenprint|screen print|letterpress|gelatin silver|photolithograph|"
    r"silkscreen|lithography|poster|mining lamp|miner'?s|safety lamp|cap lamp|glow lamp|discharge lamp|fluorescent lamp|"
    r"projection lamp|arc lamp|reflector|horn|components|modules?|ornament|ornaments|dial|dials|tool|tools|bar bender|cinerary|"
    r"door|movement|vacuum(?! cleaner| sweeper)|table ?top|top of|walkie|transceiver|cb radio|engine|locomotive|railroad|"
    r"automobile|headlamp|headlight|signal lamp|ship'?s|marine|candelabr\w*|girandole|game|games|concave|convex|optical|scientific|runner|mat|mats|fabric|shade|shades|wallcoverings?|embroidery|woven textiles|stitching)\b"
)
EVENTAIL = re.compile(r"\bfans?\b")
VENTILATEUR = re.compile(r"electric|ceiling|desk fan|table fan|exhaust|ventilat|oscillat|motor")
ECARTES = {"taille": 0, "exclus": 0, "sans_dimension": 0, "non_classes": 0}

ANONYME = re.compile(r"\b(?:unknown|anonymous|unidentified|unrecorded|not recorded|various)\b", re.I)


def _annee(*valeurs):
    for v in valeurs:
        if v is None:
            continue
        m = re.search(r"(?<!\d)(1[0-9]{3}|20[0-2][0-9])(?!\d)", str(v))
        if m:
            return int(m.group(1))
        m = re.search(r"(\d{1,2})(?:st|nd|rd|th) century", str(v), re.I)
        if m:
            return (int(m.group(1)) - 1) * 100 + 50
    return None


def _observation(source, nom_source, ident, url, url_jeu, nom, nom_objet, categorie, date_txt, annee, fabricant,
                 texte_dims, date_collecte, description="", dims_num=None):
    """Construit (observation, sous-catégorie) ou None si l'objet est hors périmètre ou non classable."""
    # Classement sur le NOM DE L'OBJET seulement (« side chair », « radio receiver ») : les titres d'œuvres, de chansons
    # ou de documents (« The Daily Mirror », « Single-octagon rug ») provoquaient des erreurs sur échantillon.
    nom_n = normaliser(nom_objet or nom)
    texte = normaliser(" | ".join(x for x in (nom_objet, nom, categorie, description) if x))
    if EXCLUS.search(texte) or EXCLUS_COLLECTIONS.search(texte) or (EVENTAIL.search(texte) and not VENTILATEUR.search(texte)):
        ECARTES["exclus"] += 1
        return None
    ancien = annee is None or annee < 1950
    sc = classer_objet(nom_n, nom_n, ancien)
    if sc is None:
        ECARTES["non_classes"] += 1
        return None
    if dims_num is not None:
        dims, ordre_suppose = dims_num, False
    else:
        dims, ordre_suppose = extraire(texte_dims or "")
    if not dims:
        ECARTES["sans_dimension"] += 1
        return None  # aucune dimension exploitable : rien à observer
    # Objet nettement plus petit que la sous-catégorie (miroir à main, lampe à huile, miniature non signalée) :
    # ce n'est pas le même type d'objet, il est écarté (et compté dans le rapport de qualité).
    plus_grande = max(v for v in dims.values() if v)
    seuils = [b[0] for k, b in sc.bornes.items() if k in ("grand", "h")]
    if seuils and plus_grande < 0.6 * max(seuils):
        ECARTES["taille"] += 1
        return None
    h, l, p = vers_hlp(dims)
    remarques = []
    if ordre_suppose and len(dims) >= 2:
        remarques.append("dimensions sans lettres : ordre hauteur × largeur × profondeur supposé (convention des musées)")
    if "inconnue" in dims:
        remarques.append("une seule valeur, axe non précisé : rangée en largeur, à vérifier")
    if "diam" in dims:
        remarques.append("objet circulaire : diamètre repris en largeur et en profondeur")
    if annee is not None:
        remarques.append(f"datation : {date_txt or annee}")
    fab = "" if (not fabricant or ANONYME.search(fabricant)) else fabricant
    return {
        "id_observation": f"OBS-{source}-{ident}",
        "source": source,
        "nom_source": nom_source,
        "url_source": url,
        "url_jeu_de_donnees": url_jeu,
        "licence": LICENCE,
        "statut_reutilisation": STATUT,
        "date_collecte": date_collecte,
        "fabricant": fab[:150],
        "marque": "",
        "nom_commercial": (nom or nom_objet)[:200],
        "reference_produit": "",
        "identifiant_source": str(ident),
        "domaine": url_jeu.split("/")[2] if "//" in url_jeu else url_jeu,
        "pays": "",
        "type_produit_source": "objet de collection" + (" ancien" if ancien else " (design, après 1950)"),
        "categorie_source": (categorie or "")[:200],
        "description_source": (description or "")[:300],
        "annee": annee,
        "hauteur_cm": h,
        "largeur_cm": l,
        "profondeur_cm": p,
        "dimensions_origine": (texte_dims or json.dumps(dims_num, ensure_ascii=False))[:300],
        "unite_origine": "cm (valeurs du musée)" if re.search(r"cm", texte_dims or "cm") else "pouces convertis (× 2,54)",
        "type_dimensions": TYPE_DIM + (" — hors tout" if re.search(r"overall|hors tout", texte_dims or "", re.I) else ""),
        "dimensions_du_nom": [],
        "texte_classement": texte[:300],
        "commentaire_source": " ; ".join(remarques),
    }, sc


# --------------------------------------------------------------------------- Met
DEPARTEMENTS_MET = {"European Sculpture and Decorative Arts", "The American Wing", "Modern and Contemporary Art", "Musical Instruments",
                    "Asian Art", "Islamic Art", "Robert Lehman Collection", "Medieval Art", "The Cloisters"}


def lire_met(dossier, date_collecte):
    chemin = os.path.join(dossier, "musees", "MetObjects.csv")
    if not os.path.exists(chemin):
        return
    csv.field_size_limit(10**9)
    for r in csv.DictReader(open(chemin, encoding="utf-8-sig")):
        if r["Department"] not in DEPARTEMENTS_MET or not r["Dimensions"]:
            continue
        if re.search(r"sword|print|drawing|photograph|painting|textile-(?:embroid|lace|printed|woven)|costume|jewel|coin|^mirrors$|codices", r["Classification"], re.I):
            continue
        res = _observation("MET", "The Metropolitan Museum of Art — Open Access", r["Object ID"],
                           r["Link Resource"] or f"https://www.metmuseum.org/art/collection/search/{r['Object ID']}",
                           "https://github.com/metmuseum/openaccess", r["Title"], r["Object Name"], r["Classification"],
                           r["Object Date"], _annee(r["Object Begin Date"] if r["Object Begin Date"] not in ("", "0") else None, r["Object Date"]),
                           r["Artist Display Name"], r["Dimensions"], date_collecte, r["Medium"])
        if res:
            yield res


# --------------------------------------------------------------------------- MoMA
def lire_moma(dossier, date_collecte):
    chemin = os.path.join(dossier, "musees", "moma-Artworks.csv")
    if not os.path.exists(chemin):
        return
    csv.field_size_limit(10**9)
    for r in csv.DictReader(open(chemin, encoding="utf-8-sig")):
        if r["Classification"] != "Design" or r["Department"] != "Architecture & Design":
            continue
        f = lambda k: round(float(r[k]), 1) if r.get(k) not in (None, "", "0") else None
        dims = {k: v for k, v in (("h", f("Height (cm)")), ("w", f("Width (cm)")), ("d", f("Depth (cm)")), ("diam", f("Diameter (cm)")), ("l", f("Length (cm)"))) if v}
        if not dims:
            continue
        res = _observation("MOMA", "The Museum of Modern Art — Collection", r["ObjectID"], r["URL"] or f"https://www.moma.org/collection/works/{r['ObjectID']}",
                           "https://github.com/MuseumofModernArt/collection", r["Title"], "", r["Classification"], r["Date"], _annee(r["Date"]),
                           r["Artist"], r["Dimensions"], date_collecte, r["Medium"], dims_num=dims)
        if res:
            yield res


# --------------------------------------------------------------------------- Cleveland
TYPES_CMA = {"Furniture and woodwork", "Musical Instrument", "Tools and Equipment", "Miscellaneous", "Wood", "Metalwork", "Textile", "Lacquer", "Stone"}


def lire_cma(dossier, date_collecte):
    chemin = os.path.join(dossier, "musees", "cma-data.csv")
    if not os.path.exists(chemin):
        return
    csv.field_size_limit(10**9)
    for r in csv.DictReader(open(chemin, encoding="utf-8-sig")):
        if r["share_license_status"] != "CC0" or r["type"] not in TYPES_CMA or not r["measurements"]:
            continue
        createur = re.sub(r"\s*\(.*", "", r.get("creators") or "") if r.get("creators") not in ("", "[]") else ""
        res = _observation("CMA", "Cleveland Museum of Art — Open Access", r["id"], r["url"], "https://github.com/ClevelandMuseumArt/openaccess",
                           r["title"], "", r["type"], r["creation_date"], _annee(r["creation_date_earliest"], r["creation_date"]),
                           createur, r["measurements"], date_collecte, r.get("technique", ""))
        if res:
            yield res


# --------------------------------------------------------------------------- Smithsonian
def _contenus(liste, labels=None):
    out = []
    for x in liste or []:
        if isinstance(x, dict) and (labels is None or x.get("label") in labels):
            out.append(str(x.get("content", "")))
        elif isinstance(x, str):
            out.append(x)
    return out


def lire_smithsonian(dossier, date_collecte):
    rep = os.path.join(dossier, "smithsonian")
    if not os.path.isdir(rep):
        return
    vus = set()
    for fichier in sorted(os.listdir(rep)):
        if not fichier.endswith(".v2.jsonl"):
            continue
        for ligne in open(os.path.join(rep, fichier), encoding="utf-8"):
            try:
                rec = json.loads(ligne)
            except ValueError:
                continue
            c = rec.get("content", {})
            dnr = c.get("descriptiveNonRepeating", {})
            if (dnr.get("metadata_usage") or {}).get("access") != "CC0":
                continue
            rid = dnr.get("record_ID") or rec.get("id")
            if rid in vus:
                continue
            vus.add(rid)
            ft = c.get("freetext", {})
            titre = dnr.get("title", {}).get("content", "") if isinstance(dnr.get("title"), dict) else str(dnr.get("title", ""))
            # « Object Name » (NMAH) est le nom de l'objet ; « Type » (Cooper Hewitt) est souvent une rubrique générale
            # (« Decorative Arts ») : sans « Object Name », le titre (« Side chair ») sert de nom d'objet.
            noms = _contenus(ft.get("objectType"), {"Object Name"}) + _contenus(ft.get("objectType"), {"Type"})
            mesures = [m for m in _contenus(ft.get("physicalDescription"), {"Measurements", "Dimensions", "Physical Description"}) if re.search(r"\d", m)]
            if not mesures:
                continue
            mesure = next((m for m in mesures if re.search(r"overall", m, re.I)), mesures[0])
            date_txt = "; ".join(_contenus(ft.get("date")))
            fabricant = "; ".join(_contenus(ft.get("name"))[:2])
            unite = dnr.get("unit_code", rec.get("unitCode", ""))
            res = _observation("SMITHSONIAN", f"Smithsonian Open Access ({dnr.get('data_source', unite)})", rid,
                               dnr.get("guid") or f"https://www.si.edu/object/{rid}", "https://www.si.edu/openaccess",
                               titre, (_contenus(ft.get("objectType"), {"Object Name"}) or [""])[0], " ; ".join(noms[:4]), date_txt, _annee(date_txt), fabricant, mesure,
                               date_collecte, "; ".join(_contenus(ft.get("physicalDescription"), {"Medium"}))[:200])
            if res:
                yield res
