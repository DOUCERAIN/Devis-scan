"""Catalogue v6 — enrichissement des volumes de référence (26/11/2026).

Lit le catalogue v5 sans le modifier et écrit dans `data/catalogue-v6/` :
- un volume géométrique pour chaque sous-catégorie : mesuré (médiane des volumes individuels, v5),
  partiellement mesuré, ou estimé par l'IA (modèle type) ;
- un volume de déménagement de référence, distinct et provisoire, établi dans cet ordre :
  relevés publics de déménageurs, puis analogie avec les sous-catégories de la même classe de
  manutention, puis exception documentée ;
- la traçabilité de chaque valeur, les anomalies à trancher, la couverture des inventaires.

Rien n'est branché : ni base de données, ni moteur IA, ni moteur de devis.
Exécution : `python3 scripts/catalogue_v6/enrichir.py`.
"""
from __future__ import annotations

import csv
import json
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from estimations_ia import E as ESTIM, T as TRANSPORT  # noqa: E402
from releves_demenageurs import RELEVES, S as SOURCES, ABERRANTS  # noqa: E402
from inventaires_types import INVENTAIRES  # noqa: E402
from comparables import COMPARABLES  # noqa: E402

RACINE = ICI.parents[1]
V5 = RACINE / "data" / "catalogue-v5"
SORTIE = RACINE / "data" / "catalogue-v6"

# Seuils de fiabilité demandés (géométrique), adaptés à la dispersion.
SEUIL_ELEVEE = (10, 3)
SEUIL_MOYENNE = (5, 2)
DISPERSION_FORTE = 1.0  # (P75 − P25) / médiane au-delà de laquelle on descend d'un niveau
NIVEAUX = ["provisoire", "moyenne", "élevée"]


def r3(x):
    return None if x is None else round(x, 3)


# ------------------------------------------------------------------ chargement
def charger():
    cat = json.loads((V5 / "catalogue_devis_scan.json").read_text())
    with open(V5 / "produits_independants.csv", newline="") as f:
        produits = {p["id_produit"]: p for p in csv.DictReader(f, delimiter=";")}
    return cat, produits


def source_produit(p: dict) -> str:
    """Source distincte d'une mesure : la marque ou le fabricant pour un produit du commerce,
    sinon la base documentaire (musée, Wikidata…). Deux musées différents = deux sources."""
    m = (p.get("marque") or p.get("fabricant") or "").strip().lower()
    return f"marque:{m}" if m else f"base:{p['sources'].split(',')[0].strip()}"


# ------------------------------------------------------------------ classes de manutention
APPAREILS = {"ELM", "PEM", "INF", "AUD", "TEL", "CHF", "MAC"}
REMBOURRES = {"CAN", "FAU", "POU"}
PLATS = {"DEC", "LUM", "MIR", "TAP"}
SOUPLES = {"MAT-90", "MAT-140", "MAT-160", "MAT-180", "MAT-NC", "CAR-SAC", "FAU-POIRE"}


def classe(ref: dict) -> str:
    i, fam = ref["identifiant"], ref["famille_id"]
    if i in TRANSPORT or ESTIM.get(i, {}).get("etat") == "transport":
        return "objets transportés pliés ou démontés"
    if fam in APPAREILS or i.startswith("MUS-PIANO") or (fam == "RES" and i != "RES-TABLE-INOX"):
        return "appareils et objets rigides"
    if fam in REMBOURRES or i in {"ANC-CANAPE", "ANC-FAUTEUIL", "ANC-MERIDIENNE", "MED-RELEVEUR"}:
        return "sièges rembourrés"
    if fam == "CHA" or i in {"ANC-CHAISE", "ANC-TABOURET", "CHA-ENF"}:
        return "chaises et tabourets"
    if fam in PLATS or i in SOUPLES:
        return "décoration, objets plats ou souples"
    if ref.get("demontable_ou_pliable") == "oui":
        return "meubles démontables"
    return "meubles et objets non démontables"


# ------------------------------------------------------------------ volume géométrique
def fiabilite_geo(n: int, n_src: int, dispersion):
    if n == 0:
        return "provisoire"
    niv = 2 if (n >= SEUIL_ELEVEE[0] and n_src >= SEUIL_ELEVEE[1]) else 1 if (n >= SEUIL_MOYENNE[0] and n_src >= SEUIL_MOYENNE[1]) else 0
    if dispersion is not None and dispersion > DISPERSION_FORTE and niv > 0:
        niv -= 1
    return NIVEAUX[niv]


def geometrique(ref: dict, produits: dict):
    i = ref["identifiant"]
    utilises = [produits[p] for p in ref.get("produits_utilises", []) if p in produits]
    n_src = len({source_produit(p) for p in utilises})
    mesure = ref.get("volume_geometrique_median_m3")
    g = {
        "nb_produits_independants": ref.get("nb_modeles_independants", 0),
        "nb_sources_distinctes": n_src,
        "nb_exclus_aberrants": ref.get("nb_modeles_exclus_aberrants", 0),
        "geo_p25_m3": ref.get("volume_geometrique_q1_m3"),
        "geo_p75_m3": ref.get("volume_geometrique_q3_m3"),
        "geo_dispersion": ref.get("dispersion_relative"),
        "estimation_ia": None,
        "volume_transport_m3": None,
    }
    if mesure is not None and ref["couverture_dimensions"] == "complète":
        g.update(volume_geometrique_m3=mesure, statut_geo="mesuré",
                 methode_geo="médiane des volumes individuels (hauteur × largeur × profondeur de chaque produit), valeurs aberrantes exclues sur l'échelle logarithmique (v5)",
                 fiabilite_geo=fiabilite_geo(g["nb_produits_independants"], n_src, g["geo_dispersion"]))
    elif i in ESTIM:
        e = ESTIM[i]
        part = ref.get("dimensions_partielles") or {}
        h = e["h"] if e["h"] is not None else part.get("hauteur_mediane_cm")
        l = e["l"] if e["l"] is not None else part.get("largeur_mediane_cm")
        p = e["p"] if e["p"] is not None else part.get("profondeur_mediane_cm")
        vol = h * l * p / 1e6
        mesurees = [k for k, v in (("hauteur", e["h"]), ("largeur", e["l"]), ("profondeur", e["p"])) if v is None]
        statut = "partiellement mesuré" if mesurees else "estimé (IA)"
        methode = (f"{', '.join(mesurees)} : médiane mesurée sur {part.get('n')} modèle(s) (v5) ; autre dimension estimée par l'IA ; produit des dimensions d'un modèle type, PAS une médiane de volumes"
                   if mesurees else "dimensions d'un modèle type estimées par l'IA, sans mesure ; PAS une médiane")
        g.update(volume_geometrique_m3=r3(vol), statut_geo=statut, methode_geo=methode, fiabilite_geo="provisoire",
                 geo_p25_m3=e["vmin"], geo_p75_m3=e["vmax"], geo_dispersion=None,
                 estimation_ia={"hauteur_cm": h, "largeur_cm": l, "profondeur_cm": p, "etat": e["etat"], "note": e["note"],
                                "fourchette_m3": [e["vmin"], e["vmax"]], "dimensions_mesurees": mesurees})
        if e["etat"] == "transport":
            g["volume_transport_m3"] = r3(vol)
    elif mesure is not None:  # dimensions partielles mais volume v5 présent (cas résiduel)
        g.update(volume_geometrique_m3=mesure, statut_geo="mesuré", methode_geo="v5", fiabilite_geo="provisoire")
    else:
        g.update(volume_geometrique_m3=None, statut_geo="aucun", methode_geo="aucune donnée", fiabilite_geo="provisoire")
    if i in TRANSPORT:
        t = TRANSPORT[i]
        g["volume_transport_m3"] = r3(t["h"] * t["l"] * t["p"] / 1e6)
        g["transport_ia"] = {"hauteur_cm": t["h"], "largeur_cm": t["l"], "profondeur_cm": t["p"], "note": t["note"], "fourchette_m3": [t["vmin"], t["vmax"]]}
    return g


# ------------------------------------------------------------------ volume de déménagement
def releves_par_sc():
    par = defaultdict(list)
    for sc, v, src, attr, lib in RELEVES:
        par[sc].append({"valeur_m3": v, "source": src, "attribution": attr, "libelle": lib, "aberrant": (sc, v) in ABERRANTS})
    return par


def ratios_de_classe(base: dict, releves: dict):
    """Rapport (médiane des relevés publics) / (volume géométrique mesuré) des sous-catégories « ancres » :
    au moins 2 relevés utilisables et au moins 3 produits mesurés. La médiane par classe sert à proposer
    un volume provisoire aux sous-catégories de la même classe qui n'ont aucun relevé."""
    ancres = defaultdict(list)
    for i, e in base.items():
        vals = [x["valeur_m3"] for x in releves.get(i, []) if not x["aberrant"]]
        if len(vals) >= 2 and e["statut_geo"] == "mesuré" and e["nb_produits_independants"] >= 3 and e["volume_geometrique_m3"]:
            ancres[e["classe_manutention"]].append((i, statistics.median(vals) / e["volume_geometrique_m3"]))
    tous = [r for l in ancres.values() for _, r in l]
    globale = statistics.median(tous)
    res = {}
    for c in sorted({e["classe_manutention"] for e in base.values()}):
        l = ancres.get(c, [])
        if len(l) >= 3:
            res[c] = {"ratio": statistics.median(r for _, r in l), "ancres": l, "origine": "médiane de la classe"}
        else:
            res[c] = {"ratio": globale, "ancres": l, "origine": f"moins de 3 ancres dans la classe : médiane globale ({len(tous)} ancres)"}
    return res, globale


def demenagement(e: dict, releves: list, ratios: dict, comparable_dem=None):
    utiles = [x for x in releves if not x["aberrant"]]
    vals = [x["valeur_m3"] for x in utiles]
    srcs = {x["source"] for x in utiles}
    if e["identifiant"] == "DIV-AUTRE":
        return dict(volume_demenagement_m3=None, statut_demenagement="exception documentée", fiabilite_demenagement="sans objet",
                    methode_demenagement="objet non classé : le volume vient d'une sous-catégorie comparable choisie au cas par cas (règle `volume_source = comparable`), sinon il est fixé par le déménageur ; jamais de volume par défaut",
                    dem_p25_m3=None, dem_p75_m3=None, nb_releves=0, nb_sources_releves=0)
    if len(vals) >= 2:
        q = statistics.quantiles(vals, n=4, method="inclusive") if len(vals) >= 2 else [None, None, None]
        disp_ok = max(vals) / min(vals) <= 3
        fiab = "moyenne" if (len(srcs) >= 3 and disp_ok) else "provisoire"
        return dict(volume_demenagement_m3=r3(statistics.median(vals)), statut_demenagement="estimé",
                    fiabilite_demenagement=fiab,
                    methode_demenagement=f"médiane de {len(vals)} relevés publics de déménageurs ({len(srcs)} source(s)) ; valeurs commerciales hétérogènes, non validées par un déménageur pilote",
                    dem_p25_m3=r3(q[0]), dem_p75_m3=r3(q[2]), nb_releves=len(vals), nb_sources_releves=len(srcs))
    base_vol = e["volume_transport_m3"] or e["volume_geometrique_m3"]
    rc = ratios[e["classe_manutention"]]
    comp = COMPARABLES.get(e["identifiant"])
    if comp and comparable_dem is not None:
        cid, mode, facteur, justif = comp
        v_c = comparable_dem(cid, mode, facteur, e)
        if v_c is not None:
            if len(vals) == 1:
                v = statistics.median([vals[0], v_c])
                meth = f"un seul relevé public ({vals[0]} m³) et la proposition par sous-catégorie comparable ({r3(v_c)} m³ : {cid}, {justif}) : moyenne des deux"
            else:
                v = v_c
                meth = f"sous-catégorie comparable {cid} ({justif}) ; AUCUNE donnée de déménageur propre à cette sous-catégorie"
            return dict(volume_demenagement_m3=r3(v), statut_demenagement="provisoire", fiabilite_demenagement="provisoire",
                        methode_demenagement=meth, dem_p25_m3=None, dem_p75_m3=None, nb_releves=len(vals), nb_sources_releves=len(srcs))
    if base_vol is None:
        return dict(volume_demenagement_m3=None, statut_demenagement="manquant", fiabilite_demenagement="provisoire",
                    methode_demenagement="aucune base", dem_p25_m3=None, dem_p75_m3=None, nb_releves=len(vals), nb_sources_releves=len(srcs))
    prop = base_vol * rc["ratio"]
    if len(vals) == 1:
        v = statistics.median([vals[0], prop])
        meth = (f"un seul relevé public ({vals[0]} m³) combiné à la proposition par analogie ({r3(prop)} m³ = "
                f"{'volume de transport' if e['volume_transport_m3'] else 'volume géométrique'} × {rc['ratio']:.2f}, rapport médian de la classe « {e['classe_manutention']} ») : moyenne des deux")
    else:
        v = prop
        meth = (f"analogie : {'volume de transport (plié ou démonté)' if e['volume_transport_m3'] else 'volume géométrique'} {r3(base_vol)} m³ × {rc['ratio']:.2f} "
                f"(rapport médian relevés / géométrique de la classe « {e['classe_manutention']} », {rc['origine']}) ; AUCUNE donnée de déménageur pour cette sous-catégorie")
    lo = e["geo_p25_m3"] if e["statut_geo"] != "mesuré" else e["geo_p25_m3"]
    p25 = r3(lo * rc["ratio"]) if lo and not e["volume_transport_m3"] else None
    hi = e["geo_p75_m3"]
    p75 = r3(hi * rc["ratio"]) if hi and not e["volume_transport_m3"] else None
    if e["volume_transport_m3"] and e.get("transport_ia"):
        p25, p75 = r3(e["transport_ia"]["fourchette_m3"][0] * rc["ratio"]), r3(e["transport_ia"]["fourchette_m3"][1] * rc["ratio"])
    return dict(volume_demenagement_m3=r3(v), statut_demenagement="provisoire", fiabilite_demenagement="provisoire",
                methode_demenagement=meth, dem_p25_m3=p25, dem_p75_m3=p75, nb_releves=len(vals), nb_sources_releves=len(srcs))


# ------------------------------------------------------------------ anomalies
def anomalies(e: dict, ref: dict, releves: list):
    a = []
    i = e["identifiant"]
    herite = ref.get("volume_demenagement_reference_m3")
    geo = e["volume_geometrique_m3"]
    dem = e["volume_demenagement_m3"]
    rigide = e["classe_manutention"] in ("appareils et objets rigides", "meubles et objets non démontables")
    if herite is not None and dem:
        ecart = (herite - dem) / dem
        if abs(ecart) > 0.5:
            a.append(("volume hérité très différent", f"ancien catalogue {herite} m³ contre {dem} m³ proposé ({ecart:+.0%})", "choisir la valeur de référence avec un déménageur pilote", "élevée" if ref["niveau_pertinence"] <= 2 else "moyenne"))
    if herite is not None and geo and rigide and herite < 0.8 * geo and e["statut_geo"] == "mesuré":
        a.append(("volume de déménagement inférieur au volume du meuble", f"ancien catalogue {herite} m³ pour un objet rigide non démontable de {geo} m³ (géométrique médian)", "impossible physiquement sauf emboîtement : à corriger", "élevée"))
    if dem and geo and rigide and e["statut_demenagement"] == "estimé" and dem < 0.7 * geo and not e["volume_transport_m3"]:
        a.append(("relevés publics sous le volume géométrique", f"relevés {dem} m³ < 70 % du géométrique {geo} m³", "vérifier le périmètre des sous-catégories (modèles mesurés plus grands que ceux des déménageurs ?)", "moyenne"))
    if e["statut_geo"] == "mesuré" and e["nb_produits_independants"] <= 2 and ref["niveau_pertinence"] <= 2:
        a.append(("géométrique sur 1 ou 2 produits", f"{e['nb_produits_independants']} produit(s) mesuré(s)", "compléter par des mesures", "moyenne"))
    if dem and geo and e["statut_demenagement"] == "estimé" and e["statut_geo"] == "mesuré" and dem > 2.5 * geo:
        a.append(("relevés publics très supérieurs au volume géométrique", f"relevés {dem} m³ = {dem / geo:.1f} × le géométrique médian {geo} m³", "vérifier si les barèmes visent de plus grands modèles ou incluent le contenu ; fixer la convention", "moyenne"))
    vals = [x["valeur_m3"] for x in releves if not x["aberrant"]]
    if len(vals) >= 2 and max(vals) / min(vals) > 3:
        a.append(("relevés publics très dispersés", f"de {min(vals)} à {max(vals)} m³", "fixer une convention avec les déménageurs pilotes", "moyenne"))
    for x in releves:
        if x["aberrant"]:
            a.append(("relevé public aberrant écarté", f"{x['valeur_m3']} m³ ({x['libelle']})", "aucune (écarté)", "faible"))
    if i in TRANSPORT or (e.get("estimation_ia") or {}).get("etat") == "transport":
        a.append(("volume géométrique déployé sans sens pour le déménagement", f"géométrique {geo} m³ ; volume de transport estimé {e['volume_transport_m3']} m³", "valider l'état de transport (plié, démonté)", "moyenne"))
    if i in ("JAR-ABRI", "JAR-PISCINE"):
        a.append(("sous-catégorie hétérogène", "objets de volumes très différents réunis (coffre ou abri ; piscine tubulaire ou spa)", "scinder la sous-catégorie", "moyenne"))
    return a


ANOMALIES_MANUELLES = [
    ("LIT-QUEEN, LIT-KING, LIT-COFFRE, LIT-NC", "incohérence entre tailles de lit", "géométriques 2,93 / 3,21 / 4,36 / 4,38 m³ contre 1,02 m³ pour LIT-DOUBLE : les grands lits mesurés semblent inclure tête de lit, coffres ou ensembles ; LIT-DOUBLE et LIT-SIMPLE non", "revoir le périmètre des produits (lit seul / lit avec tête / ensemble)", "élevée"),
    ("COM-3T, COM-4T", "ordre inversé", "commode 4 tiroirs 0,286 m³ < commode 3 tiroirs 0,323 m³ (petits échantillons, 13 et 17 produits)", "accepter (les tiroirs ne font pas la taille) ou regrouper", "faible"),
    ("ELM-REF-COMBI, ELM-REF-US, ELM-REF-1P, ELM-REF-TOP, ELM-CAVE", "biais de marché", "largeurs médianes issues d'ENERGY STAR (marché nord-américain) : combiné de 74,9 cm de large au lieu de 60 cm courant en France", "compléter par EPREL (démarche en attente) ou par des mesures françaises", "moyenne"),
    ("RES-DISTRIBUTEUR, PRO-COMPTOIR, PRO-PRESENTOIR, INF-IMPRIMANTE", "volumes géométriques mesurés invraisemblables", "0,022 / 0,068 / 0,028 / 0,013 m³ pour un distributeur automatique, un comptoir, une gondole, une imprimante : produits mal classés (petits accessoires)", "revoir le classement des produits ; le volume de déménagement proposé reste provisoire", "moyenne"),
    ("MUS-PIANO-CARRE", "volume hérité recopié", "5,0 m³ repris de l'ancien « piano à queue », pour un piano carré de 0,77 m³ géométrique", "fixer avec un déménageur spécialisé", "faible"),
    ("CAR-CARTON", "convention du carton", "relevés publics 0,05 et 0,1 m³ ; l'ancien catalogue retient 0,1 m³ ; le carton standard de 50 × 40 × 30 cm fait 0,06 m³", "décision commerciale : volume d'un carton dans le parcours (cartons déclarés par le client)", "élevée"),
]


# ------------------------------------------------------------------ construction
def construire():
    cat, produits = charger()
    refs = cat["references"]
    base_refs = {r["identifiant"]: r for r in refs if not r.get("variante_de")}
    releves = releves_par_sc()
    inconnus = set(releves) - set(base_refs)
    assert not inconnus, f"relevés sur des sous-catégories inconnues : {inconnus}"
    inconnus = (set(ESTIM) | set(TRANSPORT)) - set(base_refs)
    assert not inconnus, f"estimations sur des sous-catégories inconnues : {inconnus}"

    base = {}
    for i, r in base_refs.items():
        e = {"identifiant": i, "nom": r["nom"], "famille_id": r["famille_id"], "famille": r["famille"],
             "niveau_pertinence": r["niveau_pertinence"], "prioritaire": r["niveau_pertinence"] <= 2,
             "classe_manutention": classe(r)}
        e.update(geometrique(r, produits))
        base[i] = e
    ratios, globale = ratios_de_classe(base, releves)

    def comparable_dem(cid, mode, facteur, e):
        c = base[cid]
        if c.get("volume_demenagement_m3") is None:
            return None
        if mode == "proportion" and c["volume_geometrique_m3"] and e["volume_geometrique_m3"]:
            return c["volume_demenagement_m3"] * e["volume_geometrique_m3"] / c["volume_geometrique_m3"]
        return c["volume_demenagement_m3"] * facteur

    # Deux passages : les sous-catégories sans comparable d'abord (elles servent de base aux autres).
    ordre_calcul = sorted(base, key=lambda i: i in COMPARABLES)
    for i in ordre_calcul:
        e = base[i]
        e.update(demenagement(e, releves.get(i, []), ratios, comparable_dem))
    for i, e in base.items():
        r = base_refs[i]
        e["volume_demenagement_v5_herite_m3"] = r.get("volume_demenagement_reference_m3")
        e["origine_v5_herite"] = r.get("volume_demenagement_origine", "")
        e["sources_mesures"] = ", ".join(f"{k} ({v})" for k, v in (r.get("nb_modeles_par_source") or {}).items())
        e["sources_releves"] = sorted({x["source"] for x in releves.get(i, []) if not x["aberrant"]})
        e["anomalies"] = anomalies(e, r, releves.get(i, []))
        e["statut_global"] = ("exception documentée" if e["statut_demenagement"] == "exception documentée"
                              else "vérifié" if False  # aucune valeur n'est validée par un déménageur pilote à ce jour
                              else "estimé" if e["statut_demenagement"] == "estimé" and e["statut_geo"] == "mesuré"
                              else "provisoire")
        reserves = []
        if e["statut_geo"] != "mesuré":
            reserves.append("volume géométrique non mesuré")
        if e["statut_demenagement"] == "provisoire":
            reserves.append("volume de déménagement sans relevé suffisant")
        if r.get("avertissement_volume"):
            reserves.append(r["avertissement_volume"])
        e["commentaires"] = " ; ".join(reserves)
    # Variantes de taille : proportion de la sous-catégorie parente.
    variantes = []
    for r in refs:
        if not r.get("variante_de"):
            continue
        p = base[r["variante_de"]]
        g = r.get("volume_geometrique_median_m3")
        if p["volume_demenagement_m3"] and g and p["volume_geometrique_m3"] and p["statut_geo"] == "mesuré":
            dem, meth = r3(p["volume_demenagement_m3"] * g / p["volume_geometrique_m3"]), "volume de déménagement de la sous-catégorie parente × (géométrique de la variante / géométrique de la parente)"
        else:
            dem, meth = p["volume_demenagement_m3"], "volume de déménagement de la sous-catégorie parente (pas de géométrique comparable)"
        variantes.append({"identifiant": r["identifiant"], "nom": r["nom"], "variante_de": r["variante_de"],
                          "volume_geometrique_m3": g, "geo_p25_m3": r.get("volume_geometrique_q1_m3"), "geo_p75_m3": r.get("volume_geometrique_q3_m3"),
                          "nb_produits_independants": r.get("nb_modeles_independants", 0), "volume_demenagement_m3": dem,
                          "statut_demenagement": "provisoire", "methode_demenagement": meth})
    return cat, produits, base_refs, base, variantes, ratios, globale, releves


# ------------------------------------------------------------------ couverture des inventaires
def couverture(base: dict):
    corr = {}
    with open(V5 / "correspondance_catalogue_existant.csv", newline="") as f:
        for l in csv.DictReader(f, delimiter=";"):
            corr[l["id_existant"]] = l["reference_normalisee_principale"]
    invs = dict(INVENTAIRES)
    for cas in ("chambre-encombree", "chambre-lits-simples", "salon-canape-jaune"):
        d = json.loads((RACINE / "tests" / "ai-eval" / "dataset" / cas / "case.json").read_text())
        items = [(corr.get(x["key"]) or x["key"], x["quantity"]) for x in d["reference"]["items"] if not x.get("optional")]
        invs[f"pièce réelle « {cas} » (référence provisoire du banc)"] = {"nature": "pièce réelle du jeu de test, référence non validée", "objets": items}
    res = []
    for nom, inv in invs.items():
        tot = defaultdict(float)
        manquants = []
        for sc, q in inv["objets"]:
            e = base.get(sc)
            if e is None or e["volume_demenagement_m3"] is None:
                manquants.append(sc)
                continue
            v = e["volume_demenagement_m3"] * q
            tot["total"] += v
            tot[e["statut_demenagement"]] += v
            tot["fiab_" + e["fiabilite_demenagement"]] += v
        t = tot["total"]
        res.append({"inventaire": nom, "nature": inv["nature"], "nb_lignes": len(inv["objets"]), "volume_total_m3": round(t, 2),
                    "part_numerique_pct": 100.0 if not manquants else round(100 * t / (t + 1e-9), 1),
                    "part_estimee_releves_pct": round(100 * tot["estimé"] / t, 1) if t else 0,
                    "part_provisoire_pct": round(100 * tot["provisoire"] / t, 1) if t else 0,
                    "part_fiabilite_moyenne_pct": round(100 * tot["fiab_moyenne"] / t, 1) if t else 0,
                    "sans_reference": manquants})
    return res


# ------------------------------------------------------------------ écriture
def ecrire_csv(chemin: Path, lignes: list, colonnes: list):
    with open(chemin, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=colonnes, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for l in lignes:
            w.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in l.items()})


COLONNES = ["identifiant", "nom", "famille_id", "niveau_pertinence", "prioritaire", "classe_manutention",
            "nb_produits_independants", "nb_sources_distinctes", "nb_exclus_aberrants", "sources_mesures",
            "volume_geometrique_m3", "geo_p25_m3", "geo_p75_m3", "geo_dispersion", "statut_geo", "fiabilite_geo", "methode_geo",
            "volume_transport_m3", "volume_demenagement_m3", "dem_p25_m3", "dem_p75_m3", "statut_demenagement", "fiabilite_demenagement",
            "methode_demenagement", "nb_releves", "nb_sources_releves", "sources_releves", "volume_demenagement_v5_herite_m3",
            "statut_global", "commentaires"]


def main():
    cat, produits, base_refs, base, variantes, ratios, globale, releves = construire()
    SORTIE.mkdir(parents=True, exist_ok=True)
    lignes = sorted(base.values(), key=lambda e: (e["niveau_pertinence"], e["famille_id"], e["identifiant"]))
    ecrire_csv(SORTIE / "catalogue_volumes_v6.csv", lignes, COLONNES)
    (SORTIE / "catalogue_volumes_v6.json").write_text(json.dumps({
        "version": "6.0-preparatoire", "genere_le": "2026-11-26",
        "convention": "volume géométrique = boîte englobante du produit monté ; volume de déménagement = référence commerciale provisoire, jamais dérivée automatiquement d'une seule formule ; aucune valeur n'est « vérifiée » tant qu'un déménageur pilote ne l'a pas validée",
        "sous_categories": lignes, "variantes": variantes,
        "ratios_classes": {c: {"ratio": round(v["ratio"], 3), "origine": v["origine"], "ancres": [[i, round(x, 3)] for i, x in v["ancres"]]} for c, v in ratios.items()},
        "ratio_global": round(globale, 3)}, ensure_ascii=False, indent=1))
    ecrire_csv(SORTIE / "variantes_v6.csv", variantes, list(variantes[0].keys()))
    # Mesures individuelles conservées (copie des produits utilisés en v5, rien n'est supprimé de la v5).
    mes = []
    for i, r in base_refs.items():
        for pid in r.get("produits_utilises", []):
            p = produits.get(pid)
            if p:
                mes.append({"sous_categorie_id": i, "id_produit": pid, "source_distincte": source_produit(p), "sources": p["sources"],
                            "nom_commercial": p["nom_commercial"], "hauteur_cm": p["hauteur_cm"], "largeur_cm": p["largeur_cm"],
                            "profondeur_cm": p["profondeur_cm"], "volume_geometrique_m3": p["volume_geometrique_m3"], "statut": "retenu"})
        for pid in r.get("produits_exclus", []):
            p = produits.get(pid)
            if p:
                mes.append({"sous_categorie_id": i, "id_produit": pid, "source_distincte": source_produit(p), "sources": p["sources"],
                            "nom_commercial": p["nom_commercial"], "hauteur_cm": p["hauteur_cm"], "largeur_cm": p["largeur_cm"],
                            "profondeur_cm": p["profondeur_cm"], "volume_geometrique_m3": p["volume_geometrique_m3"], "statut": "exclu (aberrant)"})
    ecrire_csv(SORTIE / "mesures_individuelles.csv", mes, list(mes[0].keys()))
    rel = [{"sous_categorie_id": sc, "valeur_m3": v, "source": src, "reference_source": SOURCES[src], "attribution": attr,
            "libelle_et_remarque": lib, "utilise": "non (aberrant)" if (sc, v) in ABERRANTS else "oui",
            "collecte": "moteur de recherche, 26/11/2026 ; page non ouverte (réseau bloqué) : à relire"} for sc, v, src, attr, lib in RELEVES]
    ecrire_csv(SORTIE / "releves_demenageurs.csv", rel, list(rel[0].keys()))
    est = []
    for i, e in base.items():
        if e.get("estimation_ia"):
            x = e["estimation_ia"]
            est.append({"sous_categorie_id": i, "type": "géométrique (" + x["etat"] + ")", "hauteur_cm": x["hauteur_cm"], "largeur_cm": x["largeur_cm"],
                        "profondeur_cm": x["profondeur_cm"], "dimensions_mesurees_v5": ", ".join(x["dimensions_mesurees"]) or "aucune",
                        "volume_modele_type_m3": e["volume_geometrique_m3"], "fourchette_m3": f"{x['fourchette_m3'][0]} – {x['fourchette_m3'][1]}",
                        "justification": x["note"], "statut": "estimation IA, non mesurée"})
        if e.get("transport_ia"):
            x = e["transport_ia"]
            est.append({"sous_categorie_id": i, "type": "transport (plié ou démonté)", "hauteur_cm": x["hauteur_cm"], "largeur_cm": x["largeur_cm"],
                        "profondeur_cm": x["profondeur_cm"], "dimensions_mesurees_v5": "aucune", "volume_modele_type_m3": e["volume_transport_m3"],
                        "fourchette_m3": f"{x['fourchette_m3'][0]} – {x['fourchette_m3'][1]}", "justification": x["note"], "statut": "estimation IA, non mesurée"})
    ecrire_csv(SORTIE / "estimations_ia.csv", est, list(est[0].keys()))
    rat = [{"classe_manutention": c, "ratio_releves_sur_geometrique": round(v["ratio"], 3), "origine": v["origine"], "nb_ancres": len(v["ancres"]),
            "ancres": ", ".join(f"{i} ({x:.2f})" for i, x in v["ancres"])} for c, v in ratios.items()]
    ecrire_csv(SORTIE / "ratios_classes.csv", rat, list(rat[0].keys()))
    ano = []
    for e in lignes:
        for typ, detail, decision, prio in e["anomalies"]:
            ano.append({"sous_categories": e["identifiant"], "niveau_pertinence": e["niveau_pertinence"], "type": typ, "detail": detail, "decision_proposee": decision, "priorite": prio})
    for sc, typ, detail, decision, prio in ANOMALIES_MANUELLES:
        ano.append({"sous_categories": sc, "niveau_pertinence": "", "type": typ, "detail": detail, "decision_proposee": decision, "priorite": prio})
    ordre = {"élevée": 0, "moyenne": 1, "faible": 2}
    ano.sort(key=lambda a: (ordre[a["priorite"]], str(a["niveau_pertinence"]), a["sous_categories"]))
    ecrire_csv(SORTIE / "anomalies.csv", ano, list(ano[0].keys()))
    cov = couverture(base)
    ecrire_csv(SORTIE / "couverture_inventaires.csv", cov, list(cov[0].keys()))

    # ------------------------------------------------ synthèse chiffrée
    tous, prio = list(base.values()), [e for e in base.values() if e["prioritaire"]]

    def compte(l, f):
        return sum(1 for e in l if f(e))
    num = lambda e: e["volume_demenagement_m3"] is not None  # noqa: E731
    doc = lambda e: e["statut_geo"] in ("mesuré", "partiellement mesuré") or e["statut_demenagement"] == "estimé"  # noqa: E731
    syn = {
        "sous_categories": len(tous), "prioritaires": len(prio),
        "volume_deménagement_numerique": compte(tous, num), "exceptions_documentees": compte(tous, lambda e: e["statut_demenagement"] == "exception documentée"),
        "prioritaires_volume_numerique": compte(prio, num),
        "prioritaires_reference_documentee": compte(prio, doc),
        "geo": dict(Counter(e["statut_geo"] for e in tous)), "geo_prioritaires": dict(Counter(e["statut_geo"] for e in prio)),
        "fiabilite_geo_mesures": dict(Counter(e["fiabilite_geo"] for e in tous if e["statut_geo"] == "mesuré")),
        "fiabilite_geo_mesures_prioritaires": dict(Counter(e["fiabilite_geo"] for e in prio if e["statut_geo"] == "mesuré")),
        "demenagement": dict(Counter(e["statut_demenagement"] for e in tous)), "demenagement_prioritaires": dict(Counter(e["statut_demenagement"] for e in prio)),
        "fiabilite_demenagement": dict(Counter(e["fiabilite_demenagement"] for e in tous)),
        "statut_global": dict(Counter(e["statut_global"] for e in tous)), "statut_global_prioritaires": dict(Counter(e["statut_global"] for e in prio)),
        "v5_volume_demenagement": compte(tous, lambda e: e["volume_demenagement_v5_herite_m3"] is not None),
        "v5_prioritaires_volume_demenagement": compte(prio, lambda e: e["volume_demenagement_v5_herite_m3"] is not None),
        "v5_geo": compte(tous, lambda e: base_refs[e["identifiant"]].get("volume_geometrique_median_m3") is not None),
        "releves_publics": len(RELEVES), "sous_categories_avec_releves": len({sc for sc, *_ in RELEVES}),
        "sources_releves": len(SOURCES), "estimations_ia": len(est), "anomalies": len(ano),
        "anomalies_par_priorite": dict(Counter(a["priorite"] for a in ano)),
        "variantes": len(variantes), "variantes_avec_volume_demenagement": sum(1 for v in variantes if v["volume_demenagement_m3"] is not None),
        "mesures_individuelles": len(mes), "couverture_inventaires": cov,
        "ratios_classes": {c: round(v["ratio"], 2) for c, v in ratios.items()}, "ratio_global": round(globale, 2),
    }
    (SORTIE / "synthese.json").write_text(json.dumps(syn, ensure_ascii=False, indent=1))
    print(json.dumps({k: v for k, v in syn.items() if k != "couverture_inventaires"}, ensure_ascii=False, indent=1))
    for c in cov:
        print(c)


if __name__ == "__main__":
    main()
