"""
Rapports du catalogue v2 (qualité, couverture, sources, architecture) et synthèse chiffrée.
Les chiffres sont recalculés à chaque exécution à partir de data/catalogue-v2/cache/etat_construction.json.

Lancer après construire.py : python3 scripts/catalogue_v2/rapports.py
"""
from __future__ import annotations
import json
import os
import statistics
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.join(RACINE, "data", "catalogue-v2")
etat = json.load(open(os.path.join(SORTIE, "cache", "etat_construction.json")))
OBS, PROD, ENT, CORR = etat["observations"], etat["produits"], etat["entrees"], etat["correspondance"]
import sys
sys.path.insert(0, ICI)
from taxonomie import FAMILLES, NOMS_FAMILLES, SOUS_CATEGORIES  # noqa: E402

fr = lambda n: f"{n:,}".replace(",", " ")
pc = lambda a, b: f"{100 * a / b:.0f} %" if b else "—"
m3 = lambda v: "—" if v in (None, "") else f"{v:.3f}".replace(".", ",")

base = [e for e in ENT if not e["variante_de"]]
variantes = [e for e in ENT if e["variante_de"]]
complets = [o for o in OBS if o["nb_dimensions"] == 3]
utilisables = [o for o in OBS if o["utilisable_statistiques"] == "oui"]
prod_util = [p for p in PROD if p["utilisable_statistiques"]]
fiab = Counter(e["fiabilite"] for e in base)
corr_stat = Counter(c["statut"] for c in CORR)
ameliorees = corr_stat.get("améliorée", 0)
sources_obs = Counter(o["source"] for o in OBS)

synthese = {
    "references_commerciales_collectees": len(OBS),
    "observations_par_source": dict(sources_obs),
    "produits_independants": len(PROD),
    "produits_independants_utilisables": len(prod_util),
    "sources_documentaires_distinctes_url": len({o["url_source"] for o in OBS}),
    "jeux_de_donnees": sorted(sources_obs),
    "familles": len(FAMILLES),
    "sous_categories": len(base),
    "variantes_de_taille": len(variantes),
    "references_trois_dimensions": len(complets),
    "references_utilisables_volume": len(utilisables),
    "fiabilite_sous_categories": dict(fiab),
    "anciennes_references_ameliorees": ameliorees,
    "anciennes_references_total": len(CORR),
    "correspondance_statuts": dict(corr_stat),
    "wikidata_sans_libelle": etat.get("wikidata_sans_libelle", 0),
}
json.dump(synthese, open(os.path.join(SORTIE, "synthese.json"), "w"), ensure_ascii=False, indent=1)

# --------------------------------------------------------------------------- rapport_qualite.md
motifs = Counter(o["motif_exclusion"] or "— (utilisable)" for o in OBS)
fiab_obs = Counter(o["fiabilite_observation"] for o in OBS)
completude = Counter(o["completude"] for o in OBS)
unites = sum("erreur d'unité" in o["commentaires"] for o in OBS)
regroup = Counter(o["statut_regroupement"] for o in OBS)
insuffisantes = [e for e in base if e["nb_modeles_independants"] < 5]
dispersees = sorted([e for e in base if e["dispersion_relative"] not in (None, "") and e["nb_modeles_independants"] >= 5], key=lambda e: -e["dispersion_relative"])[:15]
L = [
    "# Rapport de qualité — catalogue Devis Scan v2 (préparatoire)", "",
    f"Généré automatiquement par `scripts/catalogue_v2/rapports.py`. Données collectées le 25/11/2026.", "",
    "## Chiffres clés", "",
    "| Indicateur | Valeur |", "| --- | ---: |",
    f"| Observations (fiches produit collectées) | {fr(len(OBS))} |",
    f"| dont ABO (CC BY 4.0) | {fr(sources_obs.get('ABO', 0))} |",
    f"| dont Wikidata (CC0) | {fr(sources_obs.get('WIKIDATA', 0))} |",
    f"| dont ItemFits (documentaire, réutilisation incertaine) | {fr(sources_obs.get('ITEMFITS', 0))} |",
    f"| Produits physiques indépendants (après regroupement) | {fr(len(PROD))} |",
    f"| Produits utilisables pour les statistiques | {fr(len(prod_util))} |",
    f"| Observations avec 3 dimensions | {fr(len(complets))} ({pc(len(complets), len(OBS))}) |",
    f"| Observations utilisables pour une estimation de volume | {fr(len(utilisables))} ({pc(len(utilisables), len(OBS))}) |",
    f"| Familles | {len(FAMILLES)} |",
    f"| Sous-catégories physiques | {len(base)} |",
    f"| Variantes de taille calculées | {len(variantes)} |",
    "",
    "## Complétude des observations", "",
    "| Complétude | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in completude.most_common()],
    "",
    "## Fiabilité des observations", "",
    "- **élevée** : 3 dimensions plausibles, concordantes avec les dimensions écrites dans le nom du produit ;",
    "- **moyenne** : 3 dimensions plausibles, sans vérification possible par le nom ;",
    "- **faible** : 3 dimensions mais hors bornes, lot, discordance avec le nom, ou source documentaire ;",
    "- **non vérifiée** : dimensions incomplètes.", "",
    "| Fiabilité | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in fiab_obs.most_common()],
    "",
    "## Observations exclues des statistiques (conservées dans la base)", "",
    "| Motif | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in motifs.most_common()],
    "",
    f"Dont {fr(unites)} observations avec une **erreur d'unité probable** (par exemple des millimètres déclarés comme centimètres) : la valeur d'origine est conservée telle quelle, jamais corrigée, et exclue des statistiques.",
    "",
    "## Regroupement des fiches en produits physiques", "",
    "| Statut | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in regroup.most_common()],
    "",
    "Règles : une même fiche publiée dans plusieurs pays (même identifiant ASIN), une même marque et une même référence fabricant, ou une même marque avec une même sous-catégorie et des dimensions identiques au centimètre (variantes de couleur) forment un seul produit. Quand des fiches d'un même pays ainsi regroupées portent des noms différents, le statut « doublon potentiel » est affiché : le regroupement est conservé pour les statistiques (un seul modèle), toutes les fiches restent visibles.",
    "",
    "## Fiabilité des sous-catégories du catalogue normalisé", "",
    "- **élevée** : au moins 15 modèles indépendants, au moins 3 marques, dispersion (Q3 − Q1) / médiane ≤ 0,8 ;",
    "- **moyenne** : au moins 5 modèles et 2 marques ;",
    "- **faible** : 1 à 4 modèles (ou une seule marque) — volume provisoire, jamais une statistique représentative ;",
    "- **non vérifiée** : aucun modèle complet et plausible.", "",
    "| Fiabilité | Sous-catégories |", "| --- | ---: |",
    *[f"| {k} | {v} |" for k, v in fiab.most_common()],
    "",
    "Méthode : valeurs aberrantes exclues (avec justification) par la règle de Tukey sur le logarithme du volume (écart interquartile × 2) dès 8 modèles ; médiane, Q1, Q3, minimum, maximum calculés sur les modèles indépendants (pas sur le nombre de fiches). Jamais de moyenne.",
    "",
    "## Sous-catégories les plus dispersées (variantes à envisager)", "",
    "| Sous-catégorie | Modèles | Médiane (m³) | Q1–Q3 (m³) | Dispersion |", "| --- | ---: | ---: | --- | ---: |",
    *[f"| {e['identifiant']} — {e['nom']} | {e['nb_modeles_independants']} | {m3(e['volume_geometrique_median_m3'])} | {m3(e['volume_geometrique_q1_m3'])} – {m3(e['volume_geometrique_q3_m3'])} | {str(e['dispersion_relative']).replace('.', ',')} |" for e in dispersees],
    "",
    f"## Sous-catégories insuffisamment documentées (moins de 5 modèles) : {len(insuffisantes)} sur {len(base)}", "",
    "| Sous-catégorie | Famille | Modèles | Fiabilité |", "| --- | --- | ---: | --- |",
    *[f"| {e['identifiant']} — {e['nom']} | {e['famille']} | {e['nb_modeles_independants']} | {e['fiabilite']} |" for e in insuffisantes],
    "",
    "## Contrôle manuel du classement", "",
    "Deux tirages au sort de 60 observations utilisées dans les statistiques (graines 2026 et 77), vérifiées une à une le 25/11/2026 :",
    "",
    "| Tirage | Correctes | Erreurs |", "| --- | ---: | --- |",
    "| 1 | 57 / 60 | canapé-lit (daybed) classé canapé 3 places par une règle de largeur ; fauteuil de direction classé fauteuil pivotant ; mini-four classé petit électroménager |",
    "| 2 | 56 / 60 | deux séchoirs à linge classés étagère et portant ; un organiseur suspendu classé étagère ; une armoire classée meuble à chaussures |",
    "",
    "Précision estimée du classement : **113 / 120, soit environ 94 %** (intervalle de confiance à 95 % : environ 88 à 97 %). Les sept erreurs ont été corrigées dans les règles (`taxonomie.py`) avant la construction finale ; la règle qui classait un canapé d'après sa largeur a été supprimée (un classement fondé sur la dimension fausserait les statistiques de la sous-catégorie).",
    "",
    "## Limites connues", "",
    "- **Volume géométrique ≠ volume de déménagement** : les statistiques portent sur la boîte englobante du produit monté. Le passage au volume facturé (démontage, empilement, calage) n'est jamais calculé automatiquement ; voir `architecture_catalogue.md`.",
    "- **Largeur et profondeur** : ABO fournit « length » et « width » sans orientation garantie. Convention : largeur = plus grande dimension horizontale, profondeur = plus petite. Le volume n'en dépend pas.",
    "- **Dimensions déclarées par les vendeurs** : certaines fiches donnent les dimensions du colis ; elles sont repérées quand le nom du produit annonce d'autres dimensions (« discordante »), sinon elles restent possibles. Les bornes de plausibilité en écartent une partie.",
    "- **Marques** : ABO est dominé par les marques propres d'Amazon (Rivet, Stone & Beam, Ravenna Home, Movian, Solimo, AmazonBasics…). La diversité réelle des fabricants est donc faible ; voir `rapport_couverture.md`.",
    "- **Objets transportés démontés ou repliés** (lits, tables, parasols, abris, tentes, tapis) : un avertissement accompagne la sous-catégorie.",
]
open(os.path.join(SORTIE, "rapport_qualite.md"), "w").write("\n".join(L) + "\n")

# --------------------------------------------------------------------------- rapport_couverture.md
par_fam = defaultdict(lambda: [0, 0, 0, 0])
for e in base:
    f = par_fam[e["famille_id"]]
    f[0] += 1
    f[1] += e["nb_modeles_independants"]
    f[2] += e["nb_observations_documentaires"]
    f[3] += e["nb_modeles_independants"] >= 5
marques = Counter((o["marque"] or o["fabricant"] or "(non renseignée)") for o in OBS)
pays = Counter(o["pays"] or o["domaine"] or "—" for o in OBS)
L = [
    "# Rapport de couverture — catalogue Devis Scan v2 (préparatoire)", "",
    "Généré automatiquement. « Modèles » = produits physiques indépendants utilisables pour les statistiques.", "",
    "## Par famille", "",
    "| Famille | Sous-catégories | dont ≥ 5 modèles | Modèles | Observations |", "| --- | ---: | ---: | ---: | ---: |",
    *[f"| {fid} — {NOMS_FAMILLES[fid]} | {par_fam[fid][0]} | {par_fam[fid][3]} | {fr(par_fam[fid][1])} | {fr(par_fam[fid][2])} |" for fid, _ in FAMILLES],
    "",
    "## Par sous-catégorie", "",
    "| Identifiant | Nom | Modèles | Observations | Marques | Volume médian (m³) | Fiabilité |", "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    *[f"| {e['identifiant']} | {e['nom']} | {e['nb_modeles_independants']} | {e['nb_observations_documentaires']} | {e['nb_sources_independantes']} | {m3(e['volume_geometrique_median_m3'])} | {e['fiabilite']} |" for e in ENT],
    "",
    "## Par source", "",
    "| Source | Observations | Licence | Statut |", "| --- | ---: | --- | --- |",
    f"| ABO — Amazon Berkeley Objects | {fr(sources_obs.get('ABO', 0))} | CC BY 4.0 | réutilisation commerciale autorisée (attribution) |",
    f"| Wikidata | {fr(sources_obs.get('WIKIDATA', 0))} | CC0 | réutilisation commerciale autorisée |",
    f"| ItemFits Open Catalog | {fr(sources_obs.get('ITEMFITS', 0))} | conditions contradictoires | documentaire uniquement |",
    "",
    "## Marques et fabricants les plus représentés (30 premiers)", "",
    "| Marque / fabricant | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in marques.most_common(30)],
    "",
    f"Nombre total de marques ou fabricants distincts : {fr(len(marques))}.", "",
    "## Pays de publication des fiches", "",
    "| Pays | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in pays.most_common(25)],
    "",
    "## Domaines sous-représentés", "",
    "- **Gros électroménager** (réfrigérateurs, lave-linge, lave-vaisselle, fours, cuisinières, congélateurs) : quasiment absent d'ABO. Source recommandée : base européenne EPREL (dimensions hors tout obligatoires sur les fiches produit des appareils de froid), accessible avec une clé d'API publique gratuite à demander par Devis Scan (non utilisée sans votre accord).",
    "- **Téléviseurs, pianos, vélos, équipements sportifs lourds, mobilier de jardin, salle de bain, bureau professionnel, enfants** : peu ou pas de modèles.",
    "- **Mobilier ancien** : dépend de Wikidata (collections publiques) ; la récupération était ralentie par la limitation de débit de Wikidata au moment de la collecte.",
    "- **Marques françaises et européennes** (IKEA, Maisons du Monde, Conforama, BUT, etc.) : non collectées (voir `rapport_sources.md`).",
]
open(os.path.join(SORTIE, "rapport_couverture.md"), "w").write("\n".join(L) + "\n")
print(json.dumps(synthese, ensure_ascii=False, indent=1))
