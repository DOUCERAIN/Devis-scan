"""
Rapports du catalogue v3 (qualité, couverture, tableau de bord) et synthèse chiffrée.
Les chiffres sont recalculés à chaque exécution à partir de data/catalogue-v3/cache/etat_construction.json.
Les rapports rédigés à la main (sources, architecture, progression) citent ces chiffres : les relire après
chaque reconstruction.

Lancer après construire.py : python3 scripts/catalogue_v3/rapports.py
"""
from __future__ import annotations
import json
import os
import sys
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.join(RACINE, "data", "catalogue-v3")
etat = json.load(open(os.path.join(SORTIE, "cache", "etat_construction.json")))
OBS, PROD, ENT, CORR = etat["observations"], etat["produits"], etat["entrees"], etat["correspondance"]
V2 = json.load(open(os.path.join(RACINE, "data", "catalogue-v2", "synthese.json")))
sys.path.insert(0, ICI)
from taxonomie import FAMILLES, NOMS_FAMILLES  # noqa: E402

fr = lambda n: f"{n:,}".replace(",", " ")
pc = lambda a, b: f"{100 * a / b:.0f} %" if b else "—"
m3 = lambda v: "—" if v in (None, "") else f"{v:.3f}".replace(".", ",")

NOMS_SOURCES = {
    "ABO": ("Amazon Berkeley Objects (ABO)", "CC BY 4.0", "1 — réutilisable commercialement (attribution)"),
    "WIKIDATA": ("Wikidata", "CC0", "1 — réutilisable commercialement"),
    "MET": ("Metropolitan Museum of Art — Open Access", "CC0", "1 — réutilisable commercialement"),
    "MOMA": ("Museum of Modern Art — Collection", "CC0", "1 — réutilisable commercialement"),
    "CMA": ("Cleveland Museum of Art — Open Access", "CC0 (lignes CC0 seulement)", "1 — réutilisable commercialement"),
    "SMITHSONIAN": ("Smithsonian Open Access (dont Cooper Hewitt)", "CC0 (enregistrements CC0 seulement)", "1 — réutilisable commercialement"),
    "ITEMFITS": ("ItemFits Open Catalog", "conditions contradictoires", "2 — documentaire uniquement"),
}

base = [e for e in ENT if not e["variante_de"]]
variantes = [e for e in ENT if e["variante_de"]]
dims = Counter(o["nb_dimensions"] for o in OBS)
utilisables = [o for o in OBS if o["utilisable_statistiques"] == "oui"]
prod_util = [p for p in PROD if p["utilisable_statistiques"]]
fiab = Counter(e["fiabilite"] for e in base)
corr_stat = Counter(c["statut"] for c in CORR)
sources_obs = Counter(o["source"] for o in OBS)
droits = Counter(o["niveau_droits_libelle"] for o in OBS)
avec_modeles = [e for e in base if e["nb_modeles_independants"] > 0]
au_moins_3 = [e for e in base if e["nb_modeles_independants"] >= 3]
# Sous-catégories prioritaires : celles qui correspondent aux 134 références de l'ancien catalogue (objets
# réellement saisis dans les inventaires de déménagement).
prioritaires = [e for e in base if e["references_anciennes"]]
prio_completes = [e for e in prioritaires if e["nb_modeles_independants"] > 0]
sous_doc = [e for e in base if e["nb_modeles_independants"] < 3]
nouvelles_obs = len(OBS) - V2["references_commerciales_collectees"]
marques = Counter((o["marque"] or o["fabricant"] or "(non renseigné)") for o in OBS)

synthese = {
    "version": "3.0-preparatoire",
    "observations": len(OBS),
    "observations_v2": V2["references_commerciales_collectees"],
    "nouvelles_observations": nouvelles_obs,
    "observations_par_source": dict(sources_obs),
    "produits_independants": len(PROD),
    "produits_independants_utilisables": len(prod_util),
    "familles": len(FAMILLES),
    "sous_categories": len(base),
    "variantes_de_taille": len(variantes),
    "observations_1_dimension": dims.get(1, 0),
    "observations_2_dimensions": dims.get(2, 0),
    "observations_3_dimensions": dims.get(3, 0),
    "observations_utilisables_volume": len(utilisables),
    "sous_categories_avec_modeles": len(avec_modeles),
    "sous_categories_au_moins_3_modeles": len(au_moins_3),
    "sous_categories_prioritaires": len(prioritaires),
    "sous_categories_prioritaires_documentees": len(prio_completes),
    "fiabilite_sous_categories": dict(fiab),
    "niveaux_droits": dict(droits),
    "correspondance_statuts": dict(corr_stat),
    "jeux_de_donnees": len(sources_obs),
    "url_sources_distinctes": len({o["url_source"] for o in OBS}),
    "musees_ecartes": etat.get("musees_ecartes", {}),
}
json.dump(synthese, open(os.path.join(SORTIE, "synthese.json"), "w"), ensure_ascii=False, indent=1)

# --------------------------------------------------------------------------- tableau_bord.md
par_fam = defaultdict(lambda: Counter())
for e in base:
    f = par_fam[e["famille_id"]]
    f["sc"] += 1
    f["modeles"] += e["nb_modeles_independants"]
    f["obs"] += e["nb_observations_documentaires"]
    f["sc3"] += e["nb_modeles_independants"] >= 3
for e in variantes:
    par_fam[e["famille_id"]]["var"] += 1
L = [
    "# Tableau de bord — catalogue Devis Scan v3 (préparatoire)", "",
    "Généré automatiquement par `scripts/catalogue_v3/rapports.py` à chaque reconstruction. Données collectées le 25/11/2026.", "",
    "| Indicateur | v2 | v3 |", "| --- | ---: | ---: |",
    f"| Familles | {V2['familles']} | {len(FAMILLES)} |",
    f"| Sous-catégories physiques | {V2['sous_categories']} | {len(base)} |",
    f"| Variantes de taille | {V2['variantes_de_taille']} | {len(variantes)} |",
    f"| Observations | {fr(V2['references_commerciales_collectees'])} | {fr(len(OBS))} |",
    f"| Produits (modèles) indépendants | {fr(V2['produits_independants'])} | {fr(len(PROD))} |",
    f"| dont utilisables pour les statistiques | {fr(V2['produits_independants_utilisables'])} | {fr(len(prod_util))} |",
    f"| Observations à 3 dimensions | {fr(V2['references_trois_dimensions'])} | {fr(dims.get(3, 0))} |",
    f"| Observations à 2 dimensions | — | {fr(dims.get(2, 0))} |",
    f"| Observations à 1 dimension | — | {fr(dims.get(1, 0))} |",
    f"| Observations utilisables pour un volume | {fr(V2['references_utilisables_volume'])} | {fr(len(utilisables))} |",
    f"| Sous-catégories avec au moins 1 modèle | {V2['sous_categories'] - V2['fiabilite_sous_categories'].get('non vérifiée', 0)} | {len(avec_modeles)} |",
    f"| Sous-catégories avec au moins 3 modèles indépendants | — | {len(au_moins_3)} |",
    f"| Sous-catégories prioritaires (liées aux 134 références) documentées | — | {len(prio_completes)} / {len(prioritaires)} ({pc(len(prio_completes), len(prioritaires))}) |",
    f"| Jeux de données | 3 | {len(sources_obs)} |",
    f"| Licences compatibles (niveau 1) | 2 (CC BY 4.0, CC0) | 2 (CC BY 4.0, CC0) — {len(sources_obs) - ('ITEMFITS' in sources_obs)} jeux de données de niveau 1 |",
    f"| Sous-catégories sous-documentées (< 3 modèles) | — | {len(sous_doc)} |",
    "",
    "## Fiabilité des sous-catégories", "",
    "| Fiabilité | v2 | v3 |", "| --- | ---: | ---: |",
    *[f"| {k} | {V2['fiabilite_sous_categories'].get(k, 0)} | {fiab.get(k, 0)} |" for k in ("élevée", "moyenne", "faible", "non vérifiée")],
    "",
    "## Droits de réutilisation des observations", "",
    "| Niveau | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in sorted(droits.items())],
    "",
    "Aucune observation de niveau 2 ou 3 n'entre dans les statistiques du catalogue.", "",
    "## Par famille", "",
    "| Famille | Sous-catégories | dont ≥ 3 modèles | Variantes | Modèles | Observations |", "| --- | ---: | ---: | ---: | ---: | ---: |",
    *[f"| {fid} — {NOMS_FAMILLES[fid]} | {par_fam[fid]['sc']} | {par_fam[fid]['sc3']} | {par_fam[fid]['var']} | {fr(par_fam[fid]['modeles'])} | {fr(par_fam[fid]['obs'])} |" for fid, _ in FAMILLES],
]
open(os.path.join(SORTIE, "tableau_bord.md"), "w").write("\n".join(L) + "\n")

# --------------------------------------------------------------------------- rapport_qualite.md
motifs = Counter(o["motif_exclusion"] or "— (utilisable)" for o in OBS)
fiab_obs = Counter(o["fiabilite_observation"] for o in OBS)
unites = sum("erreur d'unité" in o["commentaires"] for o in OBS)
ordre = sum("ordre hauteur × largeur × profondeur supposé" in o["commentaires"] for o in OBS)
regroup = Counter(o["statut_regroupement"] for o in OBS)
dispersees = sorted([e for e in base if e["dispersion_relative"] not in (None, "") and e["nb_modeles_independants"] >= 5], key=lambda e: -e["dispersion_relative"])[:15]
ec = etat.get("musees_ecartes", {})
par_source_util = Counter((o["source"], o["utilisable_statistiques"]) for o in OBS)
L = [
    "# Rapport de qualité — catalogue Devis Scan v3 (préparatoire)", "",
    "Généré automatiquement par `scripts/catalogue_v3/rapports.py`. Données collectées le 25/11/2026.", "",
    "## Observations par source", "",
    "| Source | Observations | Utilisables | Licence | Niveau de droits |", "| --- | ---: | ---: | --- | --- |",
    *[f"| {NOMS_SOURCES[s][0]} | {fr(n)} | {fr(par_source_util[(s, 'oui')])} | {NOMS_SOURCES[s][1]} | {NOMS_SOURCES[s][2]} |" for s, n in sources_obs.most_common()],
    "",
    "## Complétude", "",
    "| Dimensions | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(dims.get(k, 0))} |" for k in (3, 2, 1)],
    "",
    "Les observations à une ou deux dimensions sont conservées telles quelles (jamais complétées) ; elles n'entrent pas dans les statistiques de volume.", "",
    "## Fiabilité des observations", "",
    "| Fiabilité | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in fiab_obs.most_common()],
    "",
    "## Observations exclues des statistiques (conservées)", "",
    "| Motif | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in motifs.most_common()],
    "",
    f"- {fr(unites)} observations avec une **erreur d'unité probable** : valeur d'origine conservée, jamais corrigée, exclue des statistiques.",
    f"- {fr(ordre)} observations de musée dont les dimensions sont écrites sans lettres (ex. « 89,5 × 59,7 × 50,8 cm ») : ordre hauteur × largeur × profondeur **supposé** (convention muséale), signalé dans `commentaires`. Le volume n'en dépend pas.",
    "",
    "## Objets de musée écartés à la lecture (non enregistrés comme observations)", "",
    "Les collections muséales contiennent des centaines de milliers d'objets ; seuls ceux qui correspondent à une sous-catégorie du catalogue sont retenus.", "",
    "| Motif | Objets |", "| --- | ---: |",
    f"| exclusions (maquettes, miniatures, jouets, fragments, éléments de meuble, gravures, photos, composants, enregistrements…) | {fr(ec.get('exclus', 0))} |",
    f"| aucune sous-catégorie correspondante | {fr(ec.get('non_classes', 0))} |",
    f"| nettement plus petits que la sous-catégorie (moins de 60 % de sa borne basse : miroir à main, lampe à huile…) | {fr(ec.get('taille', 0))} |",
    f"| aucune dimension lisible | {fr(ec.get('sans_dimension', 0))} |",
    "",
    "## Regroupement en produits physiques", "",
    "| Statut | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in regroup.most_common()],
    "",
    "Règles v2 inchangées (même identifiant, même marque + référence, même marque + mêmes dimensions). Ajout v3 : un même modèle de designer conservé par plusieurs musées (même auteur, même titre, dimensions à 5 cm près) forme un seul modèle.", "",
    "## Indépendance des modèles", "",
    "- produit du commerce : une **marque** = une source indépendante ;",
    "- objet de musée ou Wikidata : un **auteur connu** (ébéniste, designer, fabricant) = une source indépendante ; un objet d'auteur inconnu compte pour lui-même.",
    "",
    "## Fiabilité des sous-catégories", "",
    "Critères inchangés : **élevée** ≥ 15 modèles, ≥ 3 sources indépendantes, dispersion ≤ 0,8 ; **moyenne** ≥ 5 modèles et 2 sources ; **faible** 1 à 4 modèles ; **non vérifiée** aucun modèle.", "",
    "| Fiabilité | Sous-catégories |", "| --- | ---: |",
    *[f"| {k} | {v} |" for k, v in fiab.most_common()],
    "",
    "## Sous-catégories les plus dispersées", "",
    "| Sous-catégorie | Modèles | Médiane (m³) | Q1–Q3 (m³) | Dispersion |", "| --- | ---: | ---: | --- | ---: |",
    *[f"| {e['identifiant']} — {e['nom']} | {e['nb_modeles_independants']} | {m3(e['volume_geometrique_median_m3'])} | {m3(e['volume_geometrique_q1_m3'])} – {m3(e['volume_geometrique_q3_m3'])} | {str(e['dispersion_relative']).replace('.', ',')} |" for e in dispersees],
    "",
    "## Contrôle manuel du classement des objets de musée et Wikidata", "",
    "Deux tirages au sort de 60 observations utilisées dans les statistiques, vérifiés une à une le 25/11/2026 :", "",
    "| Tirage | Correctes | Erreurs relevées |", "| --- | ---: | --- |",
    "| 1 (graine 2026) | 53 / 60 | porte de climatiseur, lanterne de locomotive, mouvement d'horloge, cadrans d'horloge, cloche à vide, plateau de table seul, talkie-walkie |",
    "| 2 (graine 77, après correction du tirage 1) | 55 / 60 | « Arm chair » classé chaise au lieu de fauteuil, candélabre classé guéridon, jeu vidéo classé ordinateur, miroir concave scientifique, caisse de machine à écrire classée bac |",
    "",
    "Précision estimée : **108 / 120, soit environ 90 %** (intervalle de confiance à 95 % : environ 83 à 94 %), inférieure à celle des fiches commerciales v2 (94 %). Les erreurs relevées ont été corrigées dans les règles avant la construction finale. Les objets mal classés restants sont souvent petits et tombent hors des bornes de plausibilité ; ils sont alors exclus des statistiques.", "",
    "Classement des objets anciens (datés d'avant 1950 ou non datés) : un meuble est rangé en mobilier ancien (`ANC-*`) ; un instrument, une machine ou un appareil garde sa sous-catégorie d'usage (piano, machine à coudre, radio…). Conséquence : un fauteuil de designer de 1929 (ex. « Brno ») est classé fauteuil ancien.", "",
    "## Limites connues", "",
    "- **Volume géométrique ≠ volume de déménagement** (inchangé, voir `architecture_catalogue.md`).",
    "- **Biais des collections muséales** : objets anciens, de prestige ou de designer ; beaucoup de chaises, tables, horloges, radios, machines à écrire. Le champ `part_objets_de_collection_pct` de chaque référence indique la part de modèles issus de collections.",
    "- **Dimensions de musée** : hors tout quand le musée l'écrit (« overall »), sinon dimension principale ; ordre parfois supposé.",
    "- **Fiches commerciales** : toujours dominées par les marques propres d'Amazon (ABO) ; aucune marque française collectée (voir `rapport_sources.md`).",
]
open(os.path.join(SORTIE, "rapport_qualite.md"), "w").write("\n".join(L) + "\n")

# --------------------------------------------------------------------------- rapport_couverture.md
L = [
    "# Rapport de couverture — catalogue Devis Scan v3 (préparatoire)", "",
    "Généré automatiquement. « Modèles » = produits physiques indépendants utilisables pour les statistiques.", "",
    "## Par sous-catégorie", "",
    "| Identifiant | Nom | Modèles | Sources indép. | Part collections | Observations | Volume médian (m³) | Fiabilité |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    *[f"| {e['identifiant']} | {e['nom']} | {e['nb_modeles_independants']} | {e['nb_sources_independantes']} | {'' if e['part_objets_de_collection_pct'] is None else str(e['part_objets_de_collection_pct']) + ' %'} | {e['nb_observations_documentaires']} | {m3(e['volume_geometrique_median_m3'])} | {e['fiabilite']} |" for e in ENT],
    "",
    f"## Sous-catégories sous-documentées (moins de 3 modèles) : {len(sous_doc)} sur {len(base)}", "",
    "| Sous-catégorie | Famille | Modèles | Observations (toutes) |", "| --- | --- | ---: | ---: |",
    *[f"| {e['identifiant']} — {e['nom']} | {e['famille']} | {e['nb_modeles_independants']} | {e['nb_observations_documentaires']} |" for e in sous_doc],
    "",
    "## Auteurs, marques et fabricants les plus représentés (30 premiers)", "",
    "| Marque / fabricant | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in marques.most_common(30)],
    "",
    f"Nombre de marques ou fabricants distincts : {fr(len(marques))}.",
]
open(os.path.join(SORTIE, "rapport_couverture.md"), "w").write("\n".join(L) + "\n")
print(json.dumps(synthese, ensure_ascii=False, indent=1))
