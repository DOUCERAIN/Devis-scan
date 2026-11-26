"""Revue des 40 sous-catégories prioritaires avec un professionnel du déménagement (catalogue v6.2).

Sélection parmi les sous-catégories prioritaires (niveaux 1 et 2), hors carton (convention validée) et objet non
classé. Score documenté et ajustable :
  2   × fréquence       (part des 3 inventaires types où l'objet apparaît, + 0,5 si niveau de pertinence 1)
+ 2   × poids           (part maximale de l'objet dans le volume d'un inventaire type, rapportée à la plus forte)
+ 1,5 × volume unitaire (volume proposé, plafonné à 3 m³, rapporté à 3)
+ 1,5 × écart avec la v5 (écart absolu par unité, plafonné à 2 m³, rapporté à 2)
+ 1   si le volume est une estimation (analogie ou dimensions)
+ 1   si les références publiées se contredisent (rapport de 1,5 ou plus)
Les inventaires types sont construits par l'IA (non réels) : la fréquence est une approximation.
Aucune valeur n'est présentée comme validée : les colonnes « Volume corrigé » et « Commentaire » restent vides.
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from inventaires_types import INVENTAIRES  # noqa: E402
from releves_demenageurs import ABERRANTS, RELEVES  # noqa: E402

SORTIE = ICI.parents[1] / "data" / "catalogue-v6"

# Point précis à vérifier ; la question complète ajoute automatiquement le volume proposé et les autres valeurs.
POINTS = {
    "ARM-2P": "Armoire 2 portes courante (environ 1 m × 2 m × 0,6 m), comptée montée :",
    "ARM-3P": "Armoire 3 portes comptée montée :",
    "ARM-4P": "Armoire 4 portes comptée montée :",
    "ARM-NC": "Armoire sans nombre de portes connu : quel volume par défaut ?",
    "ARM-1P": "Armoire 1 porte (penderie étroite) :",
    "ARM-COUL": "Grande armoire à portes coulissantes (2 m de large et plus) :",
    "ARM-DRESS": "Dressing : faut-il compter par module d'environ 1 m de large ?",
    "CAN-2P": "Canapé 2 places :",
    "CAN-3P": "Canapé 3 places :",
    "CAN-ANG": "Canapé d'angle courant :",
    "CAN-CONV": "Canapé convertible :",
    "LIT-DOUBLE": "Lit double 140 complet (cadre, sommier, matelas) :",
    "LIT-SIMPLE": "Lit simple 90 complet :",
    "LIT-QUEEN": "Lit 160 complet :",
    "LIT-KING": "Lit 180 et plus, complet :",
    "LIT-SUPERP": "Lit superposé complet, avec ses deux matelas :",
    "LIT-COFFRE": "Lit coffre complet :",
    "COM-NC": "Commode courante (4 tiroirs, environ 0,8 × 0,8 × 0,45 m) :",
    "CHV-STD": "Table de chevet :",
    "BUR-DROIT": "Bureau droit courant :",
    "BUR-ANGLE": "Bureau d'angle :",
    "TAB-BASSE": "Table basse de salon courante :",
    "TAB-6": "Table à manger 6 personnes :",
    "TAB-4": "Table à manger 4 personnes :",
    "TAB-REPAS-NC": "Table à manger sans taille connue :",
    "CHA-REPAS": "Chaise de salle à manger :",
    "FAU-STD": "Fauteuil de salon :",
    "FAU-BUR": "Fauteuil de bureau :",
    "RAN-BUFFET": "Buffet bas ou enfilade :",
    "RAN-BIB-NC": "Bibliothèque courante (vide) :",
    "RAN-MEUBLE-TV": "Meuble TV bas courant :",
    "RAN-VITRINE": "Vitrine :",
    "ELM-REF": "Réfrigérateur standard :",
    "ELM-REF-COMBI": "Réfrigérateur combiné (congélateur en bas) :",
    "ELM-REF-US": "Réfrigérateur américain :",
    "ELM-CONG": "Congélateur armoire :",
    "ELM-LL": "Lave-linge :",
    "ELM-SL": "Sèche-linge :",
    "ELM-LV": "Lave-vaisselle :",
    "ELM-CUISINIERE": "Cuisinière :",
    "MUS-PIANO-DROIT": "Piano droit :",
    "VEL-ADULTE": "Vélo adulte :",
    "JAR-SALON": "Salon de jardin (table et 4 chaises) :",
    "JAR-TABLE": "Table de jardin seule :",
    "SOM-STD": "Sommier seul, sans lit :",
    "MAT-160": "Matelas 160 seul, sans lit :",
    "ETA-NC": "Étagère sur pieds courante :",
    "ETA-METAL": "Étagère métallique de garage :",
    "DEC-TAPIS-NC": "Tapis de salon roulé :",
    "DEC-MIROIR-GRAND": "Grand miroir :",
    "INF-TV-55": "Téléviseur 50 à 65 pouces :",
    "ENF-POUSSETTE": "Poussette pliée :",
}

QUESTIONS_GENERALES = [
    "Les volumes proposés comptent les meubles montés, dans leur état normal. Est-ce ainsi que vous estimez un logement lors d'une visite ?",
    "Un lit est compté complet (cadre, sommier, matelas), sans ligne séparée pour le matelas. Est-ce votre pratique ?",
    "Conventions validées par Devis Scan : carton standard 0,10 m³ ; bac de rangement 0,10 m³ et grand bac 0,20 m³ ; valise classique 0,20 m³, grande et très grande valise 0,30 m³. Cela correspond-il à votre pratique ?",
    "Pour un T3 familial type, le catalogue donne environ 32 m³ de meubles, hors cartons. Est-ce l'ordre de grandeur que vous constatez ?",
    "Pour une maison de 5 pièces avec garage et jardin, il donne environ 75 m³ de meubles. Est-ce l'ordre de grandeur que vous constatez ?",
    "Quels objets courants vous semblent nettement surévalués ou sous-évalués dans la liste ?",
    "Voyez-vous des objets fréquents qui manquent au catalogue ?",
]


def f2(x):
    return "" if x in ("", None) else f"{float(x):.2f}".replace(".", ",")


def source_courte(r):
    t = r["type_reference"]
    if "Démén'House" in t:
        return "valeur publiée par Démén'House"
    if t.startswith("attribuée"):
        return "valeur publiée par " + r["source_principale"].split(" — ")[0]
    if t.startswith("non attribuée"):
        return "valeur publiée, site non identifié"
    if "analogie" in t:
        return "estimation par analogie"
    if "ratio" in t:
        return "estimation à partir des dimensions"
    return t


def main():
    with open(SORTIE / "catalogue_volumes_v6.csv", newline="") as f:
        cat = {r["identifiant"]: r for r in csv.DictReader(f, delimiter=";")}
    vals = defaultdict(list)
    for sc, v, *_ in RELEVES:
        if v is not None and (sc, v) not in ABERRANTS:
            vals[sc].append(v)
    freq, part = defaultdict(int), defaultdict(float)
    for inv in INVENTAIRES.values():
        tot = sum(float(cat[sc]["volume_demenagement_m3"] or 0) * q for sc, q in inv["objets"])
        for sc, q in inv["objets"]:
            freq[sc] += 1
            part[sc] = max(part[sc], float(cat[sc]["volume_demenagement_m3"] or 0) * q / tot)
    pmax = max(part.values())
    sel = []
    for i, r in cat.items():
        if r["prioritaire"] != "True" or i in ("CAR-CARTON", "CAR-BAC", "CAR-BAC-GRAND", "BAG-VALISE", "BAG-VALISE-GRANDE", "BAG-VALISE-TRES-GRANDE", "DIV-AUTRE") or not r["volume_demenagement_m3"]:
            continue
        v = float(r["volume_demenagement_m3"])
        fr = freq[i] / 3 + (0.5 if r["niveau_pertinence"] == "1" else 0)
        ecart = min(2.0, abs(v - float(r["volume_v5_m3"]))) / 2 if r["volume_v5_m3"] else 0
        estim = 1 if r["regle"][:1] in "45" else 0
        contra = 1 if len(vals[i]) >= 2 and max(vals[i]) / min(vals[i]) >= 1.5 else 0
        score = 2 * fr + 2 * part[i] / pmax + 1.5 * min(v, 3) / 3 + 1.5 * ecart + estim + contra
        sel.append((score, i, r, fr, part[i], ecart, estim, contra))
    sel.sort(key=lambda x: (-x[0], x[1]))
    revue = []
    for rang, (score, i, r, fr, p, ec, es, co) in enumerate(sel[:40], 1):
        v = f2(r["volume_demenagement_m3"])
        autres = sorted(set(vals[i]) - {float(r["volume_demenagement_m3"])})
        q = POINTS.get(i, f"{r['nom']} :")
        q += f" proposition {v} m³ ({source_courte(r)})."
        if autres:
            q += " Autres valeurs publiées : " + ", ".join(f2(a) for a in autres) + " m³."
        if r["volume_v5_m3"]:
            q += f" Ancien catalogue : {f2(r['volume_v5_m3'])} m³."
        q += " Quel volume retenez-vous ?"
        motifs = [m for m, ok in (("objet fréquent", fr >= 1), ("poids important dans l'inventaire", p / pmax >= 0.3), ("grand écart avec la v5", ec >= 0.4),
                                  ("estimation sans référence propre", es), ("références contradictoires", co)) if ok]
        revue.append({"rang": rang, "id_devis_scan": i, "sous_categorie": r["nom"], "volume_propose_m3": r["volume_demenagement_m3"],
                      "origine_du_volume": source_courte(r), "question_au_professionnel": q, "volume_corrige_m3": "", "commentaire": "",
                      "motifs_de_selection": ", ".join(motifs), "volume_v5_m3": r["volume_v5_m3"], "volume_v6_1_m3": r["volume_v6_1_m3"],
                      "score": round(score, 2)})
    with open(SORTIE / "revue_40_categories.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(revue[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(revue)
    md = ["# Revue des 40 sous-catégories prioritaires — support pour un déménageur professionnel", "",
          "Catalogue candidat v6.2, préparé le 26/11/2026. **Aucune valeur n'a encore été validée par un professionnel.**",
          "Durée visée : une heure. Remplir les colonnes « Volume corrigé » et « Commentaire » (ou les mêmes colonnes de `revue_40_categories.csv`).", "",
          "Convention : meubles **montés et complets**, dans leur état normal ; ni calage, ni protection, ni vide de chargement. Carton standard = 0,10 m³.", "",
          "## Questions générales", ""]
    md += [f"{k}. {q}" for k, q in enumerate(QUESTIONS_GENERALES, 1)]
    md += ["", "## Les 40 sous-catégories", "", "| # | Sous-catégorie | Volume proposé (m³) | Question à poser | Volume corrigé | Commentaire |", "|---|---|---:|---|---|---|"]
    for r in revue:
        md.append(f"| {r['rang']} | {r['sous_categorie']} (`{r['id_devis_scan']}`) | {f2(r['volume_propose_m3'])} | {r['question_au_professionnel']} |  |  |")
    md += ["", "Sélection : objets fréquents, volume unitaire important, grand écart avec l'ancien catalogue, estimations et références contradictoires (méthode dans `scripts/catalogue_v6/revue.py`)."]
    (SORTIE / "revue_40_categories.md").write_text("\n".join(md) + "\n")
    for r in revue:
        print(r["rang"], r["id_devis_scan"], r["volume_propose_m3"], r["origine_du_volume"], "|", r["motifs_de_selection"])


if __name__ == "__main__":
    main()
