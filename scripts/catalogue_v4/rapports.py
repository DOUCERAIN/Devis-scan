"""
Rapports du catalogue v4 (tableau de bord, pertinence et couverture métier, qualité, couverture) et synthèse.
Recalculés à chaque exécution à partir de data/catalogue-v4/cache/etat_construction.json.

Lancer après construire.py et audit_dimensions.py : python3 scripts/catalogue_v4/rapports.py
"""
from __future__ import annotations
import json
import os
import sys
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.join(RACINE, "data", "catalogue-v4")
etat = json.load(open(os.path.join(SORTIE, "cache", "etat_construction.json")))
OBS, PROD, ENT, CORR = etat["observations"], etat["produits"], etat["entrees"], etat["correspondance"]
V3 = json.load(open(os.path.join(RACINE, "data", "catalogue-v3", "synthese.json")))
AUDIT = json.load(open(os.path.join(SORTIE, "cache", "audit_dimensions.json")))
sys.path.insert(0, ICI)
from taxonomie import FAMILLES, NOMS_FAMILLES  # noqa: E402
from pertinence import LIBELLES, NIVEAUX_FAMILLES, POIDS  # noqa: E402

fr = lambda n: f"{n:,}".replace(",", " ")
pc = lambda a, b: f"{100 * a / b:.0f} %" if b else "—"
m3 = lambda v: "—" if v in (None, "") else f"{v:.3f}".replace(".", ",")
cm = lambda v: "—" if v in (None, "") else f"{v:.0f}"

NOMS_SOURCES = {
    "ABO": ("Amazon Berkeley Objects (ABO)", "CC BY 4.0", "1"), "WIKIDATA": ("Wikidata", "CC0", "1"),
    "MET": ("Metropolitan Museum of Art", "CC0", "1"), "MOMA": ("Museum of Modern Art", "CC0", "1"),
    "CMA": ("Cleveland Museum of Art", "CC0", "1"), "SMITHSONIAN": ("Smithsonian Open Access", "CC0", "1"),
    "ENERGYSTAR": ("ENERGY STAR (EPA, États-Unis)", "domaine public", "1"), "ITEMFITS": ("ItemFits", "conditions contradictoires", "2"),
}
FIABLES = {"élevée", "moyenne"}

base = [e for e in ENT if not e["variante_de"]]
variantes = [e for e in ENT if e["variante_de"]]
dims = Counter(o["nb_dimensions"] for o in OBS)
utilisables = [o for o in OBS if o["utilisable_statistiques"] == "oui"]
prod_util = [p for p in PROD if p["utilisable_statistiques"]]
sources_obs = Counter(o["source"] for o in OBS)
fiab = Counter(e["fiabilite"] for e in base)
prioritaires = [e for e in base if e["references_anciennes"]]
prio_ok = [e for e in prioritaires if e["couverture_dimensions"] == "complète"]
prio_partiel = [e for e in prioritaires if e["couverture_dimensions"] == "partielle"]
NON_MESURABLES = {"DIV-AUTRE", "CAR-SAC"}  # « objet non classé », « sac ou ballot » : volume propre à chaque objet
corr_stat = Counter(c["statut"] for c in CORR)


def exploitable(e):
    """Référence exploitable par le moteur IA : pertinente (niveaux 1 à 3), dimensions complètes, fiabilité moyenne ou
    élevée (≥ 5 modèles, ≥ 2 sources indépendantes)."""
    return e["niveau_pertinence"] <= 3 and e["couverture_dimensions"] == "complète" and e["fiabilite"] in FIABLES


par_niveau = defaultdict(list)
for e in base:
    par_niveau[e["niveau_pertinence"]].append(e)
poids_total = sum(POIDS[e["niveau_pertinence"]] for e in base)
poids_doc = sum(POIDS[e["niveau_pertinence"]] for e in base if e["couverture_dimensions"] == "complète")
poids_fiable = sum(POIDS[e["niveau_pertinence"]] for e in base if e["couverture_dimensions"] == "complète" and e["fiabilite"] in FIABLES)
exploitables = [e for e in base if exploitable(e)]

synthese = {
    "version": "4.0-preparatoire",
    "observations": len(OBS), "observations_v3": V3["observations"], "nouvelles_observations": len(OBS) - V3["observations"],
    "observations_par_source": dict(sources_obs),
    "produits_independants": len(PROD), "produits_independants_utilisables": len(prod_util),
    "familles": len(FAMILLES), "sous_categories": len(base), "variantes_de_taille": len(variantes),
    "observations_1_dimension": dims.get(1, 0), "observations_2_dimensions": dims.get(2, 0), "observations_3_dimensions": dims.get(3, 0),
    "observations_utilisables_volume": len(utilisables),
    "sous_categories_prioritaires": len(prioritaires), "prioritaires_completes": len(prio_ok), "prioritaires_partielles": len(prio_partiel),
    "fiabilite_sous_categories": dict(fiab),
    "pertinence": {LIBELLES[n]: len(par_niveau[n]) for n in sorted(par_niveau)},
    "couverture_ponderee_documentee_pct": round(100 * poids_doc / poids_total, 1),
    "couverture_ponderee_fiable_pct": round(100 * poids_fiable / poids_total, 1),
    "references_exploitables_moteur_ia": len(exploitables),
    "correspondance_statuts": dict(corr_stat),
    "audit_dimensions": AUDIT,
}
json.dump(synthese, open(os.path.join(SORTIE, "synthese.json"), "w"), ensure_ascii=False, indent=1)

# --------------------------------------------------------------------------- tableau_bord.md
L = [
    "# Tableau de bord — catalogue Devis Scan v4 (préparatoire)", "",
    "Généré automatiquement par `scripts/catalogue_v4/rapports.py`. Données collectées les 25 et 26/11/2026.", "",
    "| Indicateur | v3 | v4 |", "| --- | ---: | ---: |",
    f"| Observations | {fr(V3['observations'])} | {fr(len(OBS))} |",
    f"| Modèles indépendants | {fr(V3['produits_independants'])} | {fr(len(PROD))} |",
    f"| dont utilisables pour les statistiques | {fr(V3['produits_independants_utilisables'])} | {fr(len(prod_util))} |",
    f"| Observations à 3 / 2 / 1 dimensions | {fr(V3['observations_3_dimensions'])} / {fr(V3['observations_2_dimensions'])} / {fr(V3['observations_1_dimension'])} | {fr(dims.get(3, 0))} / {fr(dims.get(2, 0))} / {fr(dims.get(1, 0))} |",
    f"| Observations utilisables pour un volume | {fr(V3['observations_utilisables_volume'])} | {fr(len(utilisables))} |",
    f"| Familles / sous-catégories / variantes | {V3['familles']} / {V3['sous_categories']} / {V3['variantes_de_taille']} | {len(FAMILLES)} / {len(base)} / {len(variantes)} |",
    f"| **Sous-catégories prioritaires à dimensions complètes** | {V3['sous_categories_prioritaires_documentees']} / {V3['sous_categories_prioritaires']} ({pc(V3['sous_categories_prioritaires_documentees'], V3['sous_categories_prioritaires'])}) | **{len(prio_ok)} / {len(prioritaires)} ({100 * len(prio_ok) / len(prioritaires):.1f} %)** |".replace(".", ","),
    f"| Sous-catégories prioritaires à dimensions partielles seulement | — | {len(prio_partiel)} |",
    f"| Fiabilité élevée / moyenne / faible / non vérifiée | {' / '.join(str(V3['fiabilite_sous_categories'].get(k, 0)) for k in ('élevée', 'moyenne', 'faible', 'non vérifiée'))} | {' / '.join(str(fiab.get(k, 0)) for k in ('élevée', 'moyenne', 'faible', 'non vérifiée'))} |",
    f"| Références exploitables par le moteur IA (pertinentes, complètes, fiabilité moyenne ou élevée) | — | {len(exploitables)} |",
    f"| Couverture métier pondérée (appréciation qualitative) — documentée | — | {synthese['couverture_ponderee_documentee_pct']} % |".replace(".", ","),
    f"| Couverture métier pondérée (appréciation qualitative) — fiable | — | {synthese['couverture_ponderee_fiable_pct']} % |".replace(".", ","),
    f"| Jeux de données | 7 | {len(sources_obs)} |",
    f"| Références historiques améliorées | {V3['correspondance_statuts'].get('améliorée', 0)} / 134 | {corr_stat.get('améliorée', 0)} / 134 |",
    "",
    f"Objectif de 80 % des sous-catégories prioritaires : **non atteint ({len(prio_ok)} / {len(prioritaires)})**. Il faudrait {max(0, -(-8 * len(prioritaires) // 10) - len(prio_ok))} sous-catégories de plus. Aucune donnée n'a été fabriquée pour s'en approcher. Détail et pistes : `rapport_pertinence.md`, `PROGRESSION.md`.",
]
open(os.path.join(SORTIE, "tableau_bord.md"), "w").write("\n".join(L) + "\n")

# --------------------------------------------------------------------------- rapport_pertinence.md
GROUPES = [
    ("Armoires et penderies", ["ARM-1P", "ARM-2P", "ARM-3P", "ARM-4P", "ARM-5P+", "ARM-COUL", "ARM-ANG", "ARM-NC", "ARM-BAS", "ARM-PORT", "ARM-DRESS", "ARM-TISSU"]),
    ("Canapés et fauteuils", ["CAN-2P", "CAN-3P", "CAN-4P", "CAN-5P", "CAN-ANG", "CAN-PANO", "CAN-CONV", "CAN-MOD", "CAN-RELAX", "CAN-MERID", "CAN-NC", "FAU-STD", "FAU-RELAX", "FAU-PIVOT", "FAU-BASCULE", "POU-STD", "FAU-POIRE"]),
    ("Lits et literie", ["LIT-SIMPLE", "LIT-DOUBLE", "LIT-QUEEN", "LIT-KING", "LIT-NC", "LIT-COFFRE", "LIT-SUPERP", "LIT-ESCAM", "LIT-TETE", "LIT-GIGOGNE", "LIT-BEBE", "LIT-ENFANT", "MAT-90", "MAT-140", "MAT-160", "MAT-180", "MAT-NC", "SOM-STD", "CHV-STD"]),
    ("Commodes et rangements", ["COM-3T", "COM-4T", "COM-5T", "COM-LARGE", "COM-NC", "COM-SEMAINIER", "COM-COIFF", "RAN-BUFFET", "RAN-BUFFET-HAUT", "RAN-VITRINE", "RAN-ANGLE", "ETA-NC", "ETA-METAL", "ETA-MURALE", "ETA-ECHELLE", "RAN-BIB-CUBE", "ENT-CHAUSS", "ENT-MEUBLE", "ENT-PORTEMANTEAU"]),
    ("Tables et chaises", ["TAB-4", "TAB-6", "TAB-8+", "TAB-REPAS-NC", "TAB-RONDE", "TAB-BASSE", "TAB-APPOINT", "TAB-CONSOLE", "TAB-HAUTE", "TAB-PLIANTE", "CHA-REPAS", "CHA-BAR", "CHA-TABOURET", "CHA-PLIANTE", "CHA-BANC"]),
    ("Bibliothèques", ["RAN-BIB-HAUTE", "RAN-BIB-BASSE", "RAN-BIB-NC", "RAN-BIB-FERMEE"]),
    ("Meubles TV et téléviseurs", ["RAN-MEUBLE-TV", "INF-TV-32", "INF-TV-43", "INF-TV-55", "INF-TV-75"]),
    ("Bureaux", ["BUR-DROIT", "BUR-ANGLE", "BUR-ASSIS", "FAU-BUR", "BUR-CLASSEUR", "BUR-CAISSON", "BUR-ENFANT", "INF-ORDI", "INF-IMPRIMANTE"]),
    ("Réfrigérateurs et congélateurs", ["ELM-REF", "ELM-REF-COMBI", "ELM-REF-US", "ELM-REF-1P", "ELM-REF-TOP", "ELM-REF-MULTI", "ELM-CONG", "ELM-CONG-COFFRE", "ELM-CAVE"]),
    ("Lave-linge et sèche-linge", ["ELM-LL", "ELM-SL", "ELM-LAVANTE-SECHANTE"]),
    ("Lave-vaisselle", ["ELM-LV"]),
    ("Fours et cuisinières", ["ELM-FOUR", "ELM-CUISINIERE", "ELM-MO"]),
    ("Mobilier de cuisine", ["CUI-BUFFET", "CUI-DESSERTE", "CUI-ILOT", "CUI-ETAGERE"]),
    ("Mobilier de salle de bain", ["SDB-VASQUE", "SDB-COLONNE", "SDB-ARMOIRE", "SDB-ETAGERE", "SDB-PANIER"]),
    ("Mobilier de jardin", ["JAR-TABLE", "JAR-CHAISE", "JAR-SALON", "JAR-TRANSAT", "JAR-BANC", "JAR-PARASOL", "JAR-BARBECUE", "JAR-ABRI", "JAR-JARDINIERE", "JAR-BALANCELLE", "JAR-TONDEUSE"]),
]
E = {e["identifiant"]: e for e in base}


def etat_txt(e):
    if e["couverture_dimensions"] == "complète":
        return f"{e['nb_modeles_independants']} modèles, {e['fiabilite']}"
    if e["couverture_dimensions"] == "partielle":
        p = e["dimensions_partielles"]
        morceaux = [f"{k} {cm(p.get(k + '_mediane_cm'))} cm" for k in ("hauteur", "largeur", "profondeur") if p.get(k + "_mediane_cm")]
        return f"partielle ({p['n']} modèles : {', '.join(morceaux)})"
    return "**aucune donnée**"


def part_collections(e):
    return "" if e["part_objets_de_collection_pct"] in (None, 0) else f" — {e['part_objets_de_collection_pct']} % de modèles de collection"


L = [
    "# Pertinence pour le déménagement et couverture métier — catalogue Devis Scan v4", "",
    "## Classement de pertinence", "",
    "Chaque famille et chaque sous-catégorie reçoit un niveau (colonnes `pertinence` et `niveau_pertinence`). **Aucune référence n'est supprimée.** Le moteur IA pourra privilégier les niveaux 1 et 2 dans la liste des candidats.", "",
    "| Niveau | Définition | Sous-catégories |", "| --- | --- | ---: |",
    f"| {LIBELLES[1]} | présent dans la plupart des logements | {len(par_niveau[1])} |",
    f"| {LIBELLES[2]} | fréquent sans être systématique (selon le logement, la famille, les loisirs) | {len(par_niveau[2])} |",
    f"| {LIBELLES[3]} | rare, volumineux ou à manutention particulière | {len(par_niveau[3])} |",
    f"| {LIBELLES[4]} | objet de collection, professionnel ou historique | {len(par_niveau[4])} |",
    "",
    "**Il s'agit d'une appréciation qualitative de Devis Scan, pas d'une statistique observée** : aucune donnée de fréquence réelle des objets dans les déménagements n'était disponible. Le classement est à recalibrer avec les inventaires des déménageurs pilotes (`scripts/catalogue_v4/pertinence.py`).", "",
    "### Par famille (niveau par défaut)", "",
    "| Famille | Niveau | Sous-catégories par niveau (1 / 2 / 3 / 4) |", "| --- | --- | --- |",
]
for fid, nom in FAMILLES:
    c = Counter(e["niveau_pertinence"] for e in base if e["famille_id"] == fid)
    L.append(f"| {fid} — {nom} | {LIBELLES[NIVEAUX_FAMILLES[fid]]} | {c.get(1, 0)} / {c.get(2, 0)} / {c.get(3, 0)} / {c.get(4, 0)} |")
L += ["", "## Couverture par niveau de pertinence", "",
      "| Niveau | Sous-catégories | Dimensions complètes | dont fiables (moyenne ou élevée) | Dimensions partielles seulement | Aucune donnée |",
      "| --- | ---: | ---: | ---: | ---: | ---: |"]
for n in (1, 2, 3, 4):
    l = par_niveau[n]
    comp = [e for e in l if e["couverture_dimensions"] == "complète"]
    L.append(f"| {LIBELLES[n]} | {len(l)} | {len(comp)} ({pc(len(comp), len(l))}) | {sum(e['fiabilite'] in FIABLES for e in comp)} ({pc(sum(e['fiabilite'] in FIABLES for e in comp), len(l))}) | {sum(e['couverture_dimensions'] == 'partielle' for e in l)} | {sum(e['couverture_dimensions'] == 'aucune' for e in l)} |")
L += [
    "",
    "## Indicateur de couverture métier pondéré (appréciation qualitative)", "",
    "Poids attribués par Devis Scan selon le niveau : courant 4, complémentaire 2, spécifique 1, peu pertinent 0. **Ce n'est pas une fréquence mesurée** : l'indicateur dit seulement que l'absence d'un objet courant pèse quatre fois plus que celle d'un objet exceptionnel.", "",
    f"- Couverture pondérée, sous-catégories à dimensions complètes : **{synthese['couverture_ponderee_documentee_pct']} %**".replace(".", ","),
    f"- Couverture pondérée, sous-catégories complètes et fiables : **{synthese['couverture_ponderee_fiable_pct']} %**".replace(".", ","),
    f"- Références réellement exploitables par le moteur IA (niveaux 1 à 3, dimensions complètes, ≥ 5 modèles et ≥ 2 sources indépendantes) : **{len(exploitables)}** sur {len(base)}, dont {sum(e['niveau_pertinence'] == 1 for e in exploitables)} courantes et {sum(e['niveau_pertinence'] == 2 for e in exploitables)} complémentaires.",
    "",
    "### Règle des objets anciens (v4)", "",
    "Pour ne pas compenser l'absence d'un objet courant par du mobilier ancien ou des objets de collection, **un objet de musée ou de Wikidata daté d'avant 1950 (ou non daté) n'entre plus dans les statistiques d'une sous-catégorie actuelle** (électroménager, literie, sièges, tables, rangements, etc.). Il reste dans la base, avec le motif « objet ancien : non représentatif ». Il continue de documenter le mobilier ancien (`ANC-*`), les sous-catégories de niveau 3 ou 4, et les objets dont la forme ne dépend pas de l'époque (tapis, horloges, pianos, miroirs, malles, coffres-forts…).",
    f"Conséquence : {sum(e['nb_observations_anciennes_exclues'] for e in base)} observations retirées des statistiques. Trois sous-catégories prioritaires que la v3 comptait comme documentées ne l'étaient que par des objets anciens et redeviennent non documentées : lit bébé (`LIT-BEBE`), lave-vaisselle (`ELM-LV`), établi (`BRI-ETABLI`). La cuisinière (`ELM-CUISINIERE`), dans le même cas, est désormais documentée par ENERGY STAR (95 modèles).",
    "",
    "## Objets courants : état par groupe", "",
]
for titre, ids in GROUPES:
    l = [E[i] for i in ids if i in E]
    comp = sum(e["couverture_dimensions"] == "complète" for e in l)
    L += [f"### {titre} — {comp} / {len(l)} sous-catégories à dimensions complètes", "",
          "| Sous-catégorie | Pertinence | État | Volume médian (m³) |", "| --- | --- | --- | ---: |"]
    for e in l:
        L.append(f"| `{e['identifiant']}` {e['nom']} | {e['pertinence'][:1]} | {etat_txt(e)}{part_collections(e)} | {m3(e['volume_geometrique_median_m3'])} |")
    L.append("")
manquantes = [e for e in prioritaires if e["couverture_dimensions"] != "complète"]
L += [
    f"## Sous-catégories prioritaires encore insuffisamment documentées : {len(manquantes)} sur {len(prioritaires)}", "",
    "| Sous-catégorie | Pertinence | État | Pourquoi |", "| --- | --- | --- | --- |",
]
POURQUOI = {
    "ELM": "aucune source ouverte accessible avec les 3 dimensions : ENERGY STAR ne publie pas la profondeur des réfrigérateurs ni la hauteur des lave-vaisselle ; EPREL les publie mais exige une clé",
    "INF": "ENERGY STAR ne publie que la diagonale des téléviseurs ; EPREL publie les dimensions (clé nécessaire) ; ABO n'a que quelques téléviseurs Eono",
}
for e in manquantes:
    raison = "pas de donnée réutilisable trouvée dans les sources accessibles"
    if e["identifiant"] in NON_MESURABLES:
        raison = "non mesurable par nature (volume propre à chaque objet)"
    elif e["identifiant"] == "ELM-LV":
        raison = "ENERGY STAR publie largeur et profondeur, pas la hauteur ; EPREL publie les 3 dimensions mais exige une clé"
    elif e["famille_id"] == "ELM":
        raison = "ENERGY STAR publie hauteur et largeur, pas la profondeur ; EPREL publie les 3 dimensions mais exige une clé"
    elif e["identifiant"].startswith("INF-TV"):
        raison = POURQUOI["INF"]
    elif e["nb_observations_anciennes_exclues"]:
        raison = "seuls des objets anciens existent dans les sources (exclus par la règle v4)"
    L.append(f"| `{e['identifiant']}` {e['nom']} | {e['pertinence'][:1]} | {etat_txt(e)} | {raison} |")
L += ["", f"Les deux sous-catégories non mesurables par nature (`DIV-AUTRE`, `CAR-SAC`) mises à part, la couverture serait de {len(prio_ok)} / {len(prioritaires) - 2} ({100 * len(prio_ok) / (len(prioritaires) - 2):.1f} %), toujours sous l'objectif.".replace(".", ",", 1)]
open(os.path.join(SORTIE, "rapport_pertinence.md"), "w").write("\n".join(L) + "\n")

# --------------------------------------------------------------------------- rapport_qualite.md (synthèse) et couverture
motifs = Counter(o["motif_exclusion"] or "— (utilisable)" for o in OBS)
fiab_obs = Counter(o["fiabilite_observation"] for o in OBS)
par_source_util = Counter((o["source"], o["utilisable_statistiques"]) for o in OBS)
L = [
    "# Rapport de qualité — catalogue Devis Scan v4 (préparatoire)", "",
    "Généré par `scripts/catalogue_v4/rapports.py`. L'audit des dimensions et des volumes est dans `rapport_audit_dimensions.md` ; le classement des objets reste contrôlé comme en v3 (≈ 94 % pour les fiches du commerce, ≈ 90 % pour les objets de musée).", "",
    "## Observations par source", "",
    "| Source | Observations | Utilisables | Licence | Niveau de droits |", "| --- | ---: | ---: | --- | --- |",
    *[f"| {NOMS_SOURCES[s][0]} | {fr(n)} | {fr(par_source_util[(s, 'oui')])} | {NOMS_SOURCES[s][1]} | {NOMS_SOURCES[s][2]} |" for s, n in sources_obs.most_common()],
    "",
    "## Complétude", "",
    "| Dimensions | Observations |", "| --- | ---: |", *[f"| {k} | {fr(dims.get(k, 0))} |" for k in (3, 2, 1)], "",
    "Nouveau en v4 : les fiches à 1 ou 2 dimensions plausibles d'une source autorisée alimentent des **médianes partielles** (champ `dimensions_partielles` de chaque référence), sans jamais être combinées en volume.", "",
    "## Fiabilité des observations", "", "| Fiabilité | Observations |", "| --- | ---: |", *[f"| {k} | {fr(v)} |" for k, v in fiab_obs.most_common()], "",
    "## Motifs d'exclusion des statistiques (observations conservées)", "", "| Motif | Observations |", "| --- | ---: |", *[f"| {k} | {fr(v)} |" for k, v in motifs.most_common()], "",
    "## Contrôles de classement propres à la v4", "",
    "- **ENERGY STAR** : classement déterministe par le type publié (« Bottom Freezer » → réfrigérateur combiné, « Side-by-Side » → réfrigérateur américain, « Compact Refrigerator » → table top, « Cooler » → cave à vin, « Range » → cuisinière). Les lavantes-séchantes, publiées aussi dans les listes de lave-linge et de sèche-linge, sont regroupées en un seul modèle classé « lave-linge séchant ».",
    "- **Matelas ABO** : de vrais matelas publiés sous d'autres types de produit sont désormais pris en compte. Contrôle manuel de toutes les fiches retenues : des draps-housses « 180 × 200 », des taies « King », des sommiers et un surmatelas avaient été pris par erreur lors d'un premier essai, puis exclus (le mot « matelas » est désormais exigé).",
    "- **Téléviseurs ABO** : 4 fiches où l'épaisseur était publiée comme hauteur ; axes réordonnés, valeurs d'origine conservées.",
    "- **Canapé en U** (Stone & Beam Andover) : les fiches sont reconnues, mais leurs dimensions (224 × 104 cm) ne correspondent pas au canapé annoncé (134 pouces, 340 cm) : exclues (hors bornes).",
]
open(os.path.join(SORTIE, "rapport_qualite.md"), "w").write("\n".join(L) + "\n")
L = [
    "# Rapport de couverture — catalogue Devis Scan v4 (préparatoire)", "",
    "| Identifiant | Nom | Pertinence | Couverture | Modèles | Sources indép. | Part collections | Volume médian (m³) | Fiabilité |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    *[f"| {e['identifiant']} | {e['nom']} | {e['pertinence'][:1]} | {e['couverture_dimensions']} | {e['nb_modeles_independants']} | {e['nb_sources_independantes']} | {'' if e['part_objets_de_collection_pct'] is None else str(e['part_objets_de_collection_pct']) + ' %'} | {m3(e['volume_geometrique_median_m3'])} | {e['fiabilite']} |" for e in ENT],
]
open(os.path.join(SORTIE, "rapport_couverture.md"), "w").write("\n".join(L) + "\n")
print(json.dumps({k: v for k, v in synthese.items() if k != "audit_dimensions"}, ensure_ascii=False, indent=1))
