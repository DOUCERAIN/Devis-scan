"""
Audit des DIMENSIONS et des VOLUMES du catalogue v4 (distinct du contrôle du classement des objets).

Contrôles automatiques sur toutes les observations à 3 dimensions et sur les références normalisées :
  1. cohérence hauteur / largeur / profondeur (orientation suspecte par rapport aux autres modèles de la sous-catégorie) ;
  2. erreurs d'unité probables (déjà repérées à la construction) et valeurs proportionnelles à 2,54 ou 10 ;
  3. dimensions de colis possibles (dimension très plate et volume très inférieur à la sous-catégorie) ;
  4. valeurs aberrantes (règle de Tukey sur le logarithme du volume) ;
  5. cohérence des volumes calculés (H × L × P, ordre min ≤ Q1 ≤ médiane ≤ Q3 ≤ max) ;
  6. cohérence des variantes de taille (bornes, ordre, appartenance).
Produit aussi un échantillon tiré au sort pour le contrôle manuel (data/catalogue-v4/cache/echantillon_audit.txt).

Lancer après construire.py : python3 scripts/catalogue_v4/audit_dimensions.py
"""
from __future__ import annotations
import json
import math
import os
import random
import statistics
from collections import Counter, defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
SORTIE = os.path.join(RACINE, "data", "catalogue-v4")
etat = json.load(open(os.path.join(SORTIE, "cache", "etat_construction.json")))
OBS, PROD, ENT = etat["observations"], etat["produits"], etat["entrees"]
fr = lambda n: f"{n:,}".replace(",", " ")
pc = lambda a, b: f"{100 * a / b:.1f} %".replace(".", ",") if b else "—"
GROUPE = {"ABO": "commerce (ABO)", "ENERGYSTAR": "électroménager (ENERGY STAR)", "WIKIDATA": "musées et Wikidata",
          "MET": "musées et Wikidata", "MOMA": "musées et Wikidata", "CMA": "musées et Wikidata", "SMITHSONIAN": "musées et Wikidata",
          "ITEMFITS": "documentaire (ItemFits)"}

complets = [o for o in OBS if o["nb_dimensions"] == 3]
utiles = [o for o in complets if o["utilisable_statistiques"] == "oui"]
par_sc = defaultdict(list)
for o in utiles:
    par_sc[o["sous_categorie_id"]].append(o)
ref_sc = {}
for sc, l in par_sc.items():
    if len(l) >= 5:
        ref_sc[sc] = {
            "ratio_h": statistics.median(o["hauteur_cm"] / o["largeur_cm"] for o in l),
            "min": statistics.median(min(o["hauteur_cm"], o["profondeur_cm"]) for o in l),
            "vol": statistics.median(o["volume_geometrique_m3"] for o in l),
        }

# 1. Orientation suspecte (hauteur / largeur à plus d'un facteur 3 de la médiane de la sous-catégorie)
orientation = []
for o in complets:
    r = ref_sc.get(o["sous_categorie_id"])
    if r and o["largeur_cm"] and o["hauteur_cm"] and abs(math.log((o["hauteur_cm"] / o["largeur_cm"]) / r["ratio_h"])) > math.log(3):
        orientation.append(o)
# 2. Unités
unites = [o for o in OBS if "erreur d'unité" in o["commentaires"]]
# 3. Colis possibles (meubles du commerce)
MEUBLES = {"ARM", "CAN", "FAU", "LIT", "COM", "TAB", "CHA", "RAN", "ETA", "ENT", "CUI", "BUR", "SDB", "JAR", "CHV", "ENF"}
colis = []
for o in complets:
    r = ref_sc.get(o["sous_categorie_id"])
    if o["source"] == "ABO" and o["famille_id"] in MEUBLES and r and o["volume_geometrique_m3"]:
        if min(o["hauteur_cm"], o["profondeur_cm"]) < 0.35 * r["min"] and o["volume_geometrique_m3"] < 0.4 * r["vol"]:
            colis.append(o)
discordants = [o for o in OBS if o["concordance_nom"] == "discordante"]
# 4. Aberrants (Tukey) : produits exclus des références
aberrants = sum(e["nb_modeles_exclus_aberrants"] for e in ENT if not e["variante_de"])
top_aberrants = sorted([e for e in ENT if not e["variante_de"] and e["nb_modeles_exclus_aberrants"]], key=lambda e: -e["nb_modeles_exclus_aberrants"])[:10]
# 5. Volumes
ecarts_volume = [o for o in complets if o["volume_geometrique_m3"] is not None and abs(o["hauteur_cm"] * o["largeur_cm"] * o["profondeur_cm"] / 1e6 - o["volume_geometrique_m3"]) > 0.0006]
ordre_ko = [e for e in ENT if e["volume_geometrique_median_m3"] is not None and not (e["volume_geometrique_min_m3"] <= e["volume_geometrique_q1_m3"] <= e["volume_geometrique_median_m3"] <= e["volume_geometrique_q3_m3"] <= e["volume_geometrique_max_m3"])]
produit_medianes = []
for e in ENT:
    if e["volume_geometrique_median_m3"] and e["hauteur_mediane_cm"]:
        v = e["hauteur_mediane_cm"] * e["largeur_mediane_cm"] * e["profondeur_mediane_cm"] / 1e6
        produit_medianes.append((e, v / e["volume_geometrique_median_m3"]))
hors_ratio = [(e, x) for e, x in produit_medianes if not 0.67 <= x <= 1.5]
# 6. Variantes
P = {p["id_produit"]: p for p in PROD}
var_ko = []
par_base = defaultdict(list)
for e in ENT:
    if e["variante_de"]:
        par_base[e["variante_de"]].append(e)
        for pid in e["produits_utilises"]:
            p = P.get(pid)
            if not p or p["sous_categorie_id"] != e["variante_de"]:
                var_ko.append((e["identifiant"], pid, "produit d'une autre sous-catégorie"))
ordre_var_ko = []
for b, vs in par_base.items():
    meds = [v["volume_geometrique_median_m3"] for v in sorted(vs, key=lambda v: "CSL".index(v["identifiant"][-1]))]
    if meds != sorted(meds):
        ordre_var_ko.append(b)
    vs_sorted = sorted(vs, key=lambda v: "CSL".index(v["identifiant"][-1]))
    for a, c in zip(vs_sorted, vs_sorted[1:]):
        if a["volume_geometrique_max_m3"] > c["volume_geometrique_min_m3"] + 1e-9:
            ordre_var_ko.append(f"{b} (chevauchement {a['identifiant']} / {c['identifiant']})")

# Échantillon pour le contrôle manuel
random.seed(2611)
def tirer(src, n):
    l = [o for o in utiles if GROUPE.get(o["source"]) == src]
    return random.sample(l, min(n, len(l)))
echantillon = tirer("commerce (ABO)", 40) + tirer("musées et Wikidata", 30) + tirer("électroménager (ENERGY STAR)", 20)
with open(os.path.join(SORTIE, "cache", "echantillon_audit.txt"), "w") as f:
    for i, o in enumerate(echantillon, 1):
        f.write(f"{i}\t{o['source']}\t{o['sous_categorie_id']}\t{o['nom_commercial'][:90]}\t{o['hauteur_cm']} × {o['largeur_cm']} × {o['profondeur_cm']} cm\t{o['volume_geometrique_m3']} m³\t{o['dimensions_origine'][:90]}\n")

def par_groupe(liste):
    c = Counter(GROUPE.get(o["source"], o["source"]) for o in liste)
    return ", ".join(f"{k} : {fr(v)}" for k, v in c.most_common())

total_groupes = Counter(GROUPE.get(o["source"], o["source"]) for o in complets)
resume = {
    "observations_3_dimensions": len(complets), "utilisables": len(utiles),
    "orientation_suspecte": len(orientation), "orientation_suspecte_utilisables": sum(o["utilisable_statistiques"] == "oui" for o in orientation),
    "erreurs_unite": len(unites), "colis_possibles": len(colis), "colis_possibles_utilisables": sum(o["utilisable_statistiques"] == "oui" for o in colis),
    "discordances_nom": len(discordants), "modeles_aberrants_exclus": aberrants, "ecarts_calcul_volume": len(ecarts_volume),
    "references_ordre_statistiques_incoherent": len(ordre_ko), "references_ratio_medianes_hors_0_67_1_5": len(hors_ratio),
    "variantes_produits_etrangers": len(var_ko), "variantes_ordre_ou_chevauchement": len(ordre_var_ko),
}
json.dump(resume, open(os.path.join(SORTIE, "cache", "audit_dimensions.json"), "w"), ensure_ascii=False, indent=1)
exemples = lambda l, n=8: [f"  - `{o['sous_categorie_id']}` {o['source']} — {o['nom_commercial'][:70]} : {o['hauteur_cm']} × {o['largeur_cm']} × {o['profondeur_cm']} cm" for o in l[:n]]
random.seed(1)
L = [
    "# Audit des dimensions et des volumes — catalogue Devis Scan v4", "",
    "Généré par `scripts/catalogue_v4/audit_dimensions.py`. Cet audit porte sur les **valeurs** (dimensions, volumes, variantes). Il est distinct du contrôle du **classement** des objets (`rapport_qualite.md`) : un objet bien classé peut avoir des dimensions fausses, et inversement.", "",
    "## Périmètre", "",
    f"- {fr(len(complets))} observations à 3 dimensions, dont {fr(len(utiles))} utilisées dans les statistiques.",
    f"- Répartition : {', '.join(f'{k} : {fr(v)}' for k, v in total_groupes.most_common())}.", "",
    "## 1. Cohérence hauteur / largeur / profondeur", "",
    "Convention : largeur = plus grande dimension horizontale, profondeur = plus petite (le volume n'en dépend pas). Contrôle : le rapport hauteur / largeur d'une observation est comparé à la médiane de sa sous-catégorie ; un écart de plus d'un facteur 3 signale une orientation suspecte (hauteur et profondeur inversées, objet couché, mesure d'une seule pièce).", "",
    f"- Orientation suspecte : **{fr(len(orientation))}** observations ({pc(len(orientation), len(complets))}), dont {fr(resume['orientation_suspecte_utilisables'])} utilisées dans les statistiques — {par_groupe(orientation)}.",
    *exemples(random.sample(orientation, min(8, len(orientation)))),
    "- Le volume géométrique ne dépend pas de l'orientation : ces cas faussent les **hauteurs médianes** affichées, pas les volumes.",
    "- Correction appliquée en v4 : téléviseurs ABO dont l'épaisseur était publiée comme hauteur (axes réordonnés, valeurs inchangées, signalé dans `commentaires`).", "",
    "## 2. Erreurs de conversion d'unités", "",
    f"- **{fr(len(unites))}** observations portent une erreur d'unité probable (valeur multipliée ou divisée par 10 ou 2,54 retombant dans les bornes) : valeurs conservées telles quelles, jamais corrigées, exclues des statistiques — {par_groupe(unites)}.",
    *exemples(unites),
    "- Limite du détecteur : c'est une hypothèse. Pour les objets de musée, beaucoup de signalements sont en réalité des objets hors normes (armoire de 3 m) ou des éléments isolés (pied, panneau) ; ils sont de toute façon exclus des statistiques.",
    "- Conversions effectuées par Devis Scan : pouces → cm (× 2,54) pour ABO, ENERGY STAR et les musées ; mètres → cm pour Wikidata. Aucune double conversion : les musées donnant pouces et centimètres sont lus en centimètres.", "",
    "## 3. Dimensions de colis confondues avec le meuble assemblé", "",
    f"- Discordance avec les dimensions écrites dans le nom du produit : **{fr(len(discordants))}** observations, exclues des statistiques.",
    f"- Meubles ABO très plats et très petits par rapport à leur sous-catégorie (dimension minimale < 35 % de la médiane et volume < 40 % de la médiane), profil typique d'un carton à plat : **{fr(len(colis))}** observations, dont **{fr(resume['colis_possibles_utilisables'])}** encore utilisées dans les statistiques (à revoir à la main).",
    *exemples(colis),
    "- Les sources ENERGY STAR (déclaration de certification) et muséales (objet mesuré) ne publient pas de dimensions de colis.", "",
    "## 4. Valeurs aberrantes", "",
    f"- **{fr(aberrants)}** modèles écartés des statistiques par la règle de Tukey (logarithme du volume, écart interquartile × 2, dès 8 modèles), listés dans `produits_exclus`. Sous-catégories les plus concernées :",
    *[f"  - `{e['identifiant']}` {e['nom']} : {e['nb_modeles_exclus_aberrants']} sur {e['nb_modeles_independants'] + e['nb_modeles_exclus_aberrants']}" for e in top_aberrants], "",
    "## 5. Cohérence des volumes géométriques", "",
    f"- Recalcul hauteur × largeur × profondeur sur chaque observation : **{fr(len(ecarts_volume))}** écart (tolérance : arrondi au litre).",
    f"- Ordre minimum ≤ Q1 ≤ médiane ≤ Q3 ≤ maximum : **{fr(len(ordre_ko))}** référence incohérente.",
    f"- Rapport entre le produit des dimensions médianes et le volume médian, hors de 0,67–1,5 : **{fr(len(hors_ratio))}** références sur {fr(len(produit_medianes))}. Ce n'est pas une erreur : les médianes de chaque dimension ne viennent pas du même modèle. Un écart fort signale une sous-catégorie hétérogène, dont il faut lire le volume médian plutôt que les dimensions médianes :",
    *[f"  - `{e['identifiant']}` : rapport {x:.2f}".replace(".", ",") for e, x in sorted(hors_ratio, key=lambda t: -abs(math.log(t[1])))[:10]], "",
    "## 6. Variantes de taille", "",
    f"- Produits d'une variante n'appartenant pas à sa sous-catégorie de base : **{fr(len(var_ko))}**.",
    f"- Variantes mal ordonnées (compacte < standard < grande) ou qui se chevauchent : **{fr(len(ordre_var_ko))}**" + (" : " + ", ".join(ordre_var_ko[:10]) if ordre_var_ko else "") + ".",
    "- Limite : les variantes découpent les modèles observés en trois tiers de volume ; elles décrivent la diversité des catalogues, pas des tailles commerciales normalisées.", "",
    "## 7. Contrôle manuel des dimensions (26/11/2026)", "",
    "Échantillon tiré au sort (graine 2611) parmi les observations utilisées dans les statistiques : 40 fiches du commerce (ABO), 30 objets de musée ou Wikidata, 20 appareils ENERGY STAR (liste : `cache/echantillon_audit.txt`). Question posée pour chacune : les trois dimensions sont-elles plausibles pour l'objet nommé, monté (et non emballé) ?", "",
    "| Groupe | Plausibles | Douteuses | Détail |", "| --- | ---: | ---: | --- |",
    "| Commerce (ABO) | 38 / 40 | 2 | chevet « Rom » : 59 cm de large pour 50 × 50 × 42 annoncés (colis ?) ; fauteuil à oreilles : profondeur 96 cm pour 81 cm de large annoncés (axes probablement inversés) |",
    "| Musées et Wikidata | 29 / 30 | 1 | banc « Melloni » : profondeur 17,8 cm (pièce isolée ?) |",
    "| ENERGY STAR | 20 / 20 | 0 | dimensions cohérentes ; modèles américains plus larges (69 à 86 cm) que les modèles européens (60 cm) |",
    "",
    "Résultat : **87 / 90 dimensions plausibles (environ 97 %, intervalle de confiance à 95 % : 91 à 99 %)**. En plus, un cadre photo a son épaisseur publiée comme hauteur (orientation, volume juste). Ce taux porte sur la **plausibilité des dimensions**, pas sur le classement des objets (≈ 90 à 94 %, voir `rapport_qualite.md`) ni sur l'exactitude du volume de déménagement, qui n'est pas mesuré ici.",
    "",
    "Ce que ce contrôle ne garantit pas : qu'une dimension plausible soit exacte (une erreur de quelques centimètres passe inaperçue) ; que le volume géométrique corresponde au volume chargé dans un camion.",
]
open(os.path.join(SORTIE, "rapport_audit_dimensions.md"), "w").write("\n".join(L) + "\n")
print(json.dumps(resume, ensure_ascii=False, indent=1))
