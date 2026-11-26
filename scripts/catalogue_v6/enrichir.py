"""Catalogue v6.1 — volumes de référence pour le déménagement (26/11/2026).

Lit le catalogue v5 sans le modifier et écrit dans `data/catalogue-v6/`.

Règles validées par le porteur du projet le 26/11/2026 :
- un carton standard vaut 0,10 m³ (convention commerciale Devis Scan) ;
- le volume de déménagement retenu est d'abord la valeur unique publiée par Démén'House, quand elle existe et
  correspond à l'objet ; sinon une autre valeur professionnelle, dont l'origine est précisée ;
- on retient toujours une valeur réellement publiée : jamais une moyenne ni une médiane de sources hétérogènes ;
- les divergences sont signalées, pas lissées ;
- le volume géométrique reste distinct et n'est jamais utilisé tel quel comme volume commercial.

Rien n'est branché : ni base de données, ni moteur IA, ni moteur de devis, ni parcours client.
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
from comparables import COMPARABLES  # noqa: E402
from estimations_ia import E as ESTIM, T as TRANSPORT  # noqa: E402
from nouvelles_sous_categories import NOUVELLES, references_v62  # noqa: E402
from inventaires_types import INVENTAIRES  # noqa: E402
from releves_demenageurs import ABERRANTS, RELEVES, SOURCES  # noqa: E402

RACINE = ICI.parents[1]
V5 = RACINE / "data" / "catalogue-v5"
SORTIE = RACINE / "data" / "catalogue-v6"
HIST = SORTIE / "historique" / "v6.0"
VERSION = "6.2-candidat"
HIST61 = SORTIE / "historique" / "v6.1"

# ------------------------------------------------------------------ paramètres documentés
CARTON = {"id": "CAR-CARTON", "volume": 0.10, "decision": "convention commerciale validée par le porteur du projet le 26/11/2026 : un carton standard = 0,10 m³ (100 L)"}
# Conventions commerciales validées par Devis Scan (26/11/2026). Les bacs et les valises ne sont PAS assimilés à des
# cartons : chacun garde sa sous-catégorie, son identifiant et sa propre valeur.
CONVENTIONS_VALIDEES = {
    "CAR-CARTON": (0.10, CARTON["decision"]),
    "CAR-BAC": (0.10, "convention commerciale validée par Devis Scan le 26/11/2026 : bac de rangement standard = 0,10 m³"),
    "BAG-VALISE": (0.20, "convention commerciale validée par Devis Scan le 26/11/2026 : valise classique = 0,20 m³"),
    "BAG-VALISE-GRANDE": (0.30, "convention commerciale validée par Devis Scan le 26/11/2026 : grande valise = 0,30 m³"),
    "CAR-BAC-GRAND": (0.20, "convention commerciale validée par Devis Scan le 26/11/2026 : grand bac de rangement = 0,20 m³"),
    "BAG-VALISE-TRES-GRANDE": (0.30, "convention commerciale validée par Devis Scan le 26/11/2026 : très grande valise = 0,30 m³"),
}
# Variantes de taille rattachées à une autre sous-catégorie (v6.2) : la variante « grand format » de la valise
# correspond à la grande valise. Elle est rattachée à BAG-VALISE-GRANDE, prend sa convention, et n'est jamais
# proposée à côté de sa sous-catégorie (correspondance_identifiants_v6_2.csv).
VARIANTES_RATTACHEES = {"BAG-VALISE-L": "BAG-VALISE-GRANDE"}
# Conventions validées sans sous-catégorie propre dans le catalogue : enregistrées, non appliquées (aucun identifiant
# n'est créé sans accord).
CONVENTIONS_SANS_SOUS_CATEGORIE = {}  # v6.2 : les deux conventions concernées ont désormais leur sous-catégorie
SEUIL_ELEVEE, SEUIL_MOYENNE, DISPERSION_FORTE = (10, 3), (5, 2), 1.0
NIVEAUX = ["provisoire", "moyenne", "élevée"]
# Une valeur Démén'House plus de 6 fois supérieure au géométrique médian mesuré (≥ 3 produits) est jugée ne
# pas correspondre à l'objet courant de la sous-catégorie (exemple : meuble TV à 3,2 m³ pour 0,32 m³ mesuré).
DH_RAPPORT_MAX = 6.0
# v6.2 : une valeur publiée est jugée manifestement aberrante (erreur de catégorie ou de saisie probable) si elle
# vaut moins de 25 % ou plus de 6 fois le géométrique médian mesuré sur au moins 3 produits. En dehors de ces
# bornes, la géométrie sert d'indicateur, jamais de plancher (la règle v6.1 « ≥ 80 % du géométrique » est retirée).
ABERRATION_BASSE = 0.25
# Bornes des variantes de taille par rapport à leur parente (v6.2) : évite qu'un tiers de modèles extrêmes
# (ensembles, objets de collection) produise un volume hors de proportion.
VARIANTE_BORNES = (0.6, 1.6)
# Objets à ranger en carton : leur volume est déjà compté dans les cartons déclarés par le client.
INCLUS_DANS_CARTONS = {"PEM-AUTRE": "petit électroménager « à mettre en carton » (nom de la sous-catégorie)"}
CORROBORATION = 0.35  # une autre source corrobore si sa valeur, ou sa fourchette, tombe à ± 35 % de la valeur retenue
DIVERGENCE = 1.5      # écart signalé si une autre valeur publiée est 1,5 fois plus grande ou plus petite
# Conventions incompatibles avec la sous-catégorie : conservées comme références, jamais retenues.
CONVENTIONS_EXCLUES = {"sans matelas, démonté": "convention « lit complet » de Devis Scan : un lit compte cadre, sommier et matelas",
                       "demi-queue": "objet différent (piano demi-queue, plus petit qu'un piano à queue)"}
# Produits mal classés en v5 : exclus en v6.1 (conservés dans mesures_individuelles.csv).
EXCLUSIONS_SC = {
    "RES-DISTRIBUTEUR": (lambda p: True, "petits distributeurs muraux de collections muséales, pas un distributeur automatique"),
    "PRO-COMPTOIR": (lambda p: True, "le produit est un four à micro-ondes, pas un comptoir"),
    "PRO-PRESENTOIR": (lambda p: float(p["volume_geometrique_m3"] or 0) < 0.1, "vitrine à drapeau ou présentoir à fruits, pas une gondole"),
    "ENF-CHAISE-HAUTE": (lambda p: True, "rehausseur de voyage plié (1,3 cm de profondeur), pas une chaise haute"),
}
DH_SRC = {"demenhouse", "demenhouse-2"}
CONVENTIONS = {}


def r3(x):
    return None if x is None else round(x, 3)


def domaine(src):
    return SOURCES[src][0]


def charger():
    cat = json.loads((V5 / "catalogue_devis_scan.json").read_text())
    with open(V5 / "produits_independants.csv", newline="") as f:
        produits = {p["id_produit"]: p for p in csv.DictReader(f, delimiter=";")}
    return cat, produits


def source_produit(p):
    """Source distincte d'une mesure : la marque ou le fabricant pour un produit du commerce, sinon la base
    documentaire (musée, Wikidata…)."""
    m = (p.get("marque") or p.get("fabricant") or "").strip().lower()
    return f"marque:{m}" if m else f"base:{p['sources'].split(',')[0].strip()}"


# ------------------------------------------------------------------ classes de manutention
APPAREILS = {"ELM", "PEM", "INF", "AUD", "TEL", "CHF", "MAC"}
REMBOURRES = {"CAN", "FAU", "POU"}
PLATS = {"DEC", "LUM", "MIR", "TAP"}
SOUPLES = {"MAT-90", "MAT-140", "MAT-160", "MAT-180", "MAT-NC", "CAR-SAC", "FAU-POIRE"}


def classe(ref):
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
def fiabilite_geo(n, n_src, dispersion):
    if n == 0:
        return "provisoire"
    niv = 2 if (n >= SEUIL_ELEVEE[0] and n_src >= SEUIL_ELEVEE[1]) else 1 if (n >= SEUIL_MOYENNE[0] and n_src >= SEUIL_MOYENNE[1]) else 0
    if dispersion is not None and dispersion > DISPERSION_FORTE and niv > 0:
        niv -= 1
    return NIVEAUX[niv]


def quartiles(v):
    if len(v) == 1:
        return v[0], v[0], v[0]
    q = statistics.quantiles(v, n=4, method="inclusive")
    return q[0], statistics.median(v), q[2]


def geometrique(ref, produits):
    i = ref["identifiant"]
    utilises = [produits[p] for p in ref.get("produits_utilises", []) if p in produits]
    exclus_v61 = []
    if i in EXCLUSIONS_SC:
        test, motif = EXCLUSIONS_SC[i]
        exclus_v61 = [p for p in utilises if test(p)]
        utilises = [p for p in utilises if not test(p)]
    n_src = len({source_produit(p) for p in utilises})
    g = {"nb_produits_independants": len(utilises), "nb_sources_distinctes": n_src,
         "nb_exclus_aberrants": ref.get("nb_modeles_exclus_aberrants", 0), "produits_exclus_v6_1": [p["id_produit"] for p in exclus_v61],
         "geo_p25_m3": ref.get("volume_geometrique_q1_m3"), "geo_p75_m3": ref.get("volume_geometrique_q3_m3"),
         "geo_dispersion": ref.get("dispersion_relative"), "estimation_ia": None, "volume_transport_m3": None, "transport_ia": None}
    mesure = ref.get("volume_geometrique_median_m3")
    if exclus_v61 and utilises:
        vols = sorted(float(p["volume_geometrique_m3"]) for p in utilises)
        q1, med, q3 = quartiles(vols)
        mesure = med
        g.update(geo_p25_m3=r3(q1), geo_p75_m3=r3(q3), geo_dispersion=round((q3 - q1) / med, 2) if med else None)
    elif exclus_v61:
        mesure = None
    if mesure is not None and ref["couverture_dimensions"] == "complète":
        g.update(volume_geometrique_m3=r3(mesure), statut_geo="mesuré",
                 methode_geo="médiane des volumes individuels (hauteur × largeur × profondeur de chaque produit), aberrants exclus sur l'échelle logarithmique (v5)"
                 + (f" ; {len(exclus_v61)} produit(s) mal classé(s) exclu(s) en v6.1" if exclus_v61 else ""),
                 fiabilite_geo=fiabilite_geo(g["nb_produits_independants"], n_src, g["geo_dispersion"]))
    elif i in ESTIM:
        e = ESTIM[i]
        part = ref.get("dimensions_partielles") or {}
        h = e["h"] if e["h"] is not None else part.get("hauteur_mediane_cm")
        l = e["l"] if e["l"] is not None else part.get("largeur_mediane_cm")
        p = e["p"] if e["p"] is not None else part.get("profondeur_mediane_cm")
        mesurees = [k for k, v in (("hauteur", e["h"]), ("largeur", e["l"]), ("profondeur", e["p"])) if v is None]
        g.update(volume_geometrique_m3=r3(h * l * p / 1e6), statut_geo="partiellement mesuré" if mesurees else "estimé (IA)",
                 methode_geo=(f"{', '.join(mesurees)} : médiane mesurée sur {part.get('n')} modèle(s) (v5) ; autre dimension estimée par l'IA ; produit des dimensions d'un modèle type, PAS une médiane de volumes"
                              if mesurees else "dimensions d'un modèle type estimées par l'IA, sans mesure ; PAS une médiane"),
                 fiabilite_geo="provisoire", nb_produits_independants=0 if not mesurees else 0, nb_sources_distinctes=0,
                 geo_p25_m3=e["vmin"], geo_p75_m3=e["vmax"], geo_dispersion=None,
                 estimation_ia={"hauteur_cm": h, "largeur_cm": l, "profondeur_cm": p, "etat": e["etat"], "note": e["note"],
                                "fourchette_m3": [e["vmin"], e["vmax"]], "dimensions_mesurees": mesurees, "n_partiel": part.get("n")})
        if e["etat"] == "transport":
            g["volume_transport_m3"] = g["volume_geometrique_m3"]
    else:
        g.update(volume_geometrique_m3=None, statut_geo="aucun", methode_geo="aucune donnée", fiabilite_geo="provisoire")
    if i in TRANSPORT:
        t = TRANSPORT[i]
        g["volume_transport_m3"] = r3(t["h"] * t["l"] * t["p"] / 1e6)
        g["transport_ia"] = {"hauteur_cm": t["h"], "largeur_cm": t["l"], "profondeur_cm": t["p"], "note": t["note"], "fourchette_m3": [t["vmin"], t["vmax"]]}
    return g


# ------------------------------------------------------------------ références professionnelles
def releves_par_sc():
    par = defaultdict(list)
    for sc, v, bas, haut, src, attr, lib, conv in RELEVES:
        par[sc].append({"valeur_m3": v, "bas": bas, "haut": haut, "source": src, "domaine": domaine(src), "attribution": attr,
                        "libelle": lib, "convention": conv, "aberrant": (sc, v) in ABERRANTS,
                        "convention_exclue": CONVENTIONS_EXCLUES.get(conv)})
    return par


def classement_sources():
    """Ordre de préférence des sources attribuées autres que Démén'House : la plus couvrante d'abord (un barème
    étendu applique plus probablement une même convention à tous les objets), puis l'ordre alphabétique."""
    n = Counter(src for _, v, _, _, src, attr, *_ in RELEVES if attr == "attribuée" and v is not None and src not in DH_SRC)
    return sorted(n, key=lambda s: (-n[s], s)), n


CONVENTION_COMPATIBLE = (0.67, 1.5)
DH_NON_CORRESPONDANTS = {"RAN-MEUBLE-TV"}  # écartée par la règle de correspondance (rapport au géométrique > 6)  # rapport médian source / Démén'House jugé compatible


def conventions_sources():
    """Rapport médian (valeur de la source / valeur unique de Démén'House) sur les sous-catégories où les deux
    existent. Les synthèses non attribuées sont regroupées en une seule « source »."""
    dh = {sc: v for sc, v, b, h, src, *_ in RELEVES if src == "demenhouse" and v is not None and (sc, v) not in ABERRANTS and sc not in DH_NON_CORRESPONDANTS}
    par = defaultdict(list)
    for sc, v, b, h, src, attr, lib, conv in RELEVES:
        if src in DH_SRC or v is None or (sc, v) in ABERRANTS or sc not in dh or sc == CARTON["id"]:
            continue
        cle = SOURCES[src][0]
        par[cle].append((sc, v / dh[sc]))
    res = {}
    for cle, l in par.items():
        r = statistics.median(x for _, x in l)
        res[cle] = {"rapport_median": round(r, 2), "nb_communes": len(l), "communes": l,
                    "convention": ("indéterminée (une seule sous-catégorie commune)" if len(l) < 2 else
                                   "compatible avec Démén'House" if CONVENTION_COMPATIBLE[0] <= r <= CONVENTION_COMPATIBLE[1] else
                                   "différente de Démén'House (plus basse)" if r < CONVENTION_COMPATIBLE[0] else "différente de Démén'House (plus haute)")}
    return res


def texte_ref(x):
    val = f"{x['valeur_m3']}" if x["valeur_m3"] is not None else f"{x['bas']}–{x['haut']}"
    return f"{val} m³ ({x['domaine'] if x['attribution'] == 'attribuée' else 'non attribuée'}{' – ' + x['convention'] if x['convention'] != 'non précisée' else ''})"


def corrobore(x, v):
    lo, hi = v * (1 - CORROBORATION), v * (1 + CORROBORATION)
    if x["valeur_m3"] is not None:
        return lo <= x["valeur_m3"] <= hi
    return x["bas"] <= hi and x["haut"] >= lo


def valeur_professionnelle(e, refs, ordre):
    """Choisit UNE valeur réellement publiée, sans moyenne. Renvoie None si aucune ne convient."""
    utiles = [x for x in refs if not x["aberrant"] and not x["convention_exclue"]]
    rejets = []
    geo_fiable = e["volume_geometrique_m3"] if e["statut_geo"] == "mesuré" and e["nb_produits_independants"] >= 3 else None
    uniques = []
    for x in utiles:
        if x["valeur_m3"] is None:
            continue
        if geo_fiable and x["valeur_m3"] < ABERRATION_BASSE * geo_fiable:
            rejets.append(f"{x['valeur_m3']} m³ ({x['domaine']}) écartée comme manifestement aberrante : moins de 25 % du géométrique médian mesuré ({geo_fiable} m³)")
            continue
        if geo_fiable and x["valeur_m3"] > DH_RAPPORT_MAX * geo_fiable and x["source"] != "demenhouse":
            rejets.append(f"{x['valeur_m3']} m³ ({x['domaine']}) écartée comme manifestement aberrante : plus de 6 fois le géométrique médian mesuré ({geo_fiable} m³)")
            continue
        uniques.append(x)
    choix = None
    dh = [x for x in uniques if x["source"] == "demenhouse"]
    if dh:
        x = dh[0]
        if geo_fiable and x["valeur_m3"] / geo_fiable > DH_RAPPORT_MAX:
            rejets.append(f"valeur Démén'House {x['valeur_m3']} m³ non retenue : {x['valeur_m3'] / geo_fiable:.1f} fois le géométrique médian mesuré ({geo_fiable} m³), ne correspond pas à l'objet courant de la sous-catégorie")
        else:
            choix, regle = x, "1 — valeur unique publiée par Démén'House"
            # v6.2 : si la liste de Démén'House sort de la fourchette de son propre article récent, on retient la borne
            # publiée la plus proche (valeur publiée par Démén'House, pas une moyenne).
            fr = [y for y in utiles if y["source"] == "demenhouse-2" and y["valeur_m3"] is None]
            if fr and not (fr[0]["bas"] <= x["valeur_m3"] <= fr[0]["haut"]):
                borne = fr[0]["haut"] if x["valeur_m3"] > fr[0]["haut"] else fr[0]["bas"]
                rejets.append(f"liste Démén'House {x['valeur_m3']} m³ hors de la fourchette de son article récent ({fr[0]['bas']}–{fr[0]['haut']} m³) : borne {borne} m³ retenue")
                choix = dict(fr[0], valeur_m3=borne, libelle=fr[0]["libelle"] + f" (borne {'haute' if borne == fr[0]['haut'] else 'basse'})")
                regle = "1b — Démén'House : borne de la fourchette publiée la plus proche de la liste (cohérence entre ses deux publications)"
    if choix is None:
        attrib = sorted((x for x in uniques if x["attribution"] == "attribuée" and x["source"] not in DH_SRC), key=lambda x: ordre.index(x["source"]))
        if attrib:
            choix, regle = attrib[0], "2 — valeur d'une autre source professionnelle attribuée (barème le plus couvrant d'abord)"
    if choix is None:
        anon = [x for x in uniques if x["attribution"] == "non attribuée"]
        if anon:
            med = statistics.median(x["valeur_m3"] for x in anon)
            soutien = lambda x: sum(1 for y in utiles if y is not x and corrobore(y, x["valeur_m3"]))  # noqa: E731
            choix = min(anon, key=lambda x: (-soutien(x), abs(x["valeur_m3"] - med), -x["valeur_m3"]))
            regle = "3 — valeur publiée non attribuée (la plus soutenue par les autres références, puis la plus centrale ; aucune moyenne)"
    if choix is None:
        return None, rejets
    v = choix["valeur_m3"]
    autres = [x for x in utiles if x is not choix]
    dom_choix = choix["domaine"]
    corrob = {x["domaine"] for x in autres if x["attribution"] == "attribuée" and x["domaine"] != dom_choix and corrobore(x, v)}
    corrob_anon = any(x["attribution"] == "non attribuée" and corrobore(x, v) for x in autres)
    divergentes = [x for x in autres if x["valeur_m3"] is not None and (x["valeur_m3"] > v * DIVERGENCE or x["valeur_m3"] < v / DIVERGENCE)]
    interne = [x for x in autres if x["source"] == "demenhouse-2" and choix["source"] == "demenhouse" and not (x["bas"] <= v <= x["haut"])]
    return {"valeur": v, "choix": choix, "regle": regle, "autres": autres, "corroboration_attribuee": sorted(corrob),
            "corroboration_non_attribuee": corrob_anon, "divergentes": divergentes, "incoherence_dh": interne, "rejets": rejets}, rejets


def type_reference(choix):
    if choix["source"] in DH_SRC:
        return "attribuée — entreprise de déménagement (Démén'House)"
    nat = SOURCES[choix["source"]][2]
    if choix["attribution"] == "attribuée":
        return f"attribuée — {nat}"
    return "non attribuée — synthèse de résultats de recherche"


# ------------------------------------------------------------------ construction
def construire():
    cat, produits = charger()
    familles_v5 = {f["identifiant"]: f["nom"] for f in cat["familles"]}
    ajouts = references_v62(familles_v5)
    assert not ({r["identifiant"] for r in ajouts} & {r["identifiant"] for r in cat["references"]}), "sous-catégorie déjà existante"
    refs = cat["references"] + ajouts
    base_refs = {r["identifiant"]: r for r in refs if not r.get("variante_de")}
    releves = releves_par_sc()
    assert not (set(releves) - set(base_refs)), set(releves) - set(base_refs)
    assert not ((set(ESTIM) | set(TRANSPORT) | set(COMPARABLES)) - set(base_refs))
    ordre, couverture_src = classement_sources()
    global CONVENTIONS
    CONVENTIONS = conventions_sources()
    base = {}
    for i, r in base_refs.items():
        e = {"identifiant": i, "nom": r["nom"], "famille_id": r["famille_id"], "famille": r["famille"], "niveau_pertinence": r["niveau_pertinence"],
             "prioritaire": r["niveau_pertinence"] <= 2, "classe_manutention": classe(r), "volume_v5_m3": r.get("volume_demenagement_reference_m3"),
             "origine_v5": r.get("volume_demenagement_origine", "")}
        e.update(geometrique(r, produits))
        base[i] = e

    # Étape 1 : valeurs professionnelles, convention du carton, exception.
    for i, e in base.items():
        e["references_pro"] = releves.get(i, [])
        e["rejets"] = []
        e["pro"] = None
        if i in CONVENTIONS_VALIDEES:
            vol, dec = CONVENTIONS_VALIDEES[i]
            e.update(volume_demenagement_m3=vol, type_reference="convention validée par Devis Scan", source_principale="Devis Scan (décision du 26/11/2026)",
                     regle="convention", methode_demenagement=dec, fiabilite_demenagement="élevée (convention validée)",
                     statut_validation="convention commerciale validée par Devis Scan (pas une mesure)")
            continue
        if i == "DIV-AUTRE":
            e.update(volume_demenagement_m3=None, type_reference="exception documentée", source_principale="", regle="exception",
                     methode_demenagement="objet non classé : volume d'une sous-catégorie comparable choisie au cas par cas (règle volume_source = comparable du parcours), sinon fixé par le déménageur ; jamais de volume par défaut",
                     fiabilite_demenagement="sans objet", statut_validation="non validé")
            continue
        pro, rejets = valeur_professionnelle(e, e["references_pro"], ordre)
        e["rejets"] = rejets
        e["pro_non_retenu"] = None
        if pro and pro["choix"]["source"] not in DH_SRC and i in COMPARABLES:
            conv = CONVENTIONS.get(pro["choix"]["domaine"], {}).get("convention", "")
            if conv.startswith("différente"):
                e["pro_non_retenu"] = pro
                e["rejets"].append(f"{pro['valeur']} m³ ({pro['choix']['domaine']}) non retenue en priorité : convention {conv} (rapport médian {CONVENTIONS[pro['choix']['domaine']]['rapport_median']}) ; alignement sur Démén'House par la sous-catégorie comparable {COMPARABLES[i][0]}")
                pro = None
        if pro:
            e["pro"] = pro
            c = pro["choix"]
            fiab = "moyenne" if pro["corroboration_attribuee"] else "provisoire"
            e.update(volume_demenagement_m3=pro["valeur"], type_reference=type_reference(c),
                     source_principale=f"{c['domaine']} — {SOURCES[c['source']][1]}" if c["attribution"] == "attribuée" else SOURCES[c["source"]][1],
                     regle=pro["regle"], fiabilite_demenagement=fiab, statut_validation="non validé (estimation indicative publiée, pas une mesure Devis Scan)",
                     methode_demenagement=f"règle {pro['regle']} : « {c['libelle']} »"
                     + (f" ; corroborée par {', '.join(pro['corroboration_attribuee'])}" if pro["corroboration_attribuee"] else " ; aucune autre source attribuée à ± 35 %"))

    # Étape 2 : rapports de classe (ancres = valeur retenue de Démén'House ; à défaut, toute valeur professionnelle retenue).
    def ancres(filtre):
        a = defaultdict(list)
        for i, e in base.items():
            if e.get("pro") and filtre(e) and e["statut_geo"] == "mesuré" and e["nb_produits_independants"] >= 3 and e["volume_geometrique_m3"]:
                a[e["classe_manutention"]].append((i, e["volume_demenagement_m3"] / e["volume_geometrique_m3"]))
        return a
    # v6.2 : ancres = toutes les valeurs professionnelles retenues (Démén'House et autres), et non plus Démén'House
    # seul : la v6.1 appliquait aux objets sans référence un rapport de 2,1 à 2,7, qui revenait à ajouter de fortes
    # marges que le catalogue n'a pas à porter (meubles comptés montés, sans calage ni protection).
    a_pro = ancres(lambda e: True)
    glob_dh = statistics.median(r for l in a_pro.values() for _, r in l)
    ratios = {}
    for c in sorted({e["classe_manutention"] for e in base.values()}):
        if len(a_pro.get(c, [])) >= 3:
            ratios[c] = {"ratio": statistics.median(r for _, r in a_pro[c]), "ancres": a_pro[c], "origine": "médiane des valeurs professionnelles retenues de la classe"}
        else:
            ratios[c] = {"ratio": glob_dh, "ancres": a_pro.get(c, []), "origine": f"moins de 3 ancres dans la classe : médiane de toutes les ancres ({sum(len(l) for l in a_pro.values())})"}

    # Étape 3 : comparables puis ratios, pour les sous-catégories sans valeur professionnelle utilisable.
    def comp_val(cid, mode, facteur, e):
        c = base[cid]
        if c.get("volume_demenagement_m3") is None:
            return None
        if mode == "proportion" and c["volume_geometrique_m3"] and e["volume_geometrique_m3"]:
            return c["volume_demenagement_m3"] * e["volume_geometrique_m3"] / c["volume_geometrique_m3"]
        return c["volume_demenagement_m3"] * (facteur or 1.0)

    # Les comparables sont résolus par passes successives (une comparable peut dépendre d'une autre) ; le ratio
    # géométrique n'intervient qu'à la dernière passe, quand aucune comparable n'a pu être résolue.
    for passe in range(8):
        derniere = passe == 7
        for i, e in base.items():
            if "volume_demenagement_m3" in e:
                continue
            seules_fourchettes = [x for x in e["references_pro"] if x["valeur_m3"] is None]
            if i in COMPARABLES:
                cid, mode, facteur, justif = COMPARABLES[i]
                if "volume_demenagement_m3" not in base[cid] and not derniere:
                    continue
                v = comp_val(cid, mode, facteur, e) if "volume_demenagement_m3" in base[cid] else None
                if v is not None:
                    e.update(volume_demenagement_m3=r3(v), type_reference="estimation par analogie (sous-catégorie comparable)", source_principale=f"comparable {cid} ({base[cid].get('type_reference', '')})",
                             regle="4 — sous-catégorie comparable" + (" (alignement sur la convention Démén'House)" if e.get("pro_non_retenu") else ""), fiabilite_demenagement="provisoire", statut_validation="non validé (estimation Devis Scan)",
                             methode_demenagement=f"{cid} × {'(géométrique / géométrique du comparable)' if mode == 'proportion' else facteur} : {justif}")
                    continue
            if e.get("pro_non_retenu"):
                pro = e["pro"] = e["pro_non_retenu"]
                c = pro["choix"]
                e.update(volume_demenagement_m3=pro["valeur"], type_reference=type_reference(c), source_principale=f"{c['domaine']} — {SOURCES[c['source']][1]}",
                         regle=pro["regle"], fiabilite_demenagement="provisoire", statut_validation="non validé (estimation indicative publiée, pas une mesure Devis Scan)",
                         methode_demenagement=f"règle {pro['regle']} : « {c['libelle']} » (convention différente de Démén'House, comparable indisponible)")
                continue
            base_vol = e["volume_transport_m3"] or e["volume_geometrique_m3"]
            if base_vol is None:
                e.update(volume_demenagement_m3=None, type_reference="manquant", source_principale="", regle="aucune", fiabilite_demenagement="provisoire", statut_validation="non validé", methode_demenagement="aucune base")
                continue
            rc = ratios[e["classe_manutention"]]
            e.update(volume_demenagement_m3=r3(base_vol * rc["ratio"]), type_reference="estimation par ratio géométrique (classe de manutention)", source_principale=f"ratio de classe « {e['classe_manutention']} »",
                     regle="5 — ratio géométrique de classe", fiabilite_demenagement="provisoire", statut_validation="non validé (estimation Devis Scan)",
                     methode_demenagement=f"{'volume de transport (plié ou démonté)' if e['volume_transport_m3'] else 'volume géométrique ' + e['statut_geo']} {r3(base_vol)} m³ × {rc['ratio']:.2f} ({rc['origine']}) ; aucune valeur professionnelle unique pour cette sous-catégorie"
                     + (f" ; fourchette(s) publiée(s) : {', '.join(texte_ref(x) for x in seules_fourchettes)}" if seules_fourchettes else ""))

    # Étape 4 : champs de synthèse.
    for i, e in base.items():
        rp = e["references_pro"]
        e["autres_references"] = " ; ".join(texte_ref(x) + (" [aberrant]" if x["aberrant"] else "") + (" [convention différente]" if x["convention_exclue"] else "")
                                            for x in rp if not (e.get("pro") and x is e["pro"]["choix"]))
        e["nb_references_pro"] = len(rp)
        att = {x["domaine"] for x in rp if x["attribution"] == "attribuée" and not x["aberrant"]}
        e["nb_sources_independantes_pro"] = len(att) + (1 if any(x["attribution"] == "non attribuée" and not x["aberrant"] for x in rp) else 0)
        e["divergence"] = ""
        if e.get("pro"):
            d = e["pro"]["divergentes"]
            if d:
                vals = [x["valeur_m3"] for x in d]
                e["divergence"] = f"valeurs publiées de {min(vals + [e['volume_demenagement_m3']])} à {max(vals + [e['volume_demenagement_m3']])} m³"
        e["volume_v6_0_m3"] = None
    hist = {}
    if (HIST / "catalogue_volumes_v6.csv").exists():
        with open(HIST / "catalogue_volumes_v6.csv", newline="") as f:
            for l in csv.DictReader(f, delimiter=";"):
                hist[l["identifiant"]] = float(l["volume_demenagement_m3"]) if l["volume_demenagement_m3"] else None
    hist61 = {}
    if (HIST61 / "catalogue_volumes_v6.csv").exists():
        with open(HIST61 / "catalogue_volumes_v6.csv", newline="") as f:
            for l in csv.DictReader(f, delimiter=";"):
                hist61[l["identifiant"]] = (float(l["volume_demenagement_m3"]) if l["volume_demenagement_m3"] else None, l["type_reference"], l["regle"])
    for i, e in base.items():
        e["volume_v6_0_m3"] = hist.get(i)
        e["volume_v6_1_m3"], e["type_reference_v6_1"], e["regle_v6_1"] = hist61.get(i, (None, "", ""))
        e["inclus_dans_cartons"] = INCLUS_DANS_CARTONS.get(i, "")

    variantes = []
    for r in refs:
        if not r.get("variante_de"):
            continue
        cible = VARIANTES_RATTACHEES.get(r["identifiant"], r["variante_de"])
        p = base[cible]
        g = r.get("volume_geometrique_median_m3")
        if cible != r["variante_de"]:
            dem, meth = p["volume_demenagement_m3"], f"rattachée à {cible} (même objet) : convention de {cible} ; jamais proposée à côté de {cible}"
        elif cible in CONVENTIONS_VALIDEES:
            dem, meth = p["volume_demenagement_m3"], "hérité : convention validée de la parente, sans ajustement de taille (les grandes tailles ont leur propre sous-catégorie)"
        elif p["volume_demenagement_m3"] and g and p["volume_geometrique_m3"] and p["statut_geo"] == "mesuré":
            f = g / p["volume_geometrique_m3"]
            fb = min(max(f, VARIANTE_BORNES[0]), VARIANTE_BORNES[1])
            dem = r3(p["volume_demenagement_m3"] * fb)
            meth = "hérité : volume retenu de la parente × (géométrique de la variante / géométrique de la parente)" + (f" ; rapport {f:.2f} borné à {fb:.2f} (bornes {VARIANTE_BORNES[0]}–{VARIANTE_BORNES[1]}, v6.2)" if fb != f else "")
        else:
            dem, meth = p["volume_demenagement_m3"], "hérité : volume retenu de la parente, sans ajustement (pas de géométrique comparable)"
        variantes.append({"identifiant": r["identifiant"], "nom": r["nom"], "variante_de": r["variante_de"], "rattachee_a": cible, "volume_geometrique_m3": g,
                          "geo_p25_m3": r.get("volume_geometrique_q1_m3"), "geo_p75_m3": r.get("volume_geometrique_q3_m3"), "nb_produits_independants": r.get("nb_modeles_independants", 0),
                          "volume_demenagement_m3": dem, "type_reference": "hérité de la sous-catégorie parente", "source_parente": p.get("type_reference", ""),
                          "fiabilite_demenagement": "provisoire", "statut_validation": "non validé", "methode_demenagement": meth})
    return cat, produits, base_refs, base, variantes, ratios, glob_dh, releves, ordre, couverture_src


# ------------------------------------------------------------------ anomalies
ANOMALIES_V61 = [
    # (sous-catégories, type, description, priorité, état, action v6.1, décision proposée)
    ("CAR-BAC-GRAND, BAG-VALISE-TRES-GRANDE", "sous-catégories créées en v6.2", "conventions validées (grand bac 0,20 m³ ; très grande valise 0,30 m³) sans sous-catégorie dans le catalogue v5", "moyenne", "résolue",
     "sous-catégories créées (nouvelles_sous_categories.py), après vérification de l'absence de doublon", "aucune ; à reprendre dans le catalogue de l'IA lors de l'intégration"),
    ("BAG-VALISE-L", "variante en doublon", "la variante « Valise — grand format » recoupe la sous-catégorie BAG-VALISE-GRANDE", "faible", "résolue",
     "variante rattachée à BAG-VALISE-GRANDE (0,30 m³) ; contrôle de double comptage ajouté", "aucune"),
    ("PEM-AUTRE", "risque de double comptage avec les cartons", "le petit électroménager « à mettre en carton » est déjà compté dans les cartons déclarés par le client", "moyenne", "contournée provisoirement",
     "colonne inclus_dans_cartons renseignée ; volume conservé pour information", "le moteur de devis ne doit pas l'ajouter quand des cartons sont déclarés (règle à prévoir à l'intégration)"),
    ("CAR-CARTON", "convention du carton", "valeurs publiées 0,05 / 0,1 / 0,2 m³ (Démén'House : carton « medium » 0,2 m³)", "élevée", "résolue",
     "convention validée appliquée : 0,10 m³ ; les autres valeurs restent en références", "aucune (décision prise le 26/11/2026) ; à noter : Démén'House compte 0,2 m³ par carton « medium »"),
    ("LIT-*, MAT-*, SOM-STD", "convention lit monté, démonté, avec ou sans literie", "les barèmes ne disent pas toujours si le matelas et le sommier sont compris ; la v6.0 ajoutait matelas et sommier à côté des lits dans les inventaires types (literie comptée deux fois)", "élevée", "résolue",
     "convention « lit complet » validée (v6.2) ; valeur « cadre et sommier démontés, sans matelas » écartée pour LIT-QUEEN ; contrôle automatique des inventaires", "aucune"),
    ("LIT-QUEEN, LIT-KING, LIT-COFFRE, LIT-NC", "géométriques mesurés incohérents entre tailles de lit", "2,93 / 3,21 / 4,36 / 4,38 m³ contre 1,02 m³ pour LIT-DOUBLE : produits mesurés avec tête de lit, coffres ou ensembles", "élevée", "contournée provisoirement",
     "volumes de déménagement par comparables (LIT-QUEEN, LIT-DOUBLE), jamais par le géométrique", "revoir le périmètre des produits mesurés"),
    ("ARM-4P, ARM-5P+, ARM-NC", "armoires : monté ou démonté ?", "Démén'House 4,3 m³ (4 portes) et 2,3 m³ (armoire « standard »), d'autres sites 2,0 m³ ; mtn-demenagement.com 3 m³ pour une 3 portes « montée » ; une source indique un gain de 30 à 40 % au démontage", "élevée", "choix documenté",
     "v6.2 : convention définitive « meubles comptés montés » ; valeurs Démén'House retenues, divergences conservées", "confirmer en revue professionnelle"),
    ("COM-NC, CHV-STD", "Démén'House incohérent avec lui-même", "liste : commode 1,5 m³, chevet 0,3 m³, lit double 2,6 m³ ; article récent : commode 0,5 à 1 m³, chevet 0,15 à 0,25 m³, lit double avec sommier 1,5 à 2,5 m³", "élevée", "résolue",
     "v6.2 : borne de la fourchette publiée la plus proche retenue (commode 1,0 ; chevet 0,25 ; lit double 2,5 m³)", "confirmer en revue professionnelle"),
    ("RAN-MEUBLE-TV", "valeur Démén'House ne correspondant pas à l'objet", "meuble TV 3,2 m³ pour un géométrique médian de 0,32 m³ (10 fois plus)", "moyenne", "résolue",
     "valeur Démén'House non retenue (règle de correspondance) ; autre valeur professionnelle retenue", "confirmer avec le professionnel"),
    ("RAN-BIB-NC, RAN-BUFFET, TAB-BASSE, COM-NC", "valeurs professionnelles très supérieures au géométrique", "2,3 à 5,4 fois le géométrique médian mesuré : barèmes visant peut-être de plus grands modèles, ou comptant la protection et le calage", "moyenne", "choix documenté",
     "v6.2 : la géométrie est un indicateur ; valeurs professionnelles conservées (sous le seuil d'aberration de 6 fois)", "confirmer en revue professionnelle"),
    ("ELM-REF-COMBI, ELM-REF-US, ELM-REF-1P, ELM-REF-TOP, ELM-CAVE", "dimensions du marché nord-américain", "largeurs médianes issues d'ENERGY STAR (combiné de 74,9 cm de large au lieu de 60 cm en France)", "moyenne", "ouverte",
     "sans effet sur les volumes de déménagement retenus quand une valeur professionnelle existe (ELM-REF, ELM-REF-COMBI, ELM-REF-US) ; effet sur ELM-REF-1P et ELM-REF-TOP (comparables en proportion)", "EPREL (démarche à faire par le porteur du projet) ou mesures françaises"),
    ("RES-DISTRIBUTEUR, PRO-COMPTOIR, PRO-PRESENTOIR, ENF-CHAISE-HAUTE", "produits mal classés", "petits distributeurs muraux, micro-ondes, vitrine à drapeau, rehausseur plié", "moyenne", "résolue",
     "produits exclus en v6.1 (conservés dans mesures_individuelles.csv) ; géométrique recalculé ou estimé par l'IA", "aucune"),
    ("INF-IMPRIMANTE, AUD-CHAINE", "produits peu représentatifs", "imprimante des années 1990, enceintes Bluetooth parmi les chaînes hi-fi", "faible", "ouverte",
     "aucune", "compléter par des mesures"),
    ("MUS-PIANO-CARRE", "volume hérité recopié", "5,0 m³ repris de l'ancien « piano à queue » pour un piano carré de 0,77 m³ géométrique", "faible", "ouverte", "aucune", "déménageur spécialisé"),
    ("204 variantes de taille", "volumes hérités de la parente", "les variantes (petit, moyen, grand) reçoivent le volume de leur parente en proportion des volumes géométriques ; aucune donnée professionnelle propre", "moyenne", "ouverte",
     "statut « hérité de la sous-catégorie parente » explicite dans variantes_v6.csv", "décider si les variantes sont exposées aux devis (recommandation : non, tant qu'elles ne sont pas validées)"),
    ("JAR-ABRI, JAR-PISCINE", "sous-catégories hétérogènes", "coffre ou abri de jardin ; piscine tubulaire ou spa", "moyenne", "ouverte", "volumes de transport estimés", "scinder les sous-catégories"),
    ("relevés non attribués", "sources anonymes", "95 valeurs sur 172 viennent de synthèses de recherche sans attribution ; elles comptent pour une seule source au total", "moyenne", "ouverte",
     "comptage corrigé (une seule source pour toutes les synthèses) ; elles ne sont retenues qu'à défaut de valeur attribuée", "relire les pages d'origine avec un réseau qui les autorise"),
]


def anomalies_auto(e):
    a = []
    v5, v = e["volume_v5_m3"], e["volume_demenagement_m3"]
    geo = e["volume_geometrique_m3"]
    rigide = e["classe_manutention"] in ("appareils et objets rigides", "meubles et objets non démontables")
    if v5 is not None and v and abs(v5 - v) / v > 0.5:
        a.append(("écart avec la v5 (information)", f"v5 {v5} m³, retenu v6.2 {v} m³ ({(v - v5) / v5:+.0%}) ; un écart avec la v5 ne justifie pas à lui seul une correction", "faible", "ouverte", "", "revue professionnelle si la sous-catégorie est dans les 40"))
    if v5 is not None and geo and rigide and v5 < 0.8 * geo and e["statut_geo"] == "mesuré":
        a.append(("v5 inférieure au volume du meuble", f"v5 {v5} m³ pour un objet rigide non démontable de {geo} m³", "élevée", "résolue" if v and v >= 0.8 * geo else "ouverte", "valeur v6.1 au moins égale au volume du meuble" if v and v >= 0.8 * geo else "", "aucune si la valeur retenue est validée"))
    if e.get("divergence"):
        a.append(("divergence entre sources", e["divergence"] + " : " + e["autres_references"][:300], "élevée" if e["prioritaire"] else "moyenne", "choix documenté", f"valeur retenue selon la règle {e['regle'][:2].strip()} ; autres valeurs conservées, aucune moyenne", "confirmer en revue professionnelle"))
    if e.get("pro") and e["pro"]["incoherence_dh"]:
        x = e["pro"]["incoherence_dh"][0]
        a.append(("Démén'House incohérent avec lui-même", f"liste {e['volume_demenagement_m3']} m³ hors de la fourchette de l'article récent ({x['bas']}–{x['haut']} m³)", "élevée", "ouverte", "valeur de la liste retenue", "choisir la série de référence"))
    for r in e["rejets"]:
        a.append(("valeur publiée non retenue", r, "moyenne", "résolue", "autre valeur retenue ; valeur écartée conservée en référence", "confirmer avec le professionnel"))
    if e["statut_geo"] == "mesuré" and e["nb_produits_independants"] <= 2 and e["prioritaire"]:
        a.append(("géométrique sur 1 ou 2 produits", f"{e['nb_produits_independants']} produit(s) mesuré(s)", "moyenne", "ouverte", "", "compléter par des mesures"))
    if e["volume_transport_m3"]:
        a.append(("géométrique déployé sans sens pour le déménagement", f"géométrique {geo} m³ ; transport estimé {e['volume_transport_m3']} m³", "moyenne", "contournée provisoirement", "volume de transport estimé par l'IA", "valider l'état de transport"))
    if e["regle"].startswith("5") and e["prioritaire"]:
        a.append(("aucune référence professionnelle", "volume obtenu par ratio géométrique de classe", "moyenne", "ouverte", "", "obtenir une valeur professionnelle"))
    for x in e["references_pro"]:
        if x["aberrant"]:
            a.append(("valeur publiée aberrante écartée", f"{x['valeur_m3']} m³ ({x['libelle']})", "faible", "résolue", "écartée", "aucune"))
    return a


ORDRES_ATTENDUS = [("ARM-1P", "ARM-2P"), ("ARM-2P", "ARM-3P"), ("ARM-3P", "ARM-4P"), ("ARM-4P", "ARM-5P+"), ("ELM-REF-TOP", "ELM-REF"), ("ELM-REF", "ELM-REF-US"),
                   ("CAN-2P", "CAN-3P"), ("CAN-3P", "CAN-ANG"), ("CAN-3P", "CAN-4P"), ("LIT-SIMPLE", "LIT-DOUBLE"), ("LIT-DOUBLE", "LIT-QUEEN"), ("LIT-QUEEN", "LIT-KING"),
                   ("LIT-SIMPLE", "LIT-SUPERP"), ("TAB-4", "TAB-6"), ("TAB-6", "TAB-8+"), ("BUR-DROIT", "BUR-ANGLE"), ("INF-TV-43", "INF-TV-55"), ("INF-TV-55", "INF-TV-75"),
                   ("COM-3T", "COM-5T"), ("RAN-BIB-BASSE", "RAN-BIB-HAUTE"), ("MAT-90", "MAT-140"), ("MAT-140", "MAT-160"), ("MAT-160", "MAT-180")]


def anomalies_ordre(base):
    a = []
    for petit, grand in ORDRES_ATTENDUS:
        vp, vg = base[petit]["volume_demenagement_m3"], base[grand]["volume_demenagement_m3"]
        if vp is not None and vg is not None and vp >= vg:
            a.append({"sous_categories": f"{petit}, {grand}", "niveau_pertinence": "", "type": "ordre incohérent entre variantes",
                      "description": f"{petit} {vp} m³ ≥ {grand} {vg} m³ ({base[petit]['type_reference']} / {base[grand]['type_reference']}) : conventions de sources différentes",
                      "priorite": "élevée", "etat_resolution": "ouverte", "action_v6_1": "aucune correction automatique (pas de valeur fabriquée)", "decision_proposee": "question au professionnel", "origine": "contrôle automatique v6.1"})
    return a


def scenario_sans_demenhouse(base, ordre):
    """Sensibilité : volume de chaque sous-catégorie si l'on retenait les autres sources professionnelles au lieu de
    Démén'House (même règle de choix, sans moyenne). Les comparables dont la parente change sont ajustés dans la même
    proportion ; les ratios géométriques restent inchangés (ils sous-estiment donc l'effet)."""
    alt = {}
    for i, e in base.items():
        if e.get("pro") and e["pro"]["choix"]["source"] in DH_SRC:
            sans = [x for x in e["references_pro"] if x["source"] not in DH_SRC]
            pro, _ = valeur_professionnelle(e, sans, ordre)
            alt[i] = pro["valeur"] if pro else e["volume_demenagement_m3"]
    for i, e in base.items():
        if i in COMPARABLES and e["regle"].startswith("4"):
            cid = COMPARABLES[i][0]
            if cid in alt and base[cid]["volume_demenagement_m3"]:
                alt[i] = e["volume_demenagement_m3"] * alt[cid] / base[cid]["volume_demenagement_m3"]
    return {i: alt.get(i, e["volume_demenagement_m3"]) for i, e in base.items()}


# ------------------------------------------------------------------ couverture et comparaison des versions
def verifier_inventaire(nom, objets, base):
    """Contrôles de double comptage (v6.2). Renvoie la liste des problèmes (vide = conforme)."""
    pb = []
    ids = [sc for sc, _ in objets]
    dupl = [sc for sc, n in Counter(ids).items() if n > 1]
    if dupl:
        pb.append(f"sous-catégorie sur plusieurs lignes : {', '.join(dupl)}")
    if any(i.startswith("LIT-") or i == "ANC-LIT" for i in ids) and any(i.startswith("MAT-") or i == "SOM-STD" for i in ids):
        pb.append("lit complet et matelas ou sommier comptés ensemble")
    cartons = [i for i in ids if i in ("CAR-CARTON",)]
    if cartons:
        pb.append("cartons dans l'inventaire de meubles (ils sont déclarés à part par le client)")
    inclus = [i for i in ids if i in INCLUS_DANS_CARTONS]
    if inclus:
        pb.append(f"objets déjà comptés dans les cartons : {', '.join(inclus)}")
    variantes = [i for i in ids if i not in base]
    if variantes:
        pb.append(f"identifiants hors sous-catégories (variantes ou inconnus) : {', '.join(variantes)}")
    for v, sc in VARIANTES_RATTACHEES.items():
        if v in ids and sc in ids:
            pb.append(f"variante {v} et sa sous-catégorie de rattachement {sc} comptées ensemble")
    if "BAG-SET" in ids and ({"BAG-VALISE", "BAG-VALISE-GRANDE", "BAG-VALISE-TRES-GRANDE"} & set(ids)):
        pb.append("ensemble de valises et valises comptées ensemble")
    bacs_cartons = [i for i in ids if i in ("CAR-BAC", "CAR-BAC-GRAND", "BAG-VALISE", "BAG-VALISE-GRANDE", "BAG-VALISE-TRES-GRANDE") and i in INCLUS_DANS_CARTONS]
    if bacs_cartons:
        pb.append(f"bacs ou valises assimilés aux cartons : {', '.join(bacs_cartons)}")
    if "JAR-SALON" in ids and ({"JAR-TABLE", "JAR-CHAISE"} & set(ids)):
        pb.append("salon de jardin (ensemble) et ses composants comptés ensemble")
    return pb


def couverture(base, alt=None):
    corr = {}
    with open(V5 / "correspondance_catalogue_existant.csv", newline="") as f:
        for l in csv.DictReader(f, delimiter=";"):
            corr[l["id_existant"]] = l["reference_normalisee_principale"]
    invs = dict(INVENTAIRES)
    for cas in ("chambre-encombree", "chambre-lits-simples", "salon-canape-jaune"):
        d = json.loads((RACINE / "tests" / "ai-eval" / "dataset" / cas / "case.json").read_text())
        items = [(corr.get(x["key"]) or x["key"], x["quantity"]) for x in d["reference"]["items"] if not x.get("optional")]
        invs[f"pièce réelle « {cas} » (référence provisoire du banc)"] = {"nature": "pièce réelle du jeu de test, référence non validée", "objets": items}
    res, decomp, verif = [], [], []
    for nom, inv in invs.items():
        pb = verifier_inventaire(nom, inv["objets"], base)
        verif.append({"inventaire": nom, "nb_lignes": len(inv["objets"]), "conforme": "oui" if not pb else "non", "problemes": " ; ".join(pb)})
        tot = defaultdict(float)
        sans, sans_v5 = [], []
        v5_tot = v61_tot = v62_tot = 0.0
        sans_dh = sum((alt[sc] or 0) * q for sc, q in inv["objets"] if sc in base and alt) if alt else None
        for sc, q in inv["objets"]:
            e = base.get(sc)
            if e is None or e["volume_demenagement_m3"] is None:
                sans.append(sc)
                continue
            v = e["volume_demenagement_m3"] * q
            tot["total"] += v
            tot[e["regle"][:1]] += v
            if e["volume_v5_m3"] is None:
                sans_v5.append(sc)
                continue
            v5 = e["volume_v5_m3"] * q
            v61 = (e["volume_v6_1_m3"] or 0) * q
            v5_tot += v5
            v61_tot += v61
            v62_tot += v
            cause = ("v5 inférieure au volume du meuble" if (e["volume_v5_m3"] < 0.8 * (e["volume_geometrique_m3"] or 0) and e["statut_geo"] == "mesuré")
                     else "valeur Démén'House" if e["regle"].startswith("1") else "autre valeur professionnelle" if e["regle"][:1] in "23"
                     else "comparable" if e["regle"].startswith("4") else "ratio géométrique")
            decomp.append({"inventaire": nom, "sous_categorie": sc, "quantite": q, "v5_m3": round(v5, 3), "v6_1_m3": round(v61, 3), "v6_2_m3": round(v, 3),
                           "ecart_v6_2_v5_m3": round(v - v5, 3), "cause_principale": cause})
        t = tot["total"]
        pc = lambda k: round(100 * tot[k] / t, 1) if t else 0.0  # noqa: E731
        res.append({"inventaire": nom, "nature": inv["nature"], "nb_lignes": len(inv["objets"]), "volume_total_v6_2_m3": round(t, 2),
                    "part_lignes_avec_reference_pct": round(100 * (len(inv["objets"]) - len(sans)) / len(inv["objets"]), 1),
                    "part_valeur_publiee_demenhouse_pct": round(pc("1"), 1), "part_autre_valeur_publiee_pct": round(pc("2") + pc("3"), 1),
                    "part_analogie_pct": pc("4"), "part_estimation_dimensions_pct": pc("5"), "part_convention_validee_pct": pc("c"),
                    "lignes_comparees_avec_v5": len(inv["objets"]) - len(sans) - len(sans_v5), "lignes_sans_valeur_v5": ", ".join(sans_v5),
                    "comparable_v5_m3": round(v5_tot, 2), "comparable_v6_1_m3": round(v61_tot, 2), "comparable_v6_2_m3": round(v62_tot, 2),
                    "ecart_v6_2_v5_m3": round(v62_tot - v5_tot, 2), "ecart_v6_2_v5_pct": round(100 * (v62_tot - v5_tot) / v5_tot, 1) if v5_tot else None,
                    "scenario_sans_demenhouse_m3": round(sans_dh, 2) if sans_dh is not None else None, "doubles_comptages": "aucun" if not pb else " ; ".join(pb),
                    "sans_reference": ", ".join(sans)})
    return res, decomp, verif


# ------------------------------------------------------------------ écriture
def ecrire_csv(chemin, lignes, colonnes):
    with open(chemin, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=colonnes, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for l in lignes:
            w.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in l.items()})


COLONNES = ["identifiant", "nom", "famille_id", "niveau_pertinence", "prioritaire", "classe_manutention",
            "volume_v5_m3", "volume_v6_0_m3", "volume_v6_1_m3", "volume_demenagement_m3", "inclus_dans_cartons", "type_reference", "regle", "source_principale", "autres_references",
            "nb_references_pro", "nb_sources_independantes_pro", "divergence", "fiabilite_demenagement", "statut_validation", "methode_demenagement",
            "volume_geometrique_m3", "geo_p25_m3", "geo_p75_m3", "geo_dispersion", "statut_geo", "fiabilite_geo", "nb_produits_independants",
            "nb_sources_distinctes", "nb_exclus_aberrants", "methode_geo", "volume_transport_m3", "commentaires"]


def observations_urls():
    urls = defaultdict(set)
    for f in sorted((V5 / "observations").glob("*.csv")):
        with open(f, newline="") as h:
            for o in csv.DictReader(h, delimiter=";"):
                if o.get("id_produit") and o.get("url_source"):
                    urls[o["id_produit"]].add(o["url_source"])
    return urls


def observations_partielles(ids):
    res = []
    for f in sorted((V5 / "observations").glob("*.csv")):
        with open(f, newline="") as h:
            for o in csv.DictReader(h, delimiter=";"):
                if o["sous_categorie_id"] in ids and o.get("utilisable_dimensions_partielles") in ("oui", "True"):
                    res.append(o)
    return res


def main():
    cat, produits, base_refs, base, variantes, ratios, glob_dh, releves, ordre, couverture_src = construire()
    for e in base.values():
        res = []
        if e["statut_geo"] != "mesuré":
            res.append("volume géométrique non mesuré")
        if e["regle"][:1] in "45":
            res.append("aucune valeur professionnelle propre à la sous-catégorie")
        if e.get("divergence"):
            res.append("sources divergentes")
        e["commentaires"] = " ; ".join(res)
    lignes = sorted(base.values(), key=lambda e: (e["niveau_pertinence"], e["famille_id"], e["identifiant"]))
    ecrire_csv(SORTIE / "catalogue_volumes_v6.csv", lignes, COLONNES)
    pro_json = lambda e: [{k: x[k] for k in ("valeur_m3", "bas", "haut", "domaine", "attribution", "libelle", "convention", "aberrant")} for x in e["references_pro"]]  # noqa: E731
    (SORTIE / "catalogue_volumes_v6.json").write_text(json.dumps({
        "version": VERSION, "genere_le": "2026-11-26",
        "regles": {"carton": CARTON, "conventions_validees": {k: v[0] for k, v in CONVENTIONS_VALIDEES.items()}, "conventions_sans_sous_categorie": CONVENTIONS_SANS_SOUS_CATEGORIE, "priorite": "Démén'House (valeur unique) > autre source attribuée (barème le plus couvrant) > valeur non attribuée > comparable > ratio géométrique de classe",
                   "dh_rapport_max": DH_RAPPORT_MAX, "corroboration": CORROBORATION, "divergence": DIVERGENCE, "conventions_exclues": CONVENTIONS_EXCLUES,
                   "ordre_sources_attribuees": ordre, "convention_lit": "lit complet : cadre, sommier et matelas"},
        "sous_categories": [{**{k: e.get(k) for k in COLONNES}, "references_pro": pro_json(e), "estimation_ia": e.get("estimation_ia"), "transport_ia": e.get("transport_ia"),
                             "produits_exclus_v6_1": e.get("produits_exclus_v6_1")} for e in lignes],
        "variantes": variantes,
        "ratios_classes": {c: {"ratio": round(v["ratio"], 3), "origine": v["origine"], "ancres": [[i, round(x, 3)] for i, x in v["ancres"]]} for c, v in ratios.items()},
        "ratio_global": round(glob_dh, 3)}, ensure_ascii=False, indent=1))
    ecrire_csv(SORTIE / "variantes_v6.csv", variantes, list(variantes[0].keys()))

    # Mesures individuelles : produits retenus, exclus (v5 et v6.1), mesures partielles, estimations de l'IA.
    urls = observations_urls()
    mes = []

    def ligne(sc, p, statut, rem=""):
        return {"sous_categorie_id": sc, "id_produit": p["id_produit"], "statut_mesure": statut, "source_distincte": source_produit(p), "bases_documentaires": p["sources"],
                "nom_commercial": p["nom_commercial"], "marque": p.get("marque", ""), "hauteur_cm": p["hauteur_cm"], "largeur_cm": p["largeur_cm"], "profondeur_cm": p["profondeur_cm"],
                "volume_geometrique_m3": p["volume_geometrique_m3"], "url_sources": " ".join(sorted(urls.get(p["id_produit"], []))[:3]), "remarque": rem}
    for i, r in base_refs.items():
        exclus61 = set(base[i]["produits_exclus_v6_1"])
        for pid in r.get("produits_utilises", []):
            if pid in produits:
                mes.append(ligne(i, produits[pid], "mesuré — exclu v6.1 (mal classé)" if pid in exclus61 else "mesuré — retenu", EXCLUSIONS_SC.get(i, (None, ""))[1] if pid in exclus61 else ""))
        for pid in r.get("produits_exclus", []):
            if pid in produits:
                mes.append(ligne(i, produits[pid], "mesuré — exclu (valeur aberrante, v5)"))
    partielles = [i for i, e in base.items() if e["statut_geo"] == "partiellement mesuré"]
    for o in observations_partielles(set(partielles)):
        mes.append({"sous_categorie_id": o["sous_categorie_id"], "id_produit": o.get("id_produit", ""), "statut_mesure": "mesure partielle (2 dimensions)",
                    "source_distincte": f"marque:{(o.get('marque') or o.get('fabricant') or '').lower()}", "bases_documentaires": o["source"], "nom_commercial": o["nom_commercial"],
                    "marque": o.get("marque", ""), "hauteur_cm": o["hauteur_cm"], "largeur_cm": o["largeur_cm"], "profondeur_cm": o["profondeur_cm"], "volume_geometrique_m3": "",
                    "url_sources": o["url_source"], "remarque": f"dimension manquante : {o.get('dimensions_manquantes', '')}"})
    for i, e in base.items():
        for cle, typ in (("estimation_ia", "estimation IA — modèle type (pas une mesure)"), ("transport_ia", "estimation IA — état de transport (pas une mesure)")):
            x = e.get(cle)
            if x:
                mes.append({"sous_categorie_id": i, "id_produit": "", "statut_mesure": typ, "source_distincte": "", "bases_documentaires": "",
                            "nom_commercial": "", "marque": "", "hauteur_cm": x["hauteur_cm"], "largeur_cm": x["largeur_cm"], "profondeur_cm": x["profondeur_cm"],
                            "volume_geometrique_m3": r3(x["hauteur_cm"] * x["largeur_cm"] * x["profondeur_cm"] / 1e6), "url_sources": "",
                            "remarque": f"{x['note']} ; fourchette {x['fourchette_m3'][0]}–{x['fourchette_m3'][1]} m³" + (f" ; mesurées : {', '.join(x['dimensions_mesurees'])}" if x.get("dimensions_mesurees") else "")})
    ecrire_csv(SORTIE / "mesures_individuelles.csv", mes, list(mes[0].keys()))

    rel = [{"sous_categorie_id": sc, "valeur_m3": "" if v is None else v, "fourchette_bas_m3": "" if b is None else b, "fourchette_haut_m3": "" if h is None else h,
            "domaine": SOURCES[src][0], "nature_source": SOURCES[src][2], "reference_source": SOURCES[src][1], "attribution": attr, "libelle_et_remarque": lib,
            "convention": conv, "utilisable": "non (aberrant)" if (sc, v) in ABERRANTS else ("non (" + CONVENTIONS_EXCLUES[conv] + ")") if conv in CONVENTIONS_EXCLUES else "oui",
            "retenu": "oui" if base[sc].get("pro") and base[sc]["pro"]["choix"]["source"] == src and base[sc]["pro"]["choix"]["valeur_m3"] == v and base[sc]["pro"]["choix"]["libelle"] == lib else "non",
            "collecte": "moteur de recherche, 26/11/2026 ; page non ouverte (réseau bloqué) : à relire"} for sc, v, b, h, src, attr, lib, conv in RELEVES]
    ecrire_csv(SORTIE / "releves_demenageurs.csv", rel, list(rel[0].keys()))
    est = [m for m in mes if m["statut_mesure"].startswith("estimation")]
    ecrire_csv(SORTIE / "estimations_ia.csv", est, list(est[0].keys()))
    rat = [{"classe_manutention": c, "ratio_reference_sur_geometrique": round(v["ratio"], 3), "origine": v["origine"], "nb_ancres": len(v["ancres"]),
            "ancres": ", ".join(f"{i} ({x:.2f})" for i, x in v["ancres"])} for c, v in ratios.items()]
    ecrire_csv(SORTIE / "ratios_classes.csv", rat, list(rat[0].keys()))

    conv = [{"domaine": k, "rapport_median_sur_demenhouse": v["rapport_median"], "nb_sous_categories_communes": v["nb_communes"], "convention": v["convention"],
             "detail": ", ".join(f"{sc} ({r:.2f})" for sc, r in v["communes"])} for k, v in sorted(CONVENTIONS.items())]
    ecrire_csv(SORTIE / "conventions_sources.csv", conv, list(conv[0].keys()))
    ano = []
    for sc, typ, desc, prio, etat, action, dec in ANOMALIES_V61:
        ano.append({"sous_categories": sc, "niveau_pertinence": "", "type": typ, "description": desc, "priorite": prio, "etat_resolution": etat, "action_v6_1": action, "decision_proposee": dec, "origine": "revue v6.1"})
    for e in lignes:
        for typ, desc, prio, etat, action, dec in anomalies_auto(e):
            ano.append({"sous_categories": e["identifiant"], "niveau_pertinence": e["niveau_pertinence"], "type": typ, "description": desc, "priorite": prio,
                        "etat_resolution": etat, "action_v6_1": action, "decision_proposee": dec, "origine": "contrôle automatique v6.1"})
    ano.extend(anomalies_ordre(base))
    # v6.2 : impact commercial (objet fréquent des inventaires types, ou volume unitaire ≥ 0,5 m³ pour une prioritaire).
    frequents = {sc for inv in INVENTAIRES.values() for sc, _ in inv["objets"]}
    for a in ano:
        scs = [x.strip() for x in a["sous_categories"].replace("*", "").split(",")]
        sig = any(sc in frequents or (sc in base and base[sc]["prioritaire"] and (base[sc]["volume_demenagement_m3"] or 0) >= 0.5) for sc in scs)
        if a["origine"] == "revue v6.1" or a["type"] in ("ordre incohérent entre variantes",):
            sig = sig or a["priorite"] == "élevée"
        if a["type"] == "aucune référence professionnelle":
            sig = any(sc in frequents or (sc in base and (base[sc]["volume_demenagement_m3"] or 0) >= 1.0) for sc in scs)
        if a["type"].startswith("écart avec la v5") or a["priorite"] == "faible":
            sig = False
        a["impact_commercial"] = "significatif" if sig else "mineur"
    ordre_p = {"élevée": 0, "moyenne": 1, "faible": 2}
    ordre_e = {"ouverte": 0, "contournée provisoirement": 1, "choix documenté": 2, "résolue": 3}
    ano.sort(key=lambda a: (ordre_e[a["etat_resolution"]], ordre_p[a["priorite"]], str(a["niveau_pertinence"]), a["sous_categories"]))
    for k, a in enumerate(ano, 1):
        a["id"] = f"ANO-{k:03d}"
    cols_ano = ["id", "sous_categories", "niveau_pertinence", "type", "description", "priorite", "impact_commercial", "etat_resolution", "action_v6_1", "decision_proposee", "origine"]
    ecrire_csv(SORTIE / "anomalies.csv", ano, cols_ano)
    restantes = sorted((a for a in ano if a["etat_resolution"] not in ("résolue",)), key=lambda a: (a["impact_commercial"] != "significatif", ordre_p[a["priorite"]], a["id"]))
    ecrire_csv(SORTIE / "anomalies_restantes.csv", restantes, cols_ano)

    # Suivi des anomalies de la v6.0.
    suivi = []
    if (HIST / "anomalies.csv").exists():
        nouvelles = {(a["sous_categories"], a["type"]) for a in ano if a["etat_resolution"] != "résolue"}
        with open(HIST / "anomalies.csv", newline="") as f:
            for a in csv.DictReader(f, delimiter=";"):
                cle = (a["sous_categories"], a["type"])
                typ = a["type"]
                if a["sous_categories"] == "CAR-CARTON" or typ == "convention du carton":
                    etat, note = "résolue", "convention de 0,10 m³ validée"
                elif typ == "volumes géométriques mesurés invraisemblables":
                    etat, note = "résolue", "produits mal classés exclus (sauf INF-IMPRIMANTE, laissée ouverte)"
                elif typ in ("volume de déménagement inférieur au volume du meuble",):
                    v = base.get(a["sous_categories"], {}).get("volume_demenagement_m3")
                    g = base.get(a["sous_categories"], {}).get("volume_geometrique_m3")
                    etat, note = ("résolue", f"valeur v6.1 {v} m³ ≥ 80 % du géométrique {g} m³") if v and g and v >= 0.8 * g else ("ouverte", "")
                elif typ == "relevé public aberrant écarté":
                    etat, note = "résolue", "écarté"
                elif typ == "incohérence entre tailles de lit":
                    etat, note = "contournée provisoirement", "comparables ; produits à revoir"
                elif typ in ("volume hérité très différent", "relevés publics très dispersés", "relevés publics sous le volume géométrique", "relevés publics très supérieurs au volume géométrique"):
                    etat, note = "remplacée", "remplacée par les contrôles v6.1 (écart avec la v5, divergence entre sources), voir anomalies.csv"
                elif cle in nouvelles or any(n[0] == a["sous_categories"] and n[1] == typ for n in nouvelles):
                    etat, note = "ouverte", "toujours présente en v6.1"
                else:
                    etat, note = "ouverte", "reprise sous une autre forme ou à revoir"
                suivi.append({**a, "etat_v6_1": etat, "note_v6_1": note})
        ecrire_csv(SORTIE / "suivi_anomalies_v6_0.csv", suivi, list(suivi[0].keys()))

    alt = scenario_sans_demenhouse(base, ordre)
    # Règles de correspondance des identifiants (v6.2) : anciens identifiants du moteur (v5) → sous-catégorie v6.2,
    # variantes → sous-catégorie à utiliser, nouvelles sous-catégories.
    corresp = []
    with open(V5 / "correspondance_catalogue_existant.csv", newline="") as f:
        for l in csv.DictReader(f, delimiter=";"):
            cible = l["reference_normalisee_principale"]
            corresp.append({"identifiant_source": l["id_existant"], "type": "ancien identifiant du moteur (catalogue v5)", "nom_source": l["nom_existant"],
                            "identifiant_v6_2": cible, "nom_v6_2": base[cible]["nom"] if cible in base else "", "volume_v6_2_m3": base[cible]["volume_demenagement_m3"] if cible in base else "",
                            "regle": "correspondance v5 (référence normalisée principale)"})
    for v in variantes:
        corresp.append({"identifiant_source": v["identifiant"], "type": "variante de taille (non exposée aux devis)", "nom_source": v["nom"],
                        "identifiant_v6_2": v["rattachee_a"], "nom_v6_2": base[v["rattachee_a"]]["nom"], "volume_v6_2_m3": base[v["rattachee_a"]]["volume_demenagement_m3"],
                        "regle": "rattachée à une autre sous-catégorie (même objet)" if v["rattachee_a"] != v["variante_de"] else "sous-catégorie parente"})
    for n in NOUVELLES:
        corresp.append({"identifiant_source": n["identifiant"], "type": "sous-catégorie créée en v6.2", "nom_source": n["nom"], "identifiant_v6_2": n["identifiant"],
                        "nom_v6_2": n["nom"], "volume_v6_2_m3": base[n["identifiant"]]["volume_demenagement_m3"], "regle": "nouvelle sous-catégorie (convention validée)"})
    ecrire_csv(SORTIE / "correspondance_identifiants_v6_2.csv", corresp, list(corresp[0].keys()))

    cov, decomp, verif = couverture(base, alt)
    ecrire_csv(SORTIE / "couverture_inventaires.csv", cov, list(cov[0].keys()))
    ecrire_csv(SORTIE / "verification_inventaires.csv", verif, list(verif[0].keys()))

    # Journal des corrections v6.1 → v6.2 (sous-catégories).
    corr = []
    for e in lignes:
        a, b = e["volume_v6_1_m3"], e["volume_demenagement_m3"]
        if a is None or b is None or abs(a - b) < 0.0005:
            continue
        rg = e["regle"]
        if rg.startswith("1b"):
            raison, conf = "Démén'House incohérent avec son article récent : la borne publiée la plus proche est retenue (cohérence entre ses deux publications)", "moyenne"
        elif e["identifiant"] in CONVENTIONS_VALIDEES:
            raison, conf = f"convention commerciale validée par Devis Scan (26/11/2026) : {e['methode_demenagement'].split(' : ')[-1]} ; non assimilé au carton", "élevée (convention validée)"
        elif rg[:1] in "23" and e["regle_v6_1"][:1] != rg[:1] or (rg[:1] in "23" and e["type_reference_v6_1"] != e["type_reference"]):
            raison, conf = "valeur publiée réintégrée : la règle v6.1 « au moins 80 % du volume géométrique » est retirée (la géométrie sert d'indicateur, pas de plancher)", "moyenne"
        elif rg[:1] in "23":
            raison, conf = "valeur publiée réintégrée (retrait du plancher géométrique de la v6.1)", "moyenne"
        elif rg.startswith("4"):
            raison, conf = f"suit la sous-catégorie comparable ({e['methode_demenagement'][:60]}…)", "faible"
        else:
            raison, conf = "estimation par les dimensions : ratio de classe recalculé sur toutes les valeurs professionnelles retenues (v6.1 : Démén'House seul, rapports de 2,1 à 2,7 qui ajoutaient des marges)", "faible"
        corr.append({"identifiant": e["identifiant"], "nom": e["nom"], "niveau_pertinence": e["niveau_pertinence"], "valeur_v6_1_m3": a, "valeur_v6_2_m3": b,
                     "ecart_m3": r3(b - a), "ecart_pct": round(100 * (b - a) / a, 1) if a else "", "raison": raison, "source_ou_methode": e["source_principale"] + " — " + e["methode_demenagement"],
                     "type_reference_v6_2": e["type_reference"], "confiance": conf})
    for n in NOUVELLES:
        e = base[n["identifiant"]]
        corr.append({"identifiant": n["identifiant"], "nom": n["nom"], "niveau_pertinence": n["niveau_pertinence"], "valeur_v6_1_m3": "absente (sous-catégorie créée en v6.2)",
                     "valeur_v6_2_m3": e["volume_demenagement_m3"], "ecart_m3": "", "ecart_pct": "", "raison": "sous-catégorie créée en v6.2 après vérification de l'absence de doublon ; " + e["methode_demenagement"],
                     "source_ou_methode": e["source_principale"], "type_reference_v6_2": e["type_reference"], "confiance": "élevée (convention validée)"})
    var61 = {}
    if (HIST61 / "variantes_v6.csv").exists():
        with open(HIST61 / "variantes_v6.csv", newline="") as f:
            var61 = {l["identifiant"]: l for l in csv.DictReader(f, delimiter=";")}
    for v in variantes:
        if v["variante_de"] in ("BAG-VALISE", "CAR-BAC") and v["identifiant"] in var61:
            a61 = float(var61[v["identifiant"]]["volume_demenagement_m3"])
            if abs(a61 - v["volume_demenagement_m3"]) >= 0.0005:
                corr.append({"identifiant": v["identifiant"], "nom": v["nom"], "niveau_pertinence": "variante", "valeur_v6_1_m3": a61, "valeur_v6_2_m3": v["volume_demenagement_m3"],
                             "ecart_m3": r3(v["volume_demenagement_m3"] - a61), "ecart_pct": round(100 * (v["volume_demenagement_m3"] - a61) / a61, 1),
                             "raison": v["methode_demenagement"], "source_ou_methode": f"convention de {v['rattachee_a']}", "type_reference_v6_2": v["type_reference"], "confiance": "élevée (convention validée)"})
    ecrire_csv(SORTIE / "corrections_v6_2.csv", corr, list(corr[0].keys()))
    ecrire_csv(SORTIE / "decomposition_ecart_v5.csv", decomp, list(decomp[0].keys()))
    comp = [{"identifiant": e["identifiant"], "nom": e["nom"], "niveau_pertinence": e["niveau_pertinence"], "volume_v5_m3": e["volume_v5_m3"], "volume_v6_0_m3": e["volume_v6_0_m3"],
             "volume_v6_1_m3": e["volume_v6_1_m3"], "volume_v6_2_m3": e["volume_demenagement_m3"],
             "ecart_v6_2_v6_1_m3": r3(e["volume_demenagement_m3"] - e["volume_v6_1_m3"]) if e["volume_demenagement_m3"] is not None and e["volume_v6_1_m3"] is not None else "",
             "type_reference_v6_2": e["type_reference"], "scenario_sans_demenhouse_m3": r3(alt[e["identifiant"]]) if alt[e["identifiant"]] is not None else ""} for e in lignes]
    ecrire_csv(SORTIE / "comparatif_versions.csv", comp, list(comp[0].keys()))

    # Synthèse.
    tous, prio = lignes, [e for e in lignes if e["prioritaire"]]
    c = lambda l, f: sum(1 for e in l if f(e))  # noqa: E731
    syn = {"version": VERSION, "sous_categories": len(tous), "prioritaires": len(prio),
           "avec_volume": c(tous, lambda e: e["volume_demenagement_m3"] is not None), "exceptions": c(tous, lambda e: e["type_reference"] == "exception documentée"),
           "regle": dict(Counter(e["regle"][:1] for e in tous)), "regle_prioritaires": dict(Counter(e["regle"][:1] for e in prio)),
           "type_reference": dict(Counter(e["type_reference"].split(" — ")[0] if e["type_reference"].startswith("attribuée") else e["type_reference"] for e in tous)),
           "type_reference_prioritaires": dict(Counter(e["type_reference"].split(" — ")[0] if e["type_reference"].startswith("attribuée") else e["type_reference"] for e in prio)),
           "fiabilite_demenagement": dict(Counter(e["fiabilite_demenagement"] for e in tous)), "fiabilite_demenagement_prioritaires": dict(Counter(e["fiabilite_demenagement"] for e in prio)),
           "valides_par_professionnel": 0, "conventions_validees": c(tous, lambda e: e["type_reference"] == "convention validée par Devis Scan"),
           "conventions_sans_sous_categorie": CONVENTIONS_SANS_SOUS_CATEGORIE,
           "geo": dict(Counter(e["statut_geo"] for e in tous)), "fiabilite_geo_mesures": dict(Counter(e["fiabilite_geo"] for e in tous if e["statut_geo"] == "mesuré")),
           "prioritaires_reference_documentee": c(prio, lambda e: e["statut_geo"] in ("mesuré", "partiellement mesuré") or e["regle"][:1] in "123"),
           "prioritaires_valeur_pro": c(prio, lambda e: e["regle"][:1] in "123"), "divergences": c(tous, lambda e: bool(e.get("divergence"))),
           "references_pro": len(RELEVES), "references_valeur_unique": sum(1 for r in RELEVES if r[1] is not None), "references_fourchette": sum(1 for r in RELEVES if r[1] is None),
           "references_attribuees": sum(1 for r in RELEVES if r[5] == "attribuée"), "references_demenhouse": sum(1 for r in RELEVES if r[4] in DH_SRC),
           "domaines_attribues": sorted({SOURCES[r[4]][0] for r in RELEVES if r[5] == "attribuée"}),
           "sous_categories_avec_reference_pro": len({r[0] for r in RELEVES}), "ordre_sources_attribuees": ordre, "couverture_sources": dict(couverture_src),
           "anomalies": len(ano), "anomalies_par_etat": dict(Counter(a["etat_resolution"] for a in ano)), "anomalies_par_priorite": dict(Counter(a["priorite"] for a in ano)),
           "anomalies_ouvertes_elevees": c(ano, lambda a: a["etat_resolution"] == "ouverte" and a["priorite"] == "élevée"),
           "mesures_individuelles": len(mes), "mesures_par_statut": dict(Counter(m["statut_mesure"] for m in mes)),
           "variantes": len(variantes), "ratios_classes": {k: round(v["ratio"], 2) for k, v in ratios.items()}, "ratio_global": round(glob_dh, 2), "anomalies_restantes_significatives": sum(1 for a in ano if a["etat_resolution"] != "résolue" and a["impact_commercial"] == "significatif"),
           "couverture_inventaires": cov}
    (SORTIE / "synthese.json").write_text(json.dumps(syn, ensure_ascii=False, indent=1))
    print(json.dumps({k: v for k, v in syn.items() if k != "couverture_inventaires"}, ensure_ascii=False, indent=1))
    for x in cov:
        print(x)
    return base, ano


if __name__ == "__main__":
    main()
