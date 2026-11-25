"""
Corrections et contrôles de dimensions de la version 5 (27/11/2026).

Principe : une dimension n'est jamais modifiée parce qu'elle paraît inhabituelle. Une correction n'est faite que si
une information VÉRIFIABLE de la même source la justifie. Chaque correction conserve les valeurs d'origine (v4),
les valeurs corrigées, le motif, la méthode, la source justificative et un niveau de confiance.

Corrections possibles (avant le contrôle de plausibilité) :
  A. Orientation — la hauteur est ÉCRITE dans le nom du produit (« 19.25"H », « 120 cm H », « Height 42 in ») et
     correspond à l'une des trois dimensions publiées : cette dimension devient la hauteur. Confiance élevée.
  B. Unité — les dimensions écrites dans le nom (au moins deux) correspondent exactement aux dimensions publiées
     multipliées ou divisées par 10 ou 2,54 : le facteur est appliqué. Confiance élevée.
  C. Colis ou dimensions erronées — le nom donne trois dimensions qui ne correspondent pas aux dimensions publiées :
     les dimensions du nom (celles du produit annoncé par le vendeur, même fiche) remplacent les dimensions publiées.
     L'orientation reste inconnue sauf lettres H/W/D. Confiance moyenne.

Contrôles (après qualification) :
  - orientation : rang de la hauteur (plus petite, intermédiaire, plus grande dimension) comparé au rang dominant de
    la sous-catégorie ; « vérifiée », « conforme », « ambiguë » (exclue des dimensions médianes, pas du volume) ;
  - produit modulaire (élément de canapé modulable, module de rangement) : exclu des statistiques ;
  - meuble vendu à plat probable (profil de colis sans dimensions annoncées) : exclu des statistiques.
"""
from __future__ import annotations
import re

NB = r"(\d+(?:[.,]\d+)?)"
# « 19.25"H », « 30.3" W », « 120 cm H », « 47 in. high », « H 120 cm », « Height: 42" »
HAUTEUR_NOM = [
    re.compile(NB + r"\s*(?:\"|''|in\b\.?|inch(?:es)?|po\b|cm)\s*(?:h\b(?!\s*x)|high\b(?!\s*(?:gloss|back|density|quality|pressure|speed|end|top|performance|resolution|chair))|height\b|tall\b|hauteur\b|hoch\b)", re.I),
    re.compile(r"(?:\bh\b\.?|height|hauteur|höhe|altezza|altura)\s*[:=]?\s*" + NB + r"\s*(\"|''|in\b|inch(?:es)?|cm)", re.I),
]
MODULAIRE = re.compile(r"\b(?:sectional component|component|module|modular piece|corner piece|wedge|armless chair\b.*sectional|"
                       r"element|élément|modulelement|ottoman piece)\b", re.I)


# Ordre des dimensions écrit dans le nom : « (L x W x H) », « (B x H x T) », « (largo x ancho x alto) »…
LETTRE_AXE = {"h": "h", "a": "h", "alto": "h", "altura": "h", "height": "h", "hauteur": "h", "höhe": "h", "altezza": "h",
              "w": "l", "b": "l", "la": "l", "lu": "p", "pr": "p", "width": "l", "ancho": "l", "largeur": "l", "breite": "l", "larghezza": "l",
              "l": "p", "d": "p", "t": "p", "p": "p", "depth": "p", "length": "p", "largo": "p", "fondo": "p", "tiefe": "p",
              "profondeur": "p", "profondità": "p", "longueur": "p", "lunghezza": "p"}
MOTIF_ORDRE = re.compile(r"\(\s*([a-zäöüéà]+)\.?\s*x\s*([a-zäöüéà]+)\.?\s*x\s*([a-zäöüéà]+)\.?\s*\)", re.I)
EXTENSIBLE = re.compile(r"\d\s*[-/]\s*\d{2,3}\s*x|extendable|extensible|allungabile|ausziehbar|extensible|ampliable|seats \d+\s*-\s*\d+", re.I)


def ordre_du_nom(nom: str):
    m = MOTIF_ORDRE.search(nom)
    if not m:
        return None
    axes = [LETTRE_AXE.get(g.lower()) for g in m.groups()]
    return axes if sorted(a for a in axes if a) == ["h", "l", "p"] else None


def _cm(valeur: str, unite: str) -> float:
    v = float(valeur.replace(",", "."))
    return round(v * (1.0 if unite.lower().startswith("cm") else 2.54), 1)


def hauteur_du_nom(nom: str):
    n = nom.replace("”", '"').replace("″", '"')
    for i, motif in enumerate(HAUTEUR_NOM):
        m = motif.search(n)
        if m:
            if i == 0:
                unite = re.search(r"cm", m.group(0), re.I)
                return _cm(m.group(1), "cm" if unite else "in")
            return _cm(m.group(1), m.group(2))
    return None


def _proche(a, b):
    return a is not None and b is not None and abs(a - b) <= max(1.0, 0.03 * max(a, b))


def _trace(obs, motif, methode, confiance):
    obs.setdefault("dimensions_v4_cm", f"{obs['hauteur_cm']} × {obs['largeur_cm']} × {obs['profondeur_cm']}")
    obs["correction_v5"] = motif
    obs["methode_verification"] = methode
    obs["source_justificative"] = obs.get("url_source", "")
    obs["confiance_correction"] = confiance


def _hauteur_plausible(sc, h):
    b = sc.bornes.get("h") if sc is not None else None
    return b is None or b[0] <= h <= b[1]


def corriger_avant(obs, sc=None):
    """Corrections A, B, C sur une observation brute (avant qualification). Ne touche qu'aux fiches du commerce.
    Orientation étiquetée par la source (ENERGY STAR, MoMA, Wikidata, musées avec lettres H/L/P) : vérifiée."""
    obs.setdefault("orientation", "non évaluée")
    if obs["source"] in ("ENERGYSTAR", "MOMA") and obs["hauteur_cm"]:
        obs["orientation"] = "vérifiée (dimensions étiquetées par la source)"
    elif obs["source"] == "WIKIDATA" and obs["hauteur_cm"]:
        obs["orientation"] = "vérifiée (hauteur étiquetée par la source : propriété P2048)"
    elif obs["source"] in ("MET", "CMA", "SMITHSONIAN") and obs["hauteur_cm"] and "supposé" not in (obs.get("commentaire_source") or ""):
        obs["orientation"] = "vérifiée (dimensions étiquetées par le musée)"
    if obs["source"] != "ABO":
        return
    h, l, p = obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"]
    dims = [d for d in (h, l, p) if d]
    du_nom = obs.get("dimensions_du_nom") or []
    nom = obs["nom_commercial"]
    # B. Unité
    if len(dims) == 3 and len(du_nom) >= 2:
        if not all(any(_proche(v, d) for d in dims) for v in du_nom):
            for f, txt in ((10, "× 10 (millimètres déclarés en centimètres)"), (0.1, "÷ 10"), (2.54, "× 2,54 (pouces déclarés en centimètres)"), (1 / 2.54, "÷ 2,54")):
                if all(any(_proche(v, d * f) for d in dims) for v in du_nom):
                    _trace(obs, f"erreur d'unité corrigée ({txt})", "dimensions écrites dans le nom du produit, même fiche", "élevée")
                    obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"] = (round(x * f, 1) if x else x for x in (h, l, p))
                    h, l, p = obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"]
                    obs["dimensions_du_nom"] = du_nom
                    break
    # C. Dimensions du nom (trois valeurs) différentes des dimensions publiées
    if (len(du_nom) == 3 and len(dims) == 3 and not all(any(_proche(v, d) for d in (h, l, p)) for v in du_nom)
            and "correction_v5" not in obs and not EXTENSIBLE.search(nom)):
        hn = hauteur_du_nom(nom)
        vals = sorted(du_nom, reverse=True)
        ordre = ordre_du_nom(nom)
        if ordre:
            par_axe = dict(zip(ordre, du_nom))
            horiz = sorted([par_axe["l"], par_axe["p"]], reverse=True)
            nouv, orient = (round(par_axe["h"], 1), round(horiz[0], 1), round(horiz[1], 1)), "vérifiée (ordre des dimensions écrit dans le nom)"
        elif hn and any(_proche(hn, v) for v in vals):
            haut = next(v for v in vals if _proche(hn, v))
            reste = sorted([v for v in vals if v is not haut], reverse=True)
            nouv, orient = (round(haut, 1), round(reste[0], 1), round(reste[1], 1)), "vérifiée (hauteur écrite dans le nom)"
        else:
            # Ordre inconnu : hauteur = valeur la plus proche de la hauteur publiée ; orientation marquée ambiguë
            # (exclue des dimensions médianes ; le volume, lui, ne dépend pas de l'ordre).
            haut = min(vals, key=lambda v: abs(v - h))
            reste = sorted(vals, reverse=True)
            reste.remove(haut)
            nouv, orient = (round(haut, 1), round(reste[0], 1), round(reste[1], 1)), "ambiguë (dimensions du nom sans lettres)"
        _trace(obs, "dimensions publiées remplacées par les trois dimensions annoncées dans le nom (colis ou erreur de saisie probable)",
               "comparaison avec le nom du produit, même fiche", "moyenne")
        obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"] = nouv
        obs["orientation"] = orient
        obs["dimensions_du_nom"] = []  # la concordance n'a plus de sens : les valeurs viennent du nom
        return
    # A. Orientation par la hauteur écrite dans le nom (lettre H, ou ordre « (L x W x H) » avec trois valeurs)
    if len(dims) == 3:
        hn = hauteur_du_nom(nom)
        ordre = ordre_du_nom(nom)
        if hn is None and ordre and len(du_nom) == 3:
            hn = dict(zip(ordre, du_nom))["h"]
        if hn:
            if _proche(hn, h):
                obs["orientation"] = "vérifiée (hauteur écrite dans le nom)"
            elif not _hauteur_plausible(sc, hn):
                obs["orientation"] = "ambiguë (hauteur écrite dans le nom incompatible avec la sous-catégorie : coquille probable)"
            else:
                for nom_dim, v in (("largeur", l), ("profondeur", p)):
                    if _proche(hn, v):
                        autres = sorted([x for x in (h, l, p) if x is not v], reverse=True)
                        _trace(obs, f"orientation corrigée : la {nom_dim} publiée ({v} cm) est la hauteur écrite dans le nom", "hauteur écrite dans le nom du produit, même fiche", "élevée")
                        obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"] = v, autres[0], autres[1]
                        obs["orientation"] = "corrigée (hauteur écrite dans le nom)"
                        break


def rang_hauteur(o):
    h, l, p = o["hauteur_cm"], o["largeur_cm"], o["profondeur_cm"]
    if not (h and l and p):
        return None
    if h >= l:
        return "plus grande"
    if h <= p:
        return "plus petite"
    return "intermédiaire"


def controler_orientation(observations):
    """Rang dominant de la hauteur par sous-catégorie (sur les fiches utilisables) ; une fiche qui s'en écarte sans
    vérification est marquée ambiguë. Renvoie le dictionnaire des rangs dominants."""
    from collections import Counter, defaultdict
    par_sc = defaultdict(Counter)
    for o in observations:
        r = rang_hauteur(o)
        if r and o["utilisable_statistiques"] == "oui":
            par_sc[o["sous_categorie_id"]][r] += 1
    dominants = {}
    for sc, c in par_sc.items():
        total = sum(c.values())
        rang, n = c.most_common(1)[0]
        if total >= 5 and n / total >= 0.8:
            dominants[sc] = (rang, round(n / total, 2))
    for o in observations:
        # Dimensions reprises du nom sans lettres : ordre provisoire selon la forme dominante des produits comparables
        # (affichage seulement ; l'observation reste ambiguë et hors des dimensions médianes).
        d = dominants.get(o["sous_categorie_id"])
        if d and o["orientation"].startswith("ambiguë (dimensions du nom") and rang_hauteur(o):
            v = sorted([o["hauteur_cm"], o["largeur_cm"], o["profondeur_cm"]], reverse=True)
            h = {"plus grande": v[0], "intermédiaire": v[1], "plus petite": v[2]}[d[0]]
            v.remove(h)
            o["hauteur_cm"], o["largeur_cm"], o["profondeur_cm"] = h, v[0], v[1]
            o["orientation"] = "ambiguë (dimensions du nom sans lettres ; ordre provisoire selon la forme dominante des produits comparables)"
    for o in observations:
        r = rang_hauteur(o)
        if r is None:
            if o["orientation"] == "non évaluée":
                o["orientation"] = "non évaluable (dimensions incomplètes)"
            continue
        if o["orientation"].startswith(("vérifiée", "corrigée", "ambiguë")):
            continue
        d = dominants.get(o["sous_categorie_id"])
        if d is None:
            o["orientation"] = "non évaluable (pas de forme dominante dans la sous-catégorie)"
        elif r == d[0]:
            o["orientation"] = "conforme à la forme dominante"
        else:
            o["orientation"] = f"ambiguë (hauteur {r} dimension, alors que {int(d[1] * 100)} % des modèles l'ont {d[0]})"
    return dominants


def orientation_fiable(o) -> bool:
    return not o["orientation"].startswith("ambiguë")
