"""
Audit des DIMENSIONS et des VOLUMES du catalogue v5 (distinct du contrôle du classement des objets).
Exporte les listes détaillées dans data/catalogue-v5/audit/ et rédige rapport_audit_dimensions.md.

Lancer après construire.py : python3 scripts/catalogue_v5/audit_dimensions.py
"""
from __future__ import annotations
import csv
import json
import math
import os
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.join(RACINE, "data", "catalogue-v5")
AUDIT = os.path.join(SORTIE, "audit")
os.makedirs(AUDIT, exist_ok=True)
etat = json.load(open(os.path.join(SORTIE, "cache", "etat_construction.json")))
v4 = json.load(open(os.path.join(RACINE, "data", "catalogue-v4", "cache", "audit_dimensions.json")))
OBS, PROD, ENT = etat["observations"], etat["produits"], etat["entrees"]
fr = lambda n: f"{n:,}".replace(",", " ")
pc = lambda a, b: f"{100 * a / b:.1f} %".replace(".", ",") if b else "—"
GROUPE = {"ABO": "commerce (ABO)", "ENERGYSTAR": "électroménager (ENERGY STAR)", "ITEMFITS": "documentaire (ItemFits)"}
grp = lambda o: GROUPE.get(o["source"], "musées et Wikidata")
COLS = ["id_observation", "source", "sous_categorie_id", "nom_commercial", "hauteur_cm", "largeur_cm", "profondeur_cm",
        "dimensions_v4_cm", "orientation", "correction_v5", "methode_verification", "confiance_correction", "motif_exclusion",
        "utilisable_statistiques", "url_source"]


def exporter(nom, lignes):
    with open(os.path.join(AUDIT, nom), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore", delimiter=";")
        w.writeheader()
        for o in lignes:
            w.writerow({k: ("" if o.get(k) is None else o.get(k)) for k in COLS})
    return len(lignes)


complets = [o for o in OBS if o["nb_dimensions"] == 3]
orient = Counter(o["orientation"].split(" (")[0] for o in complets)
ambigues = [o for o in OBS if o["orientation"].startswith("ambiguë")]
corrigees = [o for o in OBS if o.get("correction_v5")]
type_corr = Counter(("orientation" if o["correction_v5"].startswith("orientation") else "unité" if "unité" in o["correction_v5"] else "dimensions du nom") for o in corrigees)
unites = [o for o in OBS if "erreur d'unité probable" in o["commentaires"]]
discordants = [o for o in OBS if o["concordance_nom"] == "discordante"]
colis = [o for o in OBS if o["profil_colis"] == "oui"]
modulaires = [o for o in OBS if o["produit_modulaire"] == "oui"]
aberrants_ids = {pid for e in ENT if not e["variante_de"] for pid in e["produits_exclus"]}
aberrants = [o for o in OBS if o.get("id_produit") in aberrants_ids]
anciens = [o for o in OBS if o["motif_exclusion"].startswith("objet ancien")]
n = {
    "orientation_ambigue.csv": exporter("orientation_ambigue.csv", ambigues),
    "corrections.csv": exporter("corrections.csv", corrigees),
    "erreurs_unite.csv": exporter("erreurs_unite.csv", unites),
    "discordances_nom.csv": exporter("discordances_nom.csv", discordants),
    "profil_colis.csv": exporter("profil_colis.csv", colis),
    "produits_modulaires.csv": exporter("produits_modulaires.csv", modulaires),
    "modeles_aberrants.csv": exporter("modeles_aberrants.csv", aberrants),
}
# Volumes : recalcul et ordre statistique
ecarts = [o for o in complets if abs(o["hauteur_cm"] * o["largeur_cm"] * o["profondeur_cm"] / 1e6 - o["volume_geometrique_m3"]) > 0.0006]
ordre_ko = [e for e in ENT if e["volume_geometrique_median_m3"] is not None and not (e["volume_geometrique_min_m3"] <= e["volume_geometrique_q1_m3"] <= e["volume_geometrique_median_m3"] <= e["volume_geometrique_q3_m3"] <= e["volume_geometrique_max_m3"])]
P = {p["id_produit"]: p for p in PROD}
var_ko = sum(1 for e in ENT if e["variante_de"] for pid in e["produits_utilises"] if P.get(pid, {}).get("sous_categorie_id") != e["variante_de"])
resume = {
    "observations_3_dimensions": len(complets), "orientation": dict(orient), "ambigues": len(ambigues),
    "ambigues_utilisables": sum(o["utilisable_statistiques"] == "oui" for o in ambigues),
    "corrections": len(corrigees), "corrections_par_type": dict(type_corr),
    "erreurs_unite_v4": v4["erreurs_unite"], "erreurs_unite_v5": len(unites), "discordances_v4": v4["discordances_nom"], "discordances_v5": len(discordants),
    "colis_v4": v4["colis_possibles"], "colis_v5": len(colis), "modulaires": len(modulaires),
    "aberrants_v4": v4["modeles_aberrants_exclus"], "aberrants_v5": len(aberrants_ids), "objets_anciens_exclus": len(anciens),
    "ecarts_calcul_volume": len(ecarts), "ordre_statistiques_incoherent": len(ordre_ko), "variantes_produits_etrangers": var_ko,
}
json.dump(resume, open(os.path.join(SORTIE, "cache", "audit_dimensions.json"), "w"), ensure_ascii=False, indent=1)

ex = lambda l, k=6: [f"  - `{o['sous_categorie_id']}` {o['source']} — {o['nom_commercial'][:70]} : {o.get('dimensions_v4_cm') or ''}{' → ' if o.get('dimensions_v4_cm') else ''}{o['hauteur_cm']} × {o['largeur_cm']} × {o['profondeur_cm']} cm" for o in l[:k]]
par_g = lambda l: ", ".join(f"{k} : {fr(v)}" for k, v in Counter(grp(o) for o in l).most_common())
L = [
    "# Audit des dimensions et des volumes — catalogue Devis Scan v5", "",
    "Généré par `scripts/catalogue_v5/audit_dimensions.py`. Listes détaillées (une ligne par observation, valeurs d'origine et corrigées) dans `audit/`. **Cet audit porte sur les valeurs, pas sur le classement des objets.**", "",
    "## Règles de correction", "",
    "Aucune dimension n'est permutée parce qu'elle paraît inhabituelle. Une correction exige une information vérifiable de la même source ; elle conserve les dimensions d'origine (`dimensions_v4_cm`), le motif (`correction_v5`), la méthode (`methode_verification`), la source (`source_justificative`) et la confiance (`confiance_correction`). Sans certitude, l'observation est marquée **ambiguë** : elle reste dans la base et dans les statistiques de **volume** (qui ne dépendent pas de l'orientation), mais pas dans les **dimensions médianes**.", "",
    "| Méthode | Confiance | Corrections |", "| --- | --- | ---: |",
    f"| hauteur écrite dans le nom (« 36\"H », « 42 Inch Height ») ou ordre écrit (« L x W x H », « largo x ancho x alto ») | élevée | {type_corr.get('orientation', 0)} (dont 4 téléviseurs vérifiés par la diagonale) |",
    f"| dimensions du nom égales aux dimensions publiées × 10 ou × 2,54 | élevée | {type_corr.get('unité', 0)} |",
    f"| trois dimensions annoncées dans le nom, différentes de la fiche (colis ou saisie erronée) | moyenne | {type_corr.get('dimensions du nom', 0)} |",
    "",
    "Garde-fous ajoutés après le contrôle manuel : « High Gloss » n'est pas une hauteur ; une hauteur écrite incompatible avec la sous-catégorie (« meuble TV 59\"H ») est traitée comme une coquille (observation ambiguë, pas de correction) ; les tables extensibles (« 160-240 ») ne sont pas remplacées.", "",
    "## 1. Orientation (ordre hauteur / largeur / profondeur)", "",
    "Méthode v5 : rang de la hauteur (plus petite, intermédiaire ou plus grande des trois dimensions) comparé au rang dominant de la sous-catégorie (≥ 80 % des modèles, ≥ 5 modèles). Plus fiable que le rapport hauteur/largeur de la v4 : un tapis plus épais ou une armoire plus large ne sont plus signalés.", "",
    "| Statut (observations à 3 dimensions) | Observations |", "| --- | ---: |",
    *[f"| {k} | {fr(v)} |" for k, v in orient.most_common()],
    "",
    f"- **vérifiée** : hauteur étiquetée par la source (ENERGY STAR, MoMA, Wikidata P2048, musées avec lettres H/L/P) ou écrite dans le nom ; **conforme** : même forme que la majorité des modèles ; **non évaluable** : pas de forme dominante (tables d'appoint, cadres, objets carrés) ou dimensions incomplètes.",
    f"- **Ambiguës : {fr(len(ambigues))}** (dont {fr(resume['ambigues_utilisables'])} encore utilisées pour le volume), contre {fr(v4['orientation_suspecte'])} « orientations suspectes » en v4 (8,9 %) avec l'ancien critère — {par_g(ambigues)}.",
    *ex(ambigues),
    "- Contrôle manuel (voir § 7) : une ambiguïté n'est pas une erreur. Sur 35 fiches ambiguës relues, 3 seulement avaient une orientation réellement fausse ; les autres étaient des formes atypiques réelles (canapé à dossier haut, fauteuil bas, pouf haut). D'où le choix de ne rien permuter sans preuve.", "",
    "## 2. Unités", "",
    f"- Erreurs d'unité probables : {fr(v4['erreurs_unite'])} en v4 → **{fr(len(unites))}** en v5 ; {type_corr.get('unité', 0)} corrigées par le nom du produit (× 10, × 2,54), les autres conservées telles quelles et exclues — {par_g(unites)}.",
    "- Pour les musées, la plupart sont des objets hors normes (armoire de 3 m) ou des éléments isolés : le détecteur est une hypothèse, pas une preuve.", "",
    "## 3. Colis, dimensions intérieures, meubles à plat, produits modulaires", "",
    f"- Discordance entre la fiche et les dimensions du nom : {fr(v4['discordances_nom'])} en v4 → **{fr(len(discordants))}** en v5 (les fiches à trois dimensions dans le nom ont été corrigées, méthode C).",
    f"- **Profil de colis à plat** (dimension minimale < 15 cm et < 35 % de la sous-catégorie, volume < 40 %, sans dimensions annoncées dans le nom, lits exclus car les lits plateformes sont réellement bas) : **{fr(len(colis))}** fiches, **exclues des statistiques** et listées pour vérification (v4 : {fr(v4['colis_possibles'])} signalées, non exclues).",
    *ex(colis),
    f"- **Produits modulaires** (élément de canapé modulable, module) : **{fr(len(modulaires))}** fiches exclues (dimensions d'un module, pas du meuble).",
    "- **Dimensions intérieures** : non utilisées. ENERGY STAR publie la capacité intérieure (pieds cubes) dans un champ séparé, jamais pris pour une dimension ; les musées sont lus sur la mesure « overall » (hors tout) quand elle existe.",
    "- **Appareils encastrables** : signalés dans `commentaires` (ENERGY STAR « built-in »), dimensions de l'appareil seul, jamais celles du meuble qui l'accueille.", "",
    "## 4. Valeurs aberrantes", "",
    f"- Modèles écartés par la règle de Tukey (logarithme du volume, écart interquartile × 2, dès 8 modèles) : {fr(v4['modeles_aberrants_exclus'])} en v4 → **{fr(len(aberrants_ids))}** en v5 (`audit/modeles_aberrants.csv`). Ils restent listés dans `produits_exclus`.", "",
    "## 5. Volumes géométriques", "",
    f"- Recalcul H × L × P : **{len(ecarts)}** écart. Ordre min ≤ Q1 ≤ médiane ≤ Q3 ≤ max : **{len(ordre_ko)}** incohérence. Produits de variante étrangers à leur sous-catégorie : **{var_ko}**.",
    "- Les dimensions médianes sont calculées sur les seuls modèles d'orientation fiable (`nb_modeles_orientation_fiable`) ; le volume médian sur tous les modèles utilisables.", "",
    "## 6. Objets anciens", "",
    f"- {fr(len(anciens))} objets de musée exclus des statistiques des sous-catégories actuelles (règle v4 maintenue).", "",
    "## 7. Contrôle manuel (27/11/2026) — trois indicateurs distincts", "",
    "Échantillon de **100 observations** (graine 2711, `audit/echantillon_controle_manuel.tsv`), volontairement orienté vers les cas difficiles : 35 orientations ambiguës, 30 fiches corrigées, 35 observations utilisables de sous-catégories courantes. Chaque fiche a été relue à la main, deux fois : avant et après les garde-fous ci-dessus.", "",
    "| Indicateur | Avant garde-fous | Après garde-fous | Ce qu'il mesure |", "| --- | ---: | ---: | --- |",
    "| Classement correct de l'objet | 96 / 100 | 96 / 100 | la sous-catégorie attribuée correspond à l'objet (erreurs : lit avec tête de lit classé « tête de lit », « lamp table » classée lampe, table de jardin classée table de repas, tapisserie classée meuble ancien) |",
    "| Plausibilité des dimensions (valeurs et orientation enregistrées) | 92 / 100 | 96 / 100 | les trois dimensions, dans l'ordre enregistré, sont plausibles pour l'objet monté |",
    "| Fiabilité du volume géométrique | 98 / 100 | 98 / 100 | le produit H × L × P correspond au meuble monté (pas au colis) |",
    "| Corrections justes (sous-ensemble de 30 fiches corrigées) | 28 / 30 | 30 / 30 | « 69 cm High Gloss » lu comme une hauteur, coquille « 59\"H » : supprimées par les garde-fous |",
    "",
    "Erreurs restantes relevées : miroir mural « 16\" x 20\" » publié 55 × 64 × 31 cm (dimensions de carton probables, encore utilisées) ; fauteuil à oreilles profond de 96 cm pour 81 cm de large annoncés (doute) ; déshumidificateur à hauteur et profondeur inversées et étagère « Kairo » (marqués ambigus, exclus des dimensions médianes).", "",
    "Ces taux portent sur un échantillon **orienté vers les cas difficiles** : ils ne s'extrapolent pas à tout le catalogue (le contrôle aléatoire v4 donnait 87 / 90 dimensions plausibles). Ils ne mesurent pas le volume de déménagement.",
]
open(os.path.join(SORTIE, "rapport_audit_dimensions.md"), "w").write("\n".join(L) + "\n")
print(json.dumps(resume, ensure_ascii=False, indent=1))
