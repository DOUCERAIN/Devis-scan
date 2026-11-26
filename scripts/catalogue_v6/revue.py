"""Sélection des 40 sous-catégories à faire relire par un professionnel du déménagement (catalogue v6.1).

Score (documenté, ajustable) pour les sous-catégories prioritaires (niveaux 1 et 2), hors carton (convention déjà
validée) et objet non classé :
  2 × fréquence   (part des 3 inventaires types où l'objet apparaît, + 0,5 si niveau de pertinence 1)
+ 3 × poids       (part maximale de l'objet dans le volume d'un inventaire type, rapportée à la plus forte)
+ 1 × anomalies   (anomalies ouvertes : 1 par élevée, 0,5 par moyenne, plafonné à 2)
+ 1 × divergence  (log₂ du rapport entre la plus forte et la plus faible valeur publiée, plafonné à 2)
+ 0,5 si fiabilité provisoire
Les inventaires types ne sont pas des inventaires réels : la fréquence est une approximation à remplacer.
"""
import csv
import math
import sys
from collections import defaultdict
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from inventaires_types import INVENTAIRES  # noqa: E402

SORTIE = ICI.parents[1] / "data" / "catalogue-v6"

QUESTIONS = {
    "ARM-2P": "Quel volume comptez-vous pour une armoire 2 portes courante (environ 100 × 200 × 60 cm) : démontée par l'équipe ou transportée montée ?",
    "ARM-3P": "Volume d'une armoire 3 portes : 1,8 m³ (simulateur) ou 3 m³ (« montée », mtn-demenagement.com) ? Démontez-vous systématiquement ?",
    "ARM-4P": "Démén'House compte 4,3 m³ pour une armoire 4 portes, macalculatriceenligne.com 2,0 m³ : lequel correspond à votre pratique (démontée ou non) ?",
    "ARM-NC": "Quand l'inventaire dit seulement « armoire », quel volume par défaut utilisez-vous (Démén'House : 2,3 m³) ?",
    "ARM-1P": "Volume d'une armoire 1 porte (penderie étroite) : la proposition de 0,72 m³ vous semble-t-elle juste ?",
    "ARM-COUL": "Armoire à portes coulissantes (souvent 2 m de large et plus) : 5,7 m³ proposés par proportion avec l'armoire 4 portes. Quel volume réel une fois démontée ?",
    "CAN-2P": "Canapé 2 places : Démén'House annonce 2,5 m³, très au-dessus de l'ancien catalogue (1 m³). Quelle valeur utilisez-vous ?",
    "CAN-3P": "Canapé 3 places : 3 m³ (Démén'House) ou 1,5 à 1,65 m³ (autres sites) ? Protégez-vous le canapé sous housse (volume ajouté) ?",
    "CAN-ANG": "Canapé d'angle : 4,2 m³ proposés par proportion avec le 3 places. Le démontez-vous en deux éléments ? Quel volume retenez-vous ?",
    "CAN-CONV": "Canapé convertible : 2,5 m³ proposés (autres sites : 2 à 2,5 m³). Le mécanisme change-t-il votre estimation ?",
    "CAN-NC": "Canapé sans nombre de places connu : faut-il prendre le 3 places par défaut (3 m³) ?",
    "LIT-DOUBLE": "Lit double 140 : Démén'House 2,6 m³, formadem.com 0,8 m³. Votre valeur compte-t-elle le cadre, le sommier ET le matelas (convention « lit complet » proposée) ?",
    "LIT-SIMPLE": "Lit simple 90 : 1,3 m³ (Démén'House) contre 0,5 à 1 m³ ailleurs. Lit complet avec matelas ?",
    "LIT-QUEEN": "Lit 160 : 2,99 m³ proposés (lit double × 1,15). Quelle valeur pour un lit 160 complet ?",
    "LIT-KING": "Lit 180 et plus : 3,44 m³ proposés. Est-ce cohérent avec votre pratique ?",
    "LIT-SUPERP": "Lit superposé : 1,6 m³ (un-calcul.fr), alors qu'un lit simple vaut 1,3 m³ chez Démén'House. Démonté, combien compte-t-il avec ses deux matelas ?",
    "LIT-COFFRE": "Lit coffre : le coffre ne se démonte pas. 3,9 m³ proposés : quelle valeur retenez-vous ?",
    "LIT-NC": "Lit de taille inconnue : faut-il prendre le lit double par défaut (2,6 m³) ?",
    "LIT-BEBE": "Lit bébé à barreaux : 1,5 m³ (barème non attribué) pour un meuble démontable de 0,75 m³ monté. Valeur juste ?",
    "MAT-160": "Matelas 160 seul (sans lit) : 0,8 m³ posé sur la tranche. Valeur utilisée ?",
    "MAT-140": "Matelas 140 seul : 0,7 m³ proposés (formadem.com : 0,35 m³). Lequel ?",
    "SOM-STD": "Sommier seul : 1,44 m³ proposés par ratio (aucune source). Combien comptez-vous pour un sommier 140 ou 160 ?",
    "COM-NC": "Commode : Démén'House donne 1,5 m³ dans une liste et 0,5 à 1 m³ dans un autre article ; autres sites 0,4 à 0,5 m³. Quelle valeur pour une commode courante 4 tiroirs ?",
    "COM-3T": "Commode 3 tiroirs : 1,02 m³ proposés par proportion avec la commode générique (Démén'House 1,5 m³). Trop élevé ?",
    "COM-4T": "Commode 4 tiroirs : 0,9 m³ proposés. Juste ?",
    "COM-5T": "Commode 5 tiroirs : 1,3 m³ proposés. Juste ?",
    "COM-LARGE": "Grande commode (6 tiroirs et plus) : 1,8 m³ proposés. Juste ?",
    "CHV-STD": "Table de chevet : 0,3 m³ (Démén'House, liste) ou 0,15 à 0,25 m³ (Démén'House, autre article) ?",
    "BUR-DROIT": "Bureau droit : 1,4 m³ (Démén'House) contre 0,5 à 0,8 m³ ailleurs. Le démontez-vous ?",
    "BUR-ANGLE": "Bureau d'angle : quelle valeur (aucune source professionnelle ; proposition par ratio) ?",
    "FAU-BUR": "Fauteuil de bureau : 0,4 m³ (Démén'House). Juste ?",
    "FAU-STD": "Fauteuil : 0,7 m³ (Démén'House), fourchette 0,5 à 1 m³. Juste ?",
    "TAB-BASSE": "Table basse : 1 m³ (Démén'House) pour un meuble de 0,29 m³ en moyenne, contre 0,3 m³ ailleurs. Quelle valeur ?",
    "TAB-REPAS-NC": "Table à manger : 1,5 m³ (Démén'House). Démontez-vous les pieds ?",
    "TAB-6": "Table 6 personnes : 1,62 m³ proposés (autres sites : 1,2 m³). Juste ?",
    "TAB-4": "Table 4 personnes : 0,97 m³ proposés (autres sites : 0,8 à 1,2 m³). Juste ?",
    "TAB-8+": "Grande table 8 personnes et plus : 2,1 m³ proposés. Juste ?",
    "CHA-REPAS": "Chaise : 0,25 m³ (Démén'House) ou 0,15 m³ ? Empilez-vous les chaises ?",
    "CHA-BAR": "Tabouret de bar : 0,27 m³ proposés par ratio (aucune source). Juste ?",
    "RAN-BUFFET": "Buffet bas : 1,2 m³ (Démén'House), 1,5 m³ ailleurs. Juste ?",
    "RAN-BIB-NC": "Bibliothèque : 2 m³ (Démén'House) pour 0,37 m³ de meuble en moyenne. Valeur pour une bibliothèque courante vide ?",
    "RAN-BIB-HAUTE": "Bibliothèque haute : 2,4 m³ proposés par proportion. Juste ?",
    "RAN-BIB-BASSE": "Bibliothèque basse : 1,3 m³ proposés par proportion. Juste ?",
    "RAN-MEUBLE-TV": "Meuble TV : Démén'House 3,2 m³ (écarté), autres sites 0,4 à 1 m³ ; 0,4 m³ retenu. Quelle valeur ?",
    "RAN-VITRINE": "Vitrine : 1,8 m³ (une seule source, non attribuée). Juste ?",
    "ELM-REF": "Réfrigérateur standard : 1 m³ (Démén'House). Juste ?",
    "ELM-REF-COMBI": "Réfrigérateur combiné (congélateur en bas) : 1,5 m³ (source non attribuée). Juste ?",
    "ELM-REF-US": "Réfrigérateur américain : 1,8 m³ retenu (valeurs publiées de 0,8 à 1,8 m³). Juste ?",
    "ELM-REF-TOP": "Mini-réfrigérateur ou table top : 0,24 m³ proposés. Juste ?",
    "ELM-CONG": "Congélateur armoire : 1,6 m³ (Démén'House), 0,6 m³ ailleurs. Juste ?",
    "ELM-LL": "Lave-linge : 0,5 m³ (non attribué), fourchette Démén'House 0,6 à 0,8 m³. Quelle valeur ?",
    "ELM-SL": "Sèche-linge : 0,5 m³. Juste ?",
    "ELM-LV": "Lave-vaisselle : 0,6 m³ (Démén'House). Juste ?",
    "ELM-CUISINIERE": "Cuisinière : 0,6 m³ (valeurs publiées de 0,35 à 0,6 m³). Juste ?",
    "MUS-PIANO-DROIT": "Piano droit : 2 m³ (Démén'House) ; autres valeurs 1,2 à 1,5 m³. Juste ?",
    "VEL-ADULTE": "Vélo adulte : 0,8 m³ (Démén'House) ou 0,5 m³ ? Guidon tourné, pédales retirées ?",
    "ETA-NC": "Étagère : 1 m³ (barème non attribué) pour un meuble de 0,22 m³ en moyenne. Démontée ?",
    "ETA-METAL": "Étagère métallique de garage : 0,98 m³ proposés par ratio. Démontée, combien ?",
    "DEC-MIROIR-GRAND": "Grand miroir : 0,3 m³ (non attribué), avec emballage spécifique ?",
    "INF-TV-55": "Téléviseur 50 à 65 pouces : 0,3 m³ (non attribué), dans son carton ou sous protection ?",
    "JAR-SALON": "Salon de jardin : valeurs de 0,75 à 3 m³ ; 2 m³ retenu (ouimove.com). Que compte un « salon » (table et 4 chaises) ?",
    "JAR-TABLE": "Table de jardin : 2,3 m³ (Démén'House) contre 1 m³ ailleurs. Juste ?",
    "JAR-CHAISE": "Chaise de jardin : 0,6 m³ (Démén'House). Empilable ?",
    "ENF-POUSSETTE": "Poussette pliée : 0,3 m³ (formadem.com) ou 0,8 m³ (deux autres sites) ? 0,3 m³ retenu.",
    "CUI-DESSERTE": "Desserte de cuisine : 0,66 m³ proposés par ratio. Juste ?",
    "ENT-CHAUSS": "Meuble à chaussures : 0,69 m³ proposés par ratio. Juste ?",
    "DEC-LAMPADAIRE": "Lampadaire : 0,15 m³ ou 0,3 m³ (deux valeurs non attribuées) ? Emballez-vous l'abat-jour à part ?",
    "DEC-TAPIS-NC": "Tapis roulé : 0,2 ou 0,5 m³ (valeurs non attribuées) ? Quel volume pour un tapis de salon de 2 × 3 m ?",
    "BAG-VALISE": "Valise : la comptez-vous à part ou comme un carton (0,10 m³) ? 0,17 m³ proposés par ratio.",
    "ELM-MO": "Micro-ondes : mis en carton (0,10 m³) ou compté à part ? 0,07 m³ proposés.",
    "PEM-ASPI": "Aspirateur : mis en carton ou compté à part ? 0,04 m³ proposés.",
    "CAR-BAC": "Caisse ou bac de rangement plein : 0,15 m³ proposés par ratio, alors que le carton vaut 0,10 m³. Comptez-vous un bac comme un carton ?",
}


def main():
    with open(SORTIE / "catalogue_volumes_v6.csv", newline="") as f:
        cat = {r["identifiant"]: r for r in csv.DictReader(f, delimiter=";")}
    with open(SORTIE / "anomalies.csv", newline="") as f:
        ano = list(csv.DictReader(f, delimiter=";"))
    freq = defaultdict(int)
    part = defaultdict(float)
    for inv in INVENTAIRES.values():
        tot = sum(float(cat[sc]["volume_demenagement_m3"] or 0) * q for sc, q in inv["objets"])
        for sc, q in inv["objets"]:
            freq[sc] += 1
            part[sc] = max(part[sc], float(cat[sc]["volume_demenagement_m3"] or 0) * q / tot)
    pmax = max(part.values())
    anom = defaultdict(float)
    for a in ano:
        if a["etat_resolution"] == "ouverte":
            for sc in [s.strip() for s in a["sous_categories"].split(",")]:
                anom[sc] += 1 if a["priorite"] == "élevée" else 0.5 if a["priorite"] == "moyenne" else 0
    sys.path.insert(0, str(ICI))
    from releves_demenageurs import RELEVES, ABERRANTS
    vals = defaultdict(list)
    for sc, v, *_ in RELEVES:
        if v is not None and (sc, v) not in ABERRANTS:
            vals[sc].append(v)
    lignes = []
    for i, r in cat.items():
        if r["prioritaire"] != "True" or i in ("CAR-CARTON", "DIV-AUTRE"):
            continue
        f = freq[i] / 3 + (0.5 if r["niveau_pertinence"] == "1" else 0)
        d = min(2, math.log2(max(vals[i]) / min(vals[i]))) if len(vals[i]) >= 2 else 0
        score = 2 * f + 3 * part[i] / pmax + min(2, anom[i]) + d + (0.5 if r["fiabilite_demenagement"] == "provisoire" else 0)
        lignes.append((score, i, r, f, part[i], anom[i], d))
    lignes.sort(key=lambda x: (-x[0], x[1]))
    revue = []
    for rang, (score, i, r, f, p, a, d) in enumerate(lignes[:40], 1):
        probs = []
        if r["divergence"]:
            probs.append("divergence entre sources (" + r["divergence"] + ")")
        if r["regle"].startswith("4"):
            probs.append("aucune valeur professionnelle propre : comparable")
        if r["regle"].startswith("5"):
            probs.append("aucune valeur professionnelle : ratio géométrique")
        if r["type_reference"].startswith("non attribuée"):
            probs.append("source non attribuée")
        if "convention différente" in (r["methode_demenagement"] or "") or "alignement" in r["regle"]:
            probs.append("convention de source différente de Démén'House")
        if r["volume_v5_m3"] and r["volume_demenagement_m3"] and abs(float(r["volume_demenagement_m3"]) - float(r["volume_v5_m3"])) / float(r["volume_v5_m3"]) > 0.5:
            probs.append(f"écart avec la v5 ({float(r['volume_v5_m3'])} → {float(r['volume_demenagement_m3'])} m³)")
        q = QUESTIONS.get(i) or f"Quel volume retenez-vous pour « {r['nom']} » ? Proposition actuelle : {r['volume_demenagement_m3']} m³ ({r['type_reference']})."
        revue.append({"rang": rang, "id_devis_scan": i, "sous_categorie": r["nom"], "volume_v5_m3": r["volume_v5_m3"], "volume_v6_0_m3": r["volume_v6_0_m3"],
                      "volume_retenu_v6_1_m3": r["volume_demenagement_m3"], "source_principale": r["source_principale"] or r["type_reference"],
                      "type_reference": r["type_reference"], "autres_references": r["autres_references"], "fiabilite": r["fiabilite_demenagement"],
                      "probleme_identifie": " ; ".join(probs) or "valeur à confirmer (objet fréquent)", "question_au_professionnel": q,
                      "volume_valide_par_le_professionnel_m3": "", "commentaire_du_professionnel": "",
                      "score": round(score, 2), "detail_score": f"fréquence {f:.2f}, poids {p:.2%}, anomalies {a}, divergence {d:.2f}"})
    with open(SORTIE / "revue_40_categories.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(revue[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(revue)
    fr = lambda x: "" if x in ("", None) else f"{float(x):.2f}".replace(".", ",")  # noqa: E731
    md = ["# Revue des 40 sous-catégories prioritaires — à remplir avec un déménageur professionnel", "",
          "Préparée le 26/11/2026 (catalogue v6.1). **Aucune de ces valeurs n'a été validée par un professionnel.**",
          "Durée visée : environ une heure, soit 1 à 2 minutes par ligne. Notez la valeur validée et un commentaire dans les deux dernières colonnes de `revue_40_categories.csv`.", "",
          "Rappel des conventions :",
          "- un carton standard vaut 0,10 m³ (validé) ;",
          "- un lit compte le cadre, le sommier et le matelas (proposé, question n° 1) ;",
          "- les volumes sont ceux du camion, et non ceux du meuble.", "",
          "**Questions générales à poser d'abord :**", "",
          "1. Vos volumes comptent-ils les meubles démontés par l'équipe, ou montés ?",
          "2. Comptent-ils la protection (couvertures, housses) et le calage ?",
          "3. Pour un lit, comptez-vous ensemble le cadre, le sommier et le matelas ?",
          "4. Démén'House donne en général des valeurs environ 1,6 fois plus élevées que les autres sites. Laquelle de ces deux conventions est la plus proche de la vôtre ?", "",
          "| # | ID | Sous-catégorie | v5 | v6.0 | Retenu v6.1 | Source principale | Autres références | Fiabilité | Problème | Question |",
          "| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |"]
    for r in revue:
        src = r["type_reference"].replace("attribuée — ", "").replace("entreprise de déménagement ", "")
        md.append(f"| {r['rang']} | `{r['id_devis_scan']}` | {r['sous_categorie']} | {fr(r['volume_v5_m3'])} | {fr(r['volume_v6_0_m3'])} | **{fr(r['volume_retenu_v6_1_m3'])}** | {src} | {r['autres_references'][:160].replace('|', '/')} | {r['fiabilite']} | {r['probleme_identifie']} | {r['question_au_professionnel']} |")
    md += ["", "Méthode de sélection : voir l'en-tête de `scripts/catalogue_v6/revue.py`. Les fréquences viennent d'inventaires types construits par l'IA, pas d'inventaires réels."]
    (SORTIE / "revue_40_categories.md").write_text("\n".join(md) + "\n")
    for r in revue:
        print(r["rang"], r["id_devis_scan"], r["volume_retenu_v6_1_m3"], r["score"], r["question_au_professionnel"][:50])


if __name__ == "__main__":
    main()
