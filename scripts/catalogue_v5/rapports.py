"""
Rapports générés du catalogue v5 : synthèse, tableau de bord, pertinence et couverture (deux dénominateurs),
dossier des sous-catégories prioritaires manquantes, mesurabilité et transport, qualité, couverture, correspondance.

Lancer après construire.py et audit_dimensions.py : python3 scripts/catalogue_v5/rapports.py
"""
from __future__ import annotations
import json
import math
import os
import sys
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.join(RACINE, "data", "catalogue-v5")
etat = json.load(open(os.path.join(SORTIE, "cache", "etat_construction.json")))
OBS, PROD, ENT, CORR = etat["observations"], etat["produits"], etat["entrees"], etat["correspondance"]
V4 = json.load(open(os.path.join(RACINE, "data", "catalogue-v4", "synthese.json")))
AUDIT = json.load(open(os.path.join(SORTIE, "cache", "audit_dimensions.json")))
sys.path.insert(0, ICI)
from taxonomie import FAMILLES, NOMS_FAMILLES  # noqa: E402
from pertinence import LIBELLES, NIVEAUX_FAMILLES, POIDS  # noqa: E402

fr = lambda n: f"{n:,}".replace(",", " ")
pc = lambda a, b: (f"{100 * a / b:.1f} %".replace(".", ",")) if b else "—"
m3 = lambda v: "—" if v in (None, "") else f"{v:.3f}".replace(".", ",")
cm = lambda v: "—" if v in (None, "") else f"{v:.0f}"
FIABLES = {"élevée", "moyenne"}
NOMS_SOURCES = {"ABO": ("Amazon Berkeley Objects", "CC BY 4.0", 1), "WIKIDATA": ("Wikidata", "CC0", 1), "MET": ("Metropolitan Museum of Art", "CC0", 1),
                "MOMA": ("Museum of Modern Art", "CC0", 1), "CMA": ("Cleveland Museum of Art", "CC0", 1), "SMITHSONIAN": ("Smithsonian Open Access", "CC0", 1),
                "ENERGYSTAR": ("ENERGY STAR (EPA)", "domaine public", 1), "ITEMFITS": ("ItemFits", "conditions contradictoires", 2), "EPREL": ("EPREL", "à confirmer", 3)}

base = [e for e in ENT if not e["variante_de"]]
variantes = [e for e in ENT if e["variante_de"]]
E = {e["identifiant"]: e for e in base}
prio = [e for e in base if e["references_anciennes"]]
complete = lambda e: e["couverture_dimensions"] == "complète"
prio_ok = [e for e in prio if complete(e)]
prio_mesurables = [e for e in prio if e["mesurabilite"] != "non directement mesurable"]
prio_mes_ok = [e for e in prio_mesurables if complete(e)]
documentees = [e for e in base if e["couverture_dimensions"] != "aucune"]
au_moins_3 = [e for e in base if e["nb_modeles_independants"] >= 3]
fiables = [e for e in base if complete(e) and e["fiabilite"] in FIABLES]
courantes = [e for e in base if e["niveau_pertinence"] == 1]
rares = [e for e in base if e["niveau_pertinence"] >= 3]
exploitables = [e for e in base if e["niveau_pertinence"] <= 3 and complete(e) and e["fiabilite"] in FIABLES and e["mesurabilite"] != "non directement mesurable"]
dims = Counter(o["nb_dimensions"] for o in OBS)
sources_obs = Counter(o["source"] for o in OBS)
fiab = Counter(e["fiabilite"] for e in base)
v4_fiables = {e["identifiant"] for e in json.load(open(os.path.join(RACINE, "data", "catalogue-v4", "cache", "etat_construction.json")))["entrees"]
              if not e["variante_de"] and e["couverture_dimensions"] == "complète" and e["fiabilite"] in FIABLES}
nouvelles_fiables = [e for e in fiables if e["identifiant"] not in v4_fiables]
poids_total = sum(POIDS[e["niveau_pertinence"]] for e in base)
couv_pond = round(100 * sum(POIDS[e["niveau_pertinence"]] for e in base if complete(e)) / poids_total, 1)
couv_pond_f = round(100 * sum(POIDS[e["niveau_pertinence"]] for e in fiables) / poids_total, 1)
corr_stat = Counter(c["statut"] for c in CORR)

synthese = {
    "version": "5.0-preparatoire", "observations": len(OBS), "nouvelles_observations_vs_v4": len(OBS) - V4["observations"],
    "observations_par_source": dict(sources_obs), "produits_independants": len(PROD),
    "produits_independants_utilisables": sum(1 for p in PROD if p["utilisable_statistiques"]),
    "familles": len(FAMILLES), "sous_categories": len(base), "variantes_de_taille": len(variantes),
    "observations_utilisables_volume": sum(o["utilisable_statistiques"] == "oui" for o in OBS),
    "prioritaires": len(prio), "prioritaires_completes": len(prio_ok), "prioritaires_mesurables": len(prio_mesurables), "prioritaires_mesurables_completes": len(prio_mes_ok),
    "sous_categories_documentees": len(documentees), "sous_categories_3_dimensions": sum(complete(e) for e in base),
    "sous_categories_3_modeles": len(au_moins_3), "sous_categories_fiables": len(fiables),
    "courantes_completes": sum(complete(e) for e in courantes), "courantes": len(courantes),
    "rares_completes": sum(complete(e) for e in rares), "rares": len(rares),
    "couverture_ponderee_qualitative_pct": couv_pond, "couverture_ponderee_qualitative_fiable_pct": couv_pond_f,
    "references_exploitables_moteur_ia": len(exploitables), "nouvelles_sous_categories_fiables": [e["identifiant"] for e in nouvelles_fiables],
    "fiabilite": dict(fiab), "correspondance_statuts": dict(corr_stat), "audit": AUDIT,
}
json.dump(synthese, open(os.path.join(SORTIE, "synthese.json"), "w"), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ tableau de bord
L = [
    "# Tableau de bord — catalogue Devis Scan v5 (préparatoire)", "",
    "Généré par `scripts/catalogue_v5/rapports.py`. Aucune nouvelle collecte en v5 : consolidation des données v2 à v4.", "",
    "| Indicateur | v4 | v5 |", "| --- | ---: | ---: |",
    f"| Observations | {fr(V4['observations'])} | {fr(len(OBS))} |",
    f"| Modèles indépendants (utilisables) | {fr(V4['produits_independants'])} ({fr(V4['produits_independants_utilisables'])}) | {fr(len(PROD))} ({fr(synthese['produits_independants_utilisables'])}) |",
    f"| Observations utilisables pour un volume | {fr(V4['observations_utilisables_volume'])} | {fr(synthese['observations_utilisables_volume'])} |",
    f"| **Prioritaires à 3 dimensions — dénominateur historique** | {V4['prioritaires_completes']} / 171 ({pc(V4['prioritaires_completes'], 171)}) | **{len(prio_ok)} / {len(prio)} ({pc(len(prio_ok), len(prio))})** |",
    f"| **Prioritaires à 3 dimensions — sous-catégories mesurables** | — | **{len(prio_mes_ok)} / {len(prio_mesurables)} ({pc(len(prio_mes_ok), len(prio_mesurables))})** |",
    f"| 1. Sous-catégories documentées (au moins une dimension) | — | {len(documentees)} / {len(base)} |",
    f"| 2. Sous-catégories à 3 dimensions complètes | — | {synthese['sous_categories_3_dimensions']} / {len(base)} |",
    f"| 3. Sous-catégories avec au moins 3 modèles indépendants | — | {len(au_moins_3)} |",
    f"| 4. Sous-catégories statistiquement fiables (moyenne ou élevée) | {V4['fiabilite_sous_categories'].get('élevée', 0) + V4['fiabilite_sous_categories'].get('moyenne', 0)} | {len(fiables)} |",
    f"| 5. Couverture des catégories courantes (3 dimensions) | — | {synthese['courantes_completes']} / {len(courantes)} ({pc(synthese['courantes_completes'], len(courantes))}) |",
    f"| 6. Couverture globale (3 dimensions) | — | {synthese['sous_categories_3_dimensions']} / {len(base)} ({pc(synthese['sous_categories_3_dimensions'], len(base))}) |",
    f"| Catégories spécifiques et peu pertinentes (3 dimensions) | — | {synthese['rares_completes']} / {len(rares)} ({pc(synthese['rares_completes'], len(rares))}) |",
    f"| Références exploitables par le moteur IA | {V4['references_exploitables_moteur_ia']} | {len(exploitables)} |",
    f"| Corrections de dimensions justifiées | — | {AUDIT['corrections']} |",
    f"| Orientations ambiguës (exclues des dimensions médianes) | 1 652 « suspectes » | {fr(AUDIT['ambigues'])} |",
    f"| Indicateur pondéré par la pertinence (appréciation qualitative, pas une fréquence) | {V4['couverture_ponderee_documentee_pct']} % | {couv_pond} % |".replace(".", ","),
    "",
    f"Objectif de 80 % : **non atteint** — {len(prio_ok)} / 171 sur le dénominateur historique (il en faudrait 137), {len(prio_mes_ok)} / {len(prio_mesurables)} sur les sous-catégories mesurables (il en faudrait {math.ceil(0.8 * len(prio_mesurables))}). Les exclusions du second dénominateur sont justifiées dans `rapport_pertinence.md`. Aucune donnée n'a été fabriquée.",
]
open(os.path.join(SORTIE, "tableau_bord.md"), "w").write("\n".join(L) + "\n")

# ------------------------------------------------------------------ dossier des sous-catégories manquantes
obs_sc = defaultdict(list)
for o in OBS:
    obs_sc[o["sous_categorie_id"]].append(o)
PISTES = {
    "ELM": "EPREL (dimensions hors tout des appareils vendus en Europe) — clé à demander par Devis Scan",
    "INF-TV": "aucune source publique connue : EPREL et ENERGY STAR ne publient que la diagonale ; relevés des déménageurs",
}


def manque(e):
    p = e["dimensions_partielles"]
    if complete(e):
        return "—"
    if p.get("n"):
        return ", ".join(k for k in ("hauteur", "largeur", "profondeur") if not p.get(k + "_mediane_cm"))
    return "hauteur, largeur, profondeur"


manquantes = [e for e in prio if not complete(e)]
L = [
    "# Dossier des sous-catégories prioritaires sans trois dimensions — catalogue v5", "",
    f"{len(manquantes)} sous-catégories sur 171. Pour chacune : dimensions manquantes, données déjà présentes (toutes sources, y compris exclues), motif d'exclusion principal, sources explorées et piste. Sources explorées pour toutes : ABO (recherche ciblée par mots-clés dans 147 702 fiches), Wikidata, Met, MoMA, Cleveland, Smithsonian, ENERGY STAR (tous les jeux du catalogue), Zenodo (recherche par mots-clés), EPREL (étude, clé requise).", "",
    "| Sous-catégorie | Pertinence | Mesurabilité | Dimensions manquantes | Observations (sources) | Motif d'exclusion principal | Piste |",
    "| --- | --- | --- | --- | --- | --- | --- |",
]
for e in manquantes:
    l = obs_sc[e["identifiant"]]
    srcs = ", ".join(f"{k} {v}" for k, v in Counter(o["source"] for o in l).most_common()) or "aucune"
    motif = Counter(o["motif_exclusion"][:55] for o in l if o["motif_exclusion"]).most_common(1)
    piste = PISTES["ELM"] if e["famille_id"] == "ELM" else PISTES["INF-TV"] if e["identifiant"].startswith("INF-TV") else (
        "non mesurable par nature" if e["mesurabilite"] == "non directement mesurable" else "relevés des déménageurs pilotes ; fiches fabricants avec autorisation")
    L.append(f"| `{e['identifiant']}` {e['nom']} | {e['niveau_pertinence']} | {e['mesurabilite']} | {manque(e)} | {len(l)} ({srcs}) | {motif[0][0] if motif else '—'} | {piste} |")
L += ["", "Constat : pour 37 des 39 sous-catégories, aucune source publique accessible et réutilisable ne publie trois dimensions réelles de modèles actuels. Les données présentes sont des accessoires mal nommés (sacs de congélation pour « congélateur », étendoirs pour « sèche-linge »), des objets anciens exclus, ou des fiches à deux dimensions (ENERGY STAR)."]
open(os.path.join(SORTIE, "rapport_sous_categories_manquantes.md"), "w").write("\n".join(L) + "\n")

# ------------------------------------------------------------------ pertinence et couverture
par_niv = defaultdict(list)
for e in base:
    par_niv[e["niveau_pertinence"]].append(e)
exclus_mes = [e for e in prio if e["mesurabilite"] == "non directement mesurable"]
L = [
    "# Pertinence et couverture métier — catalogue Devis Scan v5", "",
    "Les quatre niveaux de la v4 sont conservés (`scripts/catalogue_v5/pertinence.py`) : 1 courant, 2 complémentaire, 3 spécifique ou exceptionnel, 4 peu pertinent. **Appréciation qualitative de Devis Scan, pas une fréquence observée.**", "",
    "## Indicateurs demandés", "",
    "| # | Indicateur | Valeur |", "| --- | --- | ---: |",
    f"| 1 | Sous-catégories documentées (au moins une dimension plausible) | {len(documentees)} / {len(base)} |",
    f"| 2 | Sous-catégories à trois dimensions complètes | {synthese['sous_categories_3_dimensions']} / {len(base)} |",
    f"| 3 | Sous-catégories avec au moins trois modèles indépendants | {len(au_moins_3)} |",
    f"| 4 | Sous-catégories statistiquement fiables (≥ 5 modèles, ≥ 2 sources indépendantes) | {len(fiables)} |",
    f"| 5 | Couverture des catégories courantes (niveau 1) | {synthese['courantes_completes']} / {len(courantes)} ({pc(synthese['courantes_completes'], len(courantes))}) ; fiables : {sum(e in fiables for e in courantes)} |",
    f"| 6 | Couverture globale | {synthese['sous_categories_3_dimensions']} / {len(base)} ({pc(synthese['sous_categories_3_dimensions'], len(base))}) |",
    f"| 7 | Catégories encore insuffisamment documentées (moins de 3 modèles) | {len(base) - len(au_moins_3)} (liste dans `rapport_couverture.md`) |",
    "",
    "## Couverture des sous-catégories prioritaires : deux dénominateurs", "",
    f"- **Dénominateur historique (171, jamais modifié)** : {len(prio_ok)} / 171 = **{pc(len(prio_ok), 171)}**.",
    f"- **Sous-catégories prioritaires mesurables** : {len(prio_mes_ok)} / {len(prio_mesurables)} = **{pc(len(prio_mes_ok), len(prio_mesurables))}**. Exclues de ce second dénominateur, et seulement elles :",
    *[f"  - `{e['identifiant']}` {e['nom']} : {e['mesurabilite_justification']}" for e in exclus_mes],
    "- Les sous-catégories à **méthode spécifique** (tapis roulés, lits démontés, parasols, abris…) restent dans les deux dénominateurs : elles ont une boîte englobante réelle ; seule leur conversion en volume de transport diffère.", "",
    "## Couverture par niveau", "",
    "| Niveau | Sous-catégories | 3 dimensions | Fiables | Partielles | Aucune donnée |", "| --- | ---: | ---: | ---: | ---: | ---: |",
    *[f"| {LIBELLES[n]} | {len(par_niv[n])} | {sum(complete(e) for e in par_niv[n])} ({pc(sum(complete(e) for e in par_niv[n]), len(par_niv[n]))}) | {sum(e in fiables for e in par_niv[n])} | {sum(e['couverture_dimensions'] == 'partielle' for e in par_niv[n])} | {sum(e['couverture_dimensions'] == 'aucune' for e in par_niv[n])} |" for n in (1, 2, 3, 4)],
    "",
    "Les objets de musée et les équipements rares ne masquent pas les manques : ils n'entrent pas dans les statistiques des sous-catégories actuelles (règle des objets anciens), et la couverture est publiée niveau par niveau. L'indicateur pondéré (poids 4 / 2 / 1 / 0) vaut " + f"{couv_pond} %".replace(".", ",") + " ; c'est une appréciation, jamais une statistique.", "",
    "## Catégories courantes encore insuffisantes", "",
    "| Sous-catégorie | État | Modèles |", "| --- | --- | ---: |",
    *[f"| `{e['identifiant']}` {e['nom']} | {e['couverture_dimensions']}, fiabilité {e['fiabilite']} | {e['nb_modeles_independants']} |" for e in courantes if not (complete(e) and e['fiabilite'] in FIABLES)],
    "",
    "## Mesurabilité et transport", "",
    f"- Mesurables : {sum(e['mesurabilite'] == 'mesurable' for e in base)} ; méthode spécifique : {sum(e['mesurabilite'] == 'méthode spécifique' for e in base)} ; non directement mesurables : {sum(e['mesurabilite'] == 'non directement mesurable' for e in base)}.",
    f"- Démontables ou pliables : {sum(e['demontable_ou_pliable'] == 'oui' for e in base)} ; empilables : {sum(e['empilable'] == 'oui' for e in base)}. Champs `volume_transport_peut_differer`, `facteur_conversion_demenagement` (vide) et `convention_volume_demenagement` (« non définie ») : voir `architecture_catalogue.md`.",
]
open(os.path.join(SORTIE, "rapport_pertinence.md"), "w").write("\n".join(L) + "\n")

# ------------------------------------------------------------------ qualité, couverture, correspondance
motifs = Counter(o["motif_exclusion"] or "— (utilisable)" for o in OBS)
L = [
    "# Rapport de qualité — catalogue Devis Scan v5 (préparatoire)", "",
    "Trois indicateurs distincts, jamais confondus : **classement** des objets, **plausibilité des dimensions**, **fiabilité des volumes** (détail et contrôle manuel : `rapport_audit_dimensions.md`).", "",
    "## Observations par source", "", "| Source | Observations | Utilisables | Licence | Niveau de droits |", "| --- | ---: | ---: | --- | ---: |",
    *[f"| {NOMS_SOURCES[s][0]} | {fr(n)} | {fr(sum(o['source'] == s and o['utilisable_statistiques'] == 'oui' for o in OBS))} | {NOMS_SOURCES[s][1]} | {NOMS_SOURCES[s][2]} |" for s, n in sources_obs.most_common()],
    "", "## Complétude", "", "| Dimensions | Observations |", "| --- | ---: |", *[f"| {k} | {fr(dims.get(k, 0))} |" for k in (3, 2, 1)],
    "", "## Motifs d'exclusion des statistiques (observations conservées)", "", "| Motif | Observations |", "| --- | ---: |", *[f"| {k} | {fr(v)} |" for k, v in motifs.most_common()],
    "", "## Statistiques conservées par sous-catégorie", "",
    "Nombre de modèles indépendants, d'observations, de sources documentaires (adresses distinctes) et de sources indépendantes (marques ou auteurs), dimensions médianes (modèles d'orientation fiable seulement, `nb_modeles_orientation_fiable`), volume géométrique médian, Q1, Q3, minimum, maximum, dispersion, fiabilité. La médiane reste la référence ; un même modèle publié sur plusieurs sites ne compte qu'une fois ; une sous-catégorie à une seule référence garde une fiabilité faible.",
]
open(os.path.join(SORTIE, "rapport_qualite.md"), "w").write("\n".join(L) + "\n")
L = ["# Rapport de couverture — catalogue Devis Scan v5 (préparatoire)", "",
     "| Identifiant | Nom | Pertinence | Mesurabilité | Couverture | Modèles | dont orientation fiable | Sources indép. | Volume médian (m³) | Q1–Q3 (m³) | Fiabilité |",
     "| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
     *[f"| {e['identifiant']} | {e['nom']} | {e['niveau_pertinence']} | {e['mesurabilite']} | {e['couverture_dimensions']} | {e['nb_modeles_independants']} | {e['nb_modeles_orientation_fiable']} | {e['nb_sources_independantes']} | {m3(e['volume_geometrique_median_m3'])} | {m3(e['volume_geometrique_q1_m3'])} – {m3(e['volume_geometrique_q3_m3'])} | {e['fiabilite']} |" for e in ENT]]
open(os.path.join(SORTIE, "rapport_couverture.md"), "w").write("\n".join(L) + "\n")
L = ["# Correspondance avec les 134 références historiques — catalogue v5", "",
     "Les 134 identifiants de `public.furniture_catalog` ne sont ni modifiés ni supprimés ; chacun pointe vers une référence normalisée principale (fichier `correspondance_catalogue_existant.csv`).", "",
     "| Statut | Références |", "| --- | ---: |", *[f"| {k} | {v} |" for k, v in corr_stat.most_common()], "",
     "| Référence historique | Référence normalisée principale | Modèles v5 | Volume géométrique médian (m³) | Fiabilité | Statut |", "| --- | --- | ---: | ---: | --- | --- |",
     *[f"| `{c['id_existant']}` {c['nom_existant']} | {c['reference_normalisee_principale'] or '—'} | {c['nb_modeles_independants_nouveaux']} | {m3(c['volume_geometrique_median_nouveau_m3'])} | {c['fiabilite_nouvelle']} | {c['statut']} |" for c in CORR]]
open(os.path.join(SORTIE, "rapport_correspondance.md"), "w").write("\n".join(L) + "\n")
print(json.dumps({k: v for k, v in synthese.items() if k != "audit"}, ensure_ascii=False, indent=1))
