"""
Extraction des dimensions écrites en texte libre par les musées (Met, Cleveland, Smithsonian, MoMA…).

Exemples pris en charge :
  "35 1/4 x 23 1/2 x 20 in. (89.5 x 59.7 x 50.8 cm)"            → H, L, P (convention muséale H × L × P)
  "Overall: 102.9 x 62.2 x 48.3 cm (40 1/2 x 24 1/2 x 19 in.)"
  "overall: 9 1/2 in x 13 7/8 in x 16 in; 24.13 cm x 35.2425 cm x 40.64 cm"
  "H. 84 1/2, W. 42, D. 21 in. (214.6 x 106.7 x 53.3 cm)"
  "H. 214.6 cm, W. 106.7 cm, D. 53.3 cm"
Règles :
  - les centimètres écrits sont préférés aux pouces (jamais de double conversion) ;
  - la partie « overall / hors tout / dimensions générales » est préférée ; sinon la première mesure ;
  - lettres H/W/D/L (ou Height/Width/Depth/Length) respectées quand elles sont présentes ;
  - sans lettres : ordre supposé hauteur × largeur × profondeur (convention des musées), signalé ;
  - une seule ou deux valeurs : conservées telles quelles (aucune complétion).
"""
from __future__ import annotations
import re

NOMBRE = r"\d+(?:[.,]\d+)?"
FRACTION = r"(?:\d+\s+)?\d+/\d+|\d+(?:[.,]\d+)?"


def _num(s: str) -> float:
    s = s.strip().replace(",", ".")
    if "/" in s:
        parts = s.split()
        total = 0.0
        for p in parts:
            if "/" in p:
                a, b = p.split("/")
                total += float(a) / float(b)
            else:
                total += float(p)
        return total
    return float(s)


def _segment(texte: str) -> str:
    """Partie de la description qui décrit l'objet entier."""
    t = texte.replace("×", "x").replace(" ", " ")
    morceaux = re.split(r"[;\n\r]|(?<=\))\s*,?\s*(?=[A-Z][a-z]+\s*[:(])", t)
    for m in morceaux:
        if re.search(r"\b(?:overall|hors tout|dimensions g[ée]n[ée]rales|object|ensemble)\b", m, re.I) and re.search(r"\d", m):
            return m
    return t


LETTRES = {"h": "h", "height": "h", "haut": "h", "hauteur": "h", "w": "w", "width": "w", "l": "l", "length": "l", "larg": "w",
           "largeur": "w", "d": "d", "depth": "d", "deep": "d", "diam": "diam", "diameter": "diam", "dia": "diam", "p": "d", "profondeur": "d"}


def extraire(texte: str):
    """Renvoie (dims: dict avec h/w/l/d/diam en cm, ordre_suppose: bool) ou (None, False)."""
    if not texte or not re.search(r"\d", texte):
        return None, False
    complet = texte.replace("×", "x").replace(" ", " ")
    seg = _segment(complet)
    # 1. Mesures étiquetées en cm : « H. 214.6 cm, W. 106.7 cm »
    etiq = re.findall(r"\b(H|W|D|L|Diam|Dia|Height|Width|Depth|Length|Diameter)\b\.?\s*:?\s*(" + NOMBRE + r")\s*cm", seg, re.I)
    if len(etiq) >= 2:
        dims = {}
        for lettre, v in etiq:
            k = LETTRES.get(lettre.lower())
            if k and k not in dims:
                dims[k] = round(_num(v), 1)
        return dims, False
    # 2. Suite « a x b x c cm » (centimètres), avec ou sans « cm » après chaque valeur
    m = re.search(r"(" + NOMBRE + r")\s*(?:cm)?\s*x\s*(" + NOMBRE + r")\s*(?:cm)?(?:\s*x\s*(" + NOMBRE + r"))?\s*cm\b", seg, re.I)
    if not m:
        m = re.search(r"(" + NOMBRE + r")\s*(?:cm)?\s*x\s*(" + NOMBRE + r")\s*(?:cm)?(?:\s*x\s*(" + NOMBRE + r"))?\s*cm\b", complet, re.I)
    lettres_seg = re.findall(r"\b(H|W|D|L|[Dd]iam)\b\.?", seg)
    if m:
        vals = [round(_num(g), 1) for g in m.groups() if g]
        return _ordonner(vals, lettres_seg), not lettres_seg
    # 3. Valeur unique en cm : « overall: 24.765 cm »
    m1 = re.search(r"(" + NOMBRE + r")\s*cm\b", seg, re.I) or re.search(r"(" + NOMBRE + r")\s*cm\b", complet, re.I)
    # 4. Pouces seulement : « 35 1/4 x 23 1/2 x 20 in. »
    mi = re.search(r"(" + FRACTION + r")\s*(?:in\.?)?\s*x\s*(" + FRACTION + r")\s*(?:in\.?)?(?:\s*x\s*(" + FRACTION + r"))?\s*(?:in\b|in\.|inches|\")", seg, re.I)
    if mi:
        vals = [round(_num(g) * 2.54, 1) for g in mi.groups() if g]
        return _ordonner(vals, lettres_seg), not lettres_seg
    if m1:
        lettre = re.search(r"\b(H|W|D|L|Diam)\b\.?\s*:?\s*" + re.escape(m1.group(1)), seg)
        k = LETTRES.get(lettre.group(1).lower(), "h") if lettre else "inconnue"
        return {k: round(_num(m1.group(1)), 1)}, lettre is None
    return None, False


def _ordonner(vals, lettres):
    cles = [LETTRES.get(l.lower()) for l in lettres][: len(vals)] if len(lettres) >= len(vals) else ["h", "w", "d"][: len(vals)]
    dims = {}
    for k, v in zip(cles, vals):
        if k and k not in dims:
            dims[k] = v
    return dims


def vers_hlp(dims):
    """Hauteur, largeur (plus grande horizontale), profondeur (plus petite) ; None si absent."""
    if not dims:
        return None, None, None
    h = dims.get("h")
    horiz = sorted([v for k, v in dims.items() if k in ("w", "l", "d", "diam") and v], reverse=True)
    if "diam" in dims and len(horiz) == 1:
        horiz = [dims["diam"], dims["diam"]]  # objet circulaire : diamètre dans les deux sens
    if h is None and "inconnue" in dims:
        return None, dims["inconnue"], None
    return h, (horiz[0] if horiz else None), (horiz[1] if len(horiz) > 1 else None)
