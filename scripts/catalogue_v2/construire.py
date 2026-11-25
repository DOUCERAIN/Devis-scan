"""
Construction du grand catalogue Devis Scan (version 2) — fichiers préparatoires, aucune écriture en base.

Entrées (téléchargées dans data/catalogue-v2/cache/, non versionnées) :
  - ABO : abo-listings.tar (CC BY 4.0) ;
  - Wikidata : wikidata/Q*.json + wikidata/entities.json (CC0) ;
  - ItemFits : itemfits-catalog.csv (documentaire uniquement) ;
  - ancien catalogue : data/catalog/catalog.json (134 références, jamais modifié).
Sorties (data/catalogue-v2/) : voir README du dossier.

Lancer : python3 scripts/catalogue_v2/construire.py
"""
from __future__ import annotations
import csv
import hashlib
import json
import math
import os
import re
import statistics
import sys
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from taxonomie import FAMILLES, NOMS_FAMILLES, PAR_ID, SOUS_CATEGORIES  # noqa: E402
from sources_abo import lire_abo  # noqa: E402
from sources_autres import lire_itemfits, lire_wikidata  # noqa: E402

RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
CACHE = os.path.join(RACINE, "data", "catalogue-v2", "cache")
SORTIE = os.path.join(RACINE, "data", "catalogue-v2")
DATE_COLLECTE = "2026-11-25"
SOURCES_COMMERCIALES = {"ABO", "WIKIDATA"}

MOTIF_LOT = re.compile(
    r"(?:\bset of\b|\bpack of\b|\b\d+[\s-]*(?:pack|pk|pcs?|pieces?|piece set|stuck|pezzi|piezas|stuks)\b|\blot de\b|\bjuego de\b|\bset di\b|\bset de\b|"
    r"\b(?:2|3|4|5|6|8|10|12)[\s-]*(?:er[\s-]*set|-er set)\b|\bset\b|\bbundle\b|\bpaire\b|\bpair of\b|\bconjunto\b)"
)


# --------------------------------------------------------------------------- outils
def r1(x):
    return None if x is None else round(x, 1)


def quantiles(vals):
    v = sorted(vals)
    if len(v) == 1:
        return v[0], v[0], v[0]
    q = statistics.quantiles(v, n=4, method="inclusive")
    return q[0], statistics.median(v), q[2]


def norm_marque(m: str) -> str:
    m = m.lower()
    m = re.sub(r"amazon\s*(brand|marke|merk|marca|marchio|märke)?\s*[-–:]?\s*", "", m)
    m = re.sub(r"[^a-z0-9]+", "", m)
    return m or "inconnue"


def mots(nom: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", nom.lower()) if w not in {"amazon", "brand", "with", "and", "the", "for"}}


class Union:
    def __init__(self):
        self.p = {}

    def trouver(self, x):
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def unir(self, a, b):
        a, b = str(a), str(b)
        ra, rb = self.trouver(a), self.trouver(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


# --------------------------------------------------------------------------- 1. observations
def qualifier(obs, sc):
    """Complétude, plausibilité, lot, concordance avec le nom, fiabilité et usage statistique (sans rien modifier)."""
    dims = [obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"]]
    n = sum(d is not None for d in dims)
    obs["nb_dimensions"] = n
    obs["completude"] = {3: "complète (3 dimensions)", 2: "partielle (2 dimensions)", 1: "partielle (1 dimension)", 0: "aucune dimension"}[n]
    manque = [nom for nom, d in zip(("hauteur", "largeur", "profondeur"), dims) if d is None]
    obs["dimensions_manquantes"] = ", ".join(manque)
    obs["volume_geometrique_m3"] = round(dims[0] * dims[1] * dims[2] / 1e6, 4) if n == 3 else None
    obs["famille_id"] = sc.famille
    obs["famille"] = NOMS_FAMILLES[sc.famille]
    obs["sous_categorie_id"] = sc.id
    obs["sous_categorie"] = sc.nom
    remarques = [obs.pop("commentaire_source", "")] if obs.get("commentaire_source") else []

    # Plausibilité (bornes de la sous-catégorie)
    b = sc.bornes
    def conforme(h, g, p):
        ok = True
        if h is not None and "h" in b:
            ok &= b["h"][0] <= h <= b["h"][1]
        if g is not None and "grand" in b:
            ok &= b["grand"][0] <= g <= b["grand"][1]
        if p is not None and "petit" in b:
            ok &= b["petit"][0] <= p <= b["petit"][1]
        return ok
    if n == 0:
        obs["plausibilite"] = "non évaluable"
    elif conforme(*dims):
        obs["plausibilite"] = "conforme"
    else:
        obs["plausibilite"] = "hors bornes"
        for f, txt in ((0.1, "÷10"), (10, "×10"), (0.254, "valeurs saisies en cm mais déclarées en pouces ?"), (1 / 2.54, "pouces déclarés en cm ?")):
            if conforme(*(None if d is None else d * f for d in dims)):
                remarques.append(f"erreur d'unité probable ({txt}) : valeur conservée telle quelle, exclue des statistiques")
                break

    # Lot ou ensemble
    obs["lot_ou_ensemble"] = "oui" if MOTIF_LOT.search(obs["nom_commercial"].lower()) else "non"
    if obs["lot_ou_ensemble"] == "oui":
        remarques.append("lot ou ensemble : dimensions peut-être celles du lot ou d'un seul élément, exclues des statistiques")

    # Concordance avec les dimensions annoncées dans le nom
    du_nom = obs.pop("dimensions_du_nom", []) or []
    obs["dimensions_annoncees_nom_cm"] = ", ".join(f"{v:.1f}" for v in du_nom)
    if du_nom and n > 0:
        presentes = [d for d in dims if d is not None]
        ok = sum(any(abs(v - d) <= max(2.0, 0.04 * v) for d in presentes) for v in du_nom)
        obs["concordance_nom"] = "concordante" if ok == len(du_nom) else "partielle" if ok else "discordante"
        if obs["concordance_nom"] == "discordante":
            remarques.append("dimensions de la fiche différentes de celles annoncées dans le nom (dimensions du colis ?)")
    else:
        obs["concordance_nom"] = "non vérifiable"

    commerciale = obs["source"] in SOURCES_COMMERCIALES
    utilisable = commerciale and n == 3 and obs["plausibilite"] == "conforme" and obs["lot_ou_ensemble"] == "non" and obs["concordance_nom"] != "discordante"
    obs["utilisable_statistiques"] = "oui" if utilisable else "non"
    if not commerciale:
        obs["motif_exclusion"] = "source documentaire (réutilisation commerciale incertaine)"
    elif n < 3:
        obs["motif_exclusion"] = "dimensions incomplètes (" + obs["dimensions_manquantes"] + " manquante(s))"
    elif obs["plausibilite"] != "conforme":
        obs["motif_exclusion"] = "dimensions hors des bornes plausibles de la sous-catégorie"
    elif obs["lot_ou_ensemble"] == "oui":
        obs["motif_exclusion"] = "lot ou ensemble"
    elif obs["concordance_nom"] == "discordante":
        obs["motif_exclusion"] = "dimensions discordantes avec le nom du produit"
    else:
        obs["motif_exclusion"] = ""
    if n < 3:
        obs["fiabilite_observation"] = "non vérifiée"
    elif not utilisable:
        obs["fiabilite_observation"] = "faible"
    elif obs["concordance_nom"] == "concordante":
        obs["fiabilite_observation"] = "élevée"
    else:
        obs["fiabilite_observation"] = "moyenne"
    obs["commentaires"] = " ; ".join(r for r in remarques if r)
    return obs


def collecter():
    observations = []
    for lecteur, nom in ((lire_abo, "ABO"), (lire_wikidata, "Wikidata"), (lire_itemfits, "ItemFits")):
        avant = len(observations)
        for obs, sc in lecteur(CACHE, DATE_COLLECTE) or []:
            observations.append(qualifier(obs, sc))
        print(f"  {nom} : {len(observations) - avant} observations")
    return observations


# --------------------------------------------------------------------------- 2. produits physiques
def regrouper(observations):
    """Une observation = une fiche ; un produit = un modèle physique (couleurs et pays confondus).
    Liens : même identifiant source (fiche publiée dans plusieurs pays), même marque + référence fabricant,
    ou même marque + même sous-catégorie + mêmes dimensions au centimètre (variantes de couleur)."""
    u = Union()
    for o in observations:
        oid = o["id_observation"]
        u.trouver(oid)
        u.unir(oid, ("id", o["source"], o["identifiant_source"]))
        marque = norm_marque(o["marque"])
        ref = re.sub(r"[^a-z0-9]", "", o["reference_produit"].lower())
        if len(ref) >= 4 and marque != "inconnue":
            u.unir(oid, ("ref", marque, ref))
        if o["nb_dimensions"] == 3 and marque != "inconnue" and o["source"] == "ABO":
            u.unir(oid, ("dims", marque, o["sous_categorie_id"], round(o["hauteur_cm"]), round(o["largeur_cm"]), round(o["profondeur_cm"])))
    groupes = defaultdict(list)
    for o in observations:
        groupes[u.trouver(o["id_observation"])].append(o)
    produits = []
    for membres in groupes.values():
        cle = min(m["id_observation"] for m in membres)
        pid = "PRD-" + hashlib.sha1(cle.encode()).hexdigest()[:10].upper()
        sc_id = Counter(m["sous_categorie_id"] for m in membres).most_common(1)[0][0]
        usables = [m for m in membres if m["utilisable_statistiques"] == "oui"]
        # Noms comparés uniquement entre fiches d'un même pays (sinon une traduction passerait pour un autre produit).
        par_domaine = defaultdict(list)
        for m in membres:
            par_domaine[m["domaine"]].append(mots(m["nom_commercial"]))
        proches = all(len(a & ns[0]) / max(1, len(a | ns[0])) >= 0.3 for ns in par_domaine.values() for a in ns[1:])
        statut = "produit unique" if len(membres) == 1 else "même produit (plusieurs fiches)" if proches else "doublon potentiel (dimensions identiques, noms différents)"
        p = {
            "id_produit": pid,
            "sous_categorie_id": sc_id,
            "marque": next((m["marque"] for m in membres if m["marque"]), ""),
            "nom_commercial": membres[0]["nom_commercial"],
            "nb_observations": len(membres),
            "sources": sorted({m["source"] for m in membres}),
            "statut_regroupement": statut,
            "utilisable_statistiques": bool(usables),
            "classements_divergents": len({m["sous_categorie_id"] for m in membres}) > 1,
        }
        if usables:
            for k in ("hauteur_cm", "largeur_cm", "profondeur_cm", "volume_geometrique_m3"):
                p[k] = statistics.median(m[k] for m in usables)
        produits.append(p)
        for m in membres:
            m["id_produit"] = pid
            m["statut_regroupement"] = statut
            m["nb_fiches_du_produit"] = len(membres)
            if m["utilisable_statistiques"] == "oui" and sc_id != m["sous_categorie_id"]:
                pass
    return produits


# --------------------------------------------------------------------------- 3. statistiques
def fiabilite(n_modeles, n_marques, dispersion):
    if n_modeles == 0:
        return "non vérifiée"
    if n_modeles >= 15 and n_marques >= 3 and dispersion is not None and dispersion <= 0.8:
        return "élevée"
    if n_modeles >= 5 and n_marques >= 2:
        return "moyenne"
    return "faible"


def statistiques(produits_sc):
    """Statistiques d'un ensemble de produits indépendants (un modèle physique = une valeur)."""
    ok = [p for p in produits_sc if p.get("volume_geometrique_m3")]
    exclus = []
    if len(ok) >= 8:
        logs = [math.log(p["volume_geometrique_m3"]) for p in ok]
        q1, _, q3 = quantiles(logs)
        bas, haut = q1 - 2 * (q3 - q1), q3 + 2 * (q3 - q1)
        garde = []
        for p, lv in zip(ok, logs):
            (garde if bas <= lv <= haut else exclus).append(p)
        ok = garde
    st = {"n_modeles": len(ok), "produits": ok, "exclus": exclus}
    if not ok:
        return st
    vols = [p["volume_geometrique_m3"] for p in ok]
    q1, med, q3 = quantiles(vols)
    st.update({
        "hauteur_mediane_cm": r1(statistics.median(p["hauteur_cm"] for p in ok)),
        "largeur_mediane_cm": r1(statistics.median(p["largeur_cm"] for p in ok)),
        "profondeur_mediane_cm": r1(statistics.median(p["profondeur_cm"] for p in ok)),
        "volume_median_m3": round(med, 3), "volume_q1_m3": round(q1, 3), "volume_q3_m3": round(q3, 3),
        "volume_min_m3": round(min(vols), 3), "volume_max_m3": round(max(vols), 3),
        "dispersion": round((q3 - q1) / med, 2) if med else None,
        "n_marques": len({norm_marque(p["marque"]) for p in ok}),
    })
    return st


AVERTISSEMENTS_VOLUME = {
    "JAR-PARASOL": "dimensions publiées parasol ouvert : volume non représentatif du transport (parasol replié)",
    "JAR-ABRI": "dimensions publiées monté : un abri ou une serre se transporte démonté",
    "SPO-TENTE": "dimensions publiées tente montée : une tente se transporte pliée",
    "JAR-BALANCELLE": "dimensions publiées monté (support de hamac, balancelle) : souvent transporté démonté",
    "DEC-TAPIS-GRAND": "volume à plat : un tapis se transporte roulé (volume de la boîte englobante différent)",
    "DEC-TAPIS-MOYEN": "volume à plat : un tapis se transporte roulé (volume de la boîte englobante différent)",
    "DEC-TAPIS-PETIT": "volume à plat : un tapis se transporte roulé (volume de la boîte englobante différent)",
    "DEC-TAPIS-NC": "volume à plat : un tapis se transporte roulé (volume de la boîte englobante différent)",
    "LIT-KING": "dimensions du lit monté (tête de lit comprise) : un lit se transporte généralement démonté",
    "LIT-QUEEN": "dimensions du lit monté (tête de lit comprise) : un lit se transporte généralement démonté",
    "LIT-DOUBLE": "dimensions du lit monté : un lit se transporte généralement démonté",
    "LIT-SIMPLE": "dimensions du lit monté : un lit se transporte généralement démonté",
    "LIT-NC": "dimensions du lit monté : un lit se transporte généralement démonté",
    "LIT-COFFRE": "dimensions du lit monté : un lit se transporte généralement démonté",
    "LIT-SUPERP": "dimensions du lit monté : un lit superposé se transporte démonté",
    "TAB-REPAS-NC": "plateau et pieds souvent démontables : le volume transporté peut être bien inférieur",
}

VARIANTES = [("C", "compacte", "petit format"), ("S", "standard", "format courant"), ("L", "grande", "grand format")]


def construire_catalogue(observations, produits, ancien):
    par_sc = defaultdict(list)
    for p in produits:
        if p["utilisable_statistiques"]:
            par_sc[p["sous_categorie_id"]].append(p)
    obs_sc = defaultdict(list)
    for o in observations:
        obs_sc[o["sous_categorie_id"]].append(o)
    ancien_par_id = {a["id"]: a for a in ancien}
    entrees = []
    for sc in SOUS_CATEGORIES:
        st = statistiques(par_sc.get(sc.id, []))
        obs = obs_sc.get(sc.id, [])
        doc = [o for o in obs if o["source"] not in SOURCES_COMMERCIALES and o["volume_geometrique_m3"]]
        legacy = [ancien_par_id[a] for a in sc.anciens if a in ancien_par_id]
        legacy_mv = next(((a["id"], (a["moving_volume_m3"] or {}).get("avg"), a["moving_volume_reliability"]) for a in legacy if a.get("moving_volume_m3")), None)
        e = {
            "identifiant": sc.id, "nom": sc.nom, "famille_id": sc.famille, "famille": NOMS_FAMILLES[sc.famille],
            "variante_de": "", "synonymes": sc.synonymes, "description_physique": sc.description, "caracteristiques_discriminantes": sc.discriminants,
            "hauteur_mediane_cm": st.get("hauteur_mediane_cm"), "largeur_mediane_cm": st.get("largeur_mediane_cm"), "profondeur_mediane_cm": st.get("profondeur_mediane_cm"),
            "volume_geometrique_median_m3": st.get("volume_median_m3"), "volume_geometrique_q1_m3": st.get("volume_q1_m3"), "volume_geometrique_q3_m3": st.get("volume_q3_m3"),
            "volume_geometrique_min_m3": st.get("volume_min_m3"), "volume_geometrique_max_m3": st.get("volume_max_m3"), "dispersion_relative": st.get("dispersion"),
            "nb_modeles_independants": st["n_modeles"], "nb_modeles_exclus_aberrants": len(st["exclus"]),
            "nb_observations_documentaires": len(obs), "nb_sources_documentaires": len({o["url_source"] for o in obs}),
            "nb_sources_independantes": st.get("n_marques", 0),
            "nb_observations_reutilisation_incertaine": len(doc),
            "volume_indicatif_sources_incertaines_m3": round(statistics.median(o["volume_geometrique_m3"] for o in doc), 3) if doc else None,
            "fiabilite": fiabilite(st["n_modeles"], st.get("n_marques", 0), st.get("dispersion")),
            "volume_demenagement_reference_m3": legacy_mv[1] if legacy_mv else None,
            "volume_demenagement_origine": (f"ancien catalogue « {legacy_mv[0]} » (fiabilité {legacy_mv[2]}), non recalculé" if legacy_mv else ""),
            "references_anciennes": [a["id"] for a in legacy],
            "produits_utilises": sorted(p["id_produit"] for p in st["produits"]),
            "produits_exclus": sorted(p["id_produit"] for p in st["exclus"]),
            "avertissement_volume": AVERTISSEMENTS_VOLUME.get(sc.id, ""),
            "convention_volume": "volume géométrique = hauteur × largeur × profondeur hors tout du produit monté (boîte englobante) ; jamais converti automatiquement en volume de déménagement",
        }
        entrees.append(e)
        # Variantes de taille si la sous-catégorie est nombreuse et très dispersée (écart Q3/Q1 ≥ 1,8).
        prods = sorted(st["produits"], key=lambda p: p["volume_geometrique_m3"])
        if len(prods) >= 15 and st["volume_q1_m3"] and st["volume_q3_m3"] / st["volume_q1_m3"] >= 1.8:
            tiers = [prods[: len(prods) // 3], prods[len(prods) // 3: 2 * len(prods) // 3], prods[2 * len(prods) // 3:]]
            for (code, adj, desc), groupe in zip(VARIANTES, tiers):
                sv = statistiques(groupe)
                if sv["n_modeles"] < 5:
                    continue
                entrees.append({
                    **e, "identifiant": f"{sc.id}-{code}", "nom": f"{sc.nom} — {desc}", "variante_de": sc.id,
                    "description_physique": f"{sc.description} Variante {adj} : volume entre {groupe[0]['volume_geometrique_m3']:.2f} et {groupe[-1]['volume_geometrique_m3']:.2f} m³ (tiers des modèles observés).",
                    "caracteristiques_discriminantes": f"{sc.discriminants} ; taille {adj}",
                    "hauteur_mediane_cm": sv["hauteur_mediane_cm"], "largeur_mediane_cm": sv["largeur_mediane_cm"], "profondeur_mediane_cm": sv["profondeur_mediane_cm"],
                    "volume_geometrique_median_m3": sv["volume_median_m3"], "volume_geometrique_q1_m3": sv["volume_q1_m3"], "volume_geometrique_q3_m3": sv["volume_q3_m3"],
                    "volume_geometrique_min_m3": sv["volume_min_m3"], "volume_geometrique_max_m3": sv["volume_max_m3"], "dispersion_relative": sv["dispersion"],
                    "nb_modeles_independants": sv["n_modeles"], "nb_modeles_exclus_aberrants": 0, "nb_sources_independantes": sv["n_marques"],
                    "fiabilite": fiabilite(sv["n_modeles"], sv["n_marques"], sv["dispersion"]),
                    "volume_demenagement_reference_m3": None, "volume_demenagement_origine": "",
                    "produits_utilises": sorted(p["id_produit"] for p in groupe), "produits_exclus": [],
                })
    return entrees


# --------------------------------------------------------------------------- 4. correspondance avec les 134 références
def correspondance(ancien, entrees):
    par_ancien = defaultdict(list)
    for e in entrees:
        if not e["variante_de"]:
            for a in e["references_anciennes"]:
                par_ancien[a].append(e)
    lignes = []
    for a in ancien:
        cibles = par_ancien.get(a["id"], [])
        modernes = [c for c in cibles if c["famille_id"] != "ANC"]
        principale = max(modernes or cibles, key=lambda c: c["nb_modeles_independants"], default=None) if cibles else None
        if principale and a["id"] in ("lit-double", "lit-simple", "armoire-2-portes", "commode", "chaise", "fauteuil", "bureau", "malle", "buffet-bas"):
            # Correspondance nominale prioritaire quand elle existe (la plus grande sous-catégorie n'est pas forcément la bonne).
            nominal = {"lit-double": "LIT-DOUBLE", "lit-simple": "LIT-SIMPLE", "armoire-2-portes": "ARM-2P", "commode": "COM-NC", "chaise": "CHA-REPAS",
                       "fauteuil": "FAU-STD", "bureau": "BUR-DROIT", "malle": "BAG-MALLE", "buffet-bas": "RAN-BUFFET"}[a["id"]]
            principale = next((c for c in cibles if c["identifiant"] == nominal), principale)
        geo_ancien = (a.get("geometric_volume_m3") or {}).get("avg") if isinstance(a.get("geometric_volume_m3"), dict) else None
        mv = (a.get("moving_volume_m3") or {}).get("avg")
        nouvelle_fiab = principale["fiabilite"] if principale else "non vérifiée"
        ancienne = a.get("dims_reliability") or "aucune"
        rang = {"aucune": 0, "non vérifiée": 0, "faible": 1, "moyenne": 2, "elevee": 3, "élevée": 3}
        if not cibles:
            statut = "à classer (aucune sous-catégorie)"
        elif principale["nb_modeles_independants"] == 0:
            statut = "non améliorée (aucun modèle documenté)"
        elif rang.get(nouvelle_fiab, 0) > rang.get(ancienne, 0) or (a.get("sample_size", 0) == 0 and principale["nb_modeles_independants"] > 0):
            statut = "améliorée"
        else:
            statut = "documentée (fiabilité équivalente)"
        lignes.append({
            "id_existant": a["id"], "nom_existant": a["name"], "categorie_existante": a["category"], "sous_categorie_existante": a.get("subcategory", ""),
            "synonymes_existants": "; ".join(a.get("synonyms", [])),
            "volume_demenagement_existant_m3": mv, "fiabilite_volume_existant": a.get("moving_volume_reliability"),
            "volume_geometrique_existant_m3": geo_ancien, "fiabilite_dimensions_existante": ancienne,
            "echantillon_existant_fiches": a.get("sample_size", 0),
            "type_correspondance": "aucune" if not cibles else "directe" if len(cibles) == 1 else f"éclatée en {len(cibles)} sous-catégories",
            "reference_normalisee_principale": principale["identifiant"] if principale else "",
            "references_normalisees_liees": "; ".join(c["identifiant"] for c in cibles),
            "nb_modeles_independants_nouveaux": principale["nb_modeles_independants"] if principale else 0,
            "volume_geometrique_median_nouveau_m3": principale["volume_geometrique_median_m3"] if principale else None,
            "fiabilite_nouvelle": nouvelle_fiab,
            "ecart_volume_geometrique_pct": (round(100 * (principale["volume_geometrique_median_m3"] - geo_ancien) / geo_ancien) if principale and principale["volume_geometrique_median_m3"] and geo_ancien else None),
            "statut": statut,
            "action_recommandee": (
                "conserver l'identifiant ; utiliser la référence normalisée principale pour les dimensions"
                if cibles and principale["nb_modeles_independants"] > 0 else
                "conserver l'identifiant ; documentation complémentaire nécessaire"
            ) + (" ; remplacer par la classification plus précise (" + ", ".join(c["identifiant"] for c in cibles) + ")" if len(cibles) > 1 else ""),
        })
    return lignes


# --------------------------------------------------------------------------- 5. écriture
COLONNES_OBS = [
    "id_observation", "id_produit", "statut_regroupement", "nb_fiches_du_produit", "source", "nom_source", "url_source", "url_jeu_de_donnees",
    "licence", "statut_reutilisation", "date_collecte", "fabricant", "marque", "nom_commercial", "reference_produit", "identifiant_source",
    "domaine", "pays", "type_produit_source", "categorie_source", "famille_id", "famille", "sous_categorie_id", "sous_categorie",
    "hauteur_cm", "largeur_cm", "profondeur_cm", "volume_geometrique_m3", "dimensions_origine", "unite_origine", "type_dimensions",
    "dimensions_annoncees_nom_cm", "concordance_nom", "nb_dimensions", "completude", "dimensions_manquantes", "plausibilite",
    "lot_ou_ensemble", "fiabilite_observation", "utilisable_statistiques", "motif_exclusion", "commentaires",
]


def ecrire_csv(chemin, lignes, colonnes):
    with open(chemin, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=colonnes, extrasaction="ignore", delimiter=";")
        w.writeheader()
        for l in lignes:
            w.writerow({k: ("; ".join(map(str, v)) if isinstance(v, list) else ("" if v is None else v)) for k, v in l.items()})


def main():
    os.makedirs(SORTIE, exist_ok=True)
    print("Collecte des observations…")
    observations = collecter()
    print("Regroupement en produits…")
    produits = regrouper(observations)
    ancien = json.load(open(os.path.join(RACINE, "data", "catalog", "catalog.json")))
    ancien = ancien["items"] if isinstance(ancien, dict) else ancien
    print("Statistiques et catalogue…")
    entrees = construire_catalogue(observations, produits, ancien)
    corr = correspondance(ancien, entrees)

    observations.sort(key=lambda o: (o["famille_id"], o["sous_categorie_id"], o["source"], o["id_observation"]))
    ecrire_csv(os.path.join(SORTIE, "catalogue_sources.csv"), observations, COLONNES_OBS)
    ecrire_csv(os.path.join(SORTIE, "produits_independants.csv"), sorted(produits, key=lambda p: (p["sous_categorie_id"], p["id_produit"])),
               ["id_produit", "sous_categorie_id", "marque", "nom_commercial", "nb_observations", "sources", "statut_regroupement", "classements_divergents",
                "utilisable_statistiques", "hauteur_cm", "largeur_cm", "profondeur_cm", "volume_geometrique_m3"])
    colonnes_cat = [k for k in entrees[0].keys()]
    ecrire_csv(os.path.join(SORTIE, "catalogue_devis_scan.csv"), entrees, colonnes_cat)
    ecrire_csv(os.path.join(SORTIE, "correspondance_catalogue_existant.csv"), corr, list(corr[0].keys()))
    json.dump({
        "version": "2.0-preparatoire",
        "genere_le": DATE_COLLECTE,
        "convention_volume": entrees[0]["convention_volume"],
        "familles": [{"identifiant": f, "nom": n} for f, n in FAMILLES],
        "references": [{k: v for k, v in e.items() if k != "convention_volume"} for e in entrees],
        "attributions": [
            "Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan.",
            "Données Wikidata, CC0.",
        ],
    }, open(os.path.join(SORTIE, "catalogue_devis_scan.json"), "w"), ensure_ascii=False, indent=1)
    json.dump({"observations": observations, "produits": produits, "entrees": entrees, "correspondance": corr,
               "hors_perimetre_abo": getattr(lire_abo, "hors_perimetre", {}), "wikidata_sans_libelle": getattr(lire_wikidata, "sans_libelle", 0)},
              open(os.path.join(CACHE, "etat_construction.json"), "w"), ensure_ascii=False, default=list)
    print(f"Observations : {len(observations)} ; produits : {len(produits)} ; références normalisées : {len(entrees)}")


if __name__ == "__main__":
    main()
