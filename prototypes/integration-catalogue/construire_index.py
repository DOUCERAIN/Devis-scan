"""
Index de recherche compact du catalogue v5 — PROTOTYPE (non branché sur l'application).

Lit (sans les modifier) :
  - data/catalogue-v5/catalogue_devis_scan.json (références normalisées, variantes, statistiques) ;
  - scripts/catalogue_v5/taxonomie.py (motifs multilingues : mots-clés de recherche) ;
  - data/catalogue-v5/correspondance_catalogue_existant.csv (134 identifiants historiques → références v5).
Écrit : prototypes/integration-catalogue/index_catalogue_v5.json (versionné : ~0,4 Mo).

Aucune observation documentaire n'est copiée : l'index ne contient que ce qu'un moteur de recherche et le serveur
ont besoin de connaître (identifiants, noms, synonymes, caractéristiques, statistiques de référence).

Lancer : python3 prototypes/integration-catalogue/construire_index.py
"""
from __future__ import annotations
import csv
import hashlib
import json
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
sys.path.insert(0, os.path.join(RACINE, "scripts", "catalogue_v5"))
from taxonomie import PAR_ID  # noqa: E402

CATALOGUE = os.path.join(RACINE, "data", "catalogue-v5", "catalogue_devis_scan.json")
CORRESP = os.path.join(RACINE, "data", "catalogue-v5", "correspondance_catalogue_existant.csv")
VIDES = {"with", "and", "the", "for", "der", "die", "das", "und", "con", "per", "del", "les", "des", "une", "set", "pack", "inch", "size"}


def mots_cles(motifs):
    """Mots lisibles tirés des expressions régulières de la taxonomie (toutes langues)."""
    mots = set()
    for m in motifs:
        t = re.sub(r"\(\?<?[=!][^)]*\)", " ", m)          # assertions (?=…), (?!…), (?<=…), (?<!…)
        t = re.sub(r"\(\?:|\\[bsdwBSDW]|\[[^\]]*\]|[\\^$.*+?{}()|]", " ", t)
        mots.update(w for w in re.findall(r"[a-zàâäéèêëîïôöùûüç]{3,}", t.lower()) if w not in VIDES)
    return sorted(mots)


NB = r"(\d+(?:[,.]\d+)?)"
CRITERES = [  # (champ, mot du texte)
    ("nb_portes", r"portes?"), ("nb_places", r"places?"), ("nb_tiroirs", r"tiroirs?"),
]
PLAGES = [  # (champ, préfixe du texte, unité)
    ("largeur_couchage_cm", r"couchage", r"cm"), ("largeur_cm", r"largeur", r"cm"), ("diagonale_pouces", r"diagonale", r"pouces"),
    ("longueur_cm", r"longueur", r"cm"), ("hauteur_cm", r"hauteur", r"cm"), ("profondeur_cm", r"profondeur", r"cm"), ("taille_cm", r"", r"cm"),
]


def criteres(texte):
    """Critères chiffrés tirés des caractéristiques discriminantes (« 2 portes », « ≥ 5 places », « couchage 150–160 cm »,
    « longueur ≤ 150 cm », « diagonale ≥ 70 pouces »). Bornes inclusives [min, max] ; None = sans borne."""
    t = texte.replace("–", "-").replace(" ", " ")
    out = {}
    for champ, mot in CRITERES:
        m = re.search(r"(≥|≤)?\s*" + NB + r"\s*" + mot + r"\b", t)
        if m:
            v = float(m.group(2).replace(",", "."))
            out[champ] = [v, None] if m.group(1) == "≥" else [None, v] if m.group(1) == "≤" else [v, v]
    for champ, prefixe, unite in PLAGES:
        if champ == "taille_cm" or not prefixe:
            continue
        m = re.search(prefixe + r"\s*(≥|≤)?\s*" + NB + r"(?:\s*-\s*" + NB + r")?\s*" + unite, t)
        if m:
            a = float(m.group(2).replace(",", "."))
            b = float(m.group(3).replace(",", ".")) if m.group(3) else None
            out[champ] = [a, b] if b else ([a, None] if m.group(1) == "≥" else [None, a] if m.group(1) == "≤" else [a, a])
    return out


def main():
    brut = open(CATALOGUE, "rb").read()
    cat = json.loads(brut)
    refs = cat["references"]
    enfants = {}
    for r in refs:
        if r["variante_de"]:
            enfants.setdefault(r["variante_de"], []).append(r["identifiant"])
    anciens = {}
    for l in csv.DictReader(open(CORRESP, encoding="utf-8"), delimiter=";"):
        anciens[l["id_existant"]] = {
            "nom": l["nom_existant"], "synonymes": [s.strip() for s in l["synonymes_existants"].split(";") if s.strip()],
            "reference_principale": l["reference_normalisee_principale"] or None,
            "references_liees": [s.strip() for s in l["references_normalisees_liees"].split(";") if s.strip()],
        }
    syn_anciens = {}
    for aid, a in anciens.items():
        for rid in a["references_liees"]:
            syn_anciens.setdefault(rid, set()).update([a["nom"].lower(), *[s.lower() for s in a["synonymes"]]])
    index = []
    for r in refs:
        base_id = r["variante_de"] or r["identifiant"]
        sc = PAR_ID.get(base_id)
        index.append({
            "id": r["identifiant"], "nom": r["nom"], "famille_id": r["famille_id"], "famille": r["famille"],
            "variante_de": r["variante_de"] or None, "variantes": enfants.get(r["identifiant"], []),
            "synonymes": sorted(set(r["synonymes"]) | syn_anciens.get(base_id, set())),
            "mots_cles": mots_cles(sc.motifs) if sc else [],
            "caracteristiques_discriminantes": r["caracteristiques_discriminantes"], "description": r["description_physique"],
            "criteres": criteres(r["caracteristiques_discriminantes"] if not r["variante_de"] else next((x["caracteristiques_discriminantes"] for x in refs if x["identifiant"] == r["variante_de"]), "")),
            "plage_variante_m3": ([r["volume_geometrique_min_m3"], r["volume_geometrique_max_m3"]] if r["variante_de"] else None),
            "niveau_pertinence": r["niveau_pertinence"], "mesurabilite": r["mesurabilite"], "couverture_dimensions": r["couverture_dimensions"],
            "fiabilite": r["fiabilite"], "nb_modeles_independants": r["nb_modeles_independants"], "nb_sources_independantes": r["nb_sources_independantes"],
            "dimensions_medianes_cm": {"hauteur": r["hauteur_mediane_cm"], "largeur": r["largeur_mediane_cm"], "profondeur": r["profondeur_mediane_cm"]},
            "dimensions_partielles": r["dimensions_partielles"],
            "volume_geometrique_m3": {"mediane": r["volume_geometrique_median_m3"], "q1": r["volume_geometrique_q1_m3"], "q3": r["volume_geometrique_q3_m3"],
                                      "min": r["volume_geometrique_min_m3"], "max": r["volume_geometrique_max_m3"]},
            "volume_demenagement": {"reference_m3": r["volume_demenagement_reference_m3"], "origine": r["volume_demenagement_origine"],
                                    "facteur_conversion": r["facteur_conversion_demenagement"], "convention": r["convention_volume_demenagement"]},
            "transport": {"demontable_ou_pliable": r["demontable_ou_pliable"] == "oui", "empilable": r["empilable"] == "oui",
                          "remarque": r["volume_transport_peut_differer"], "avertissement_volume": r["avertissement_volume"]},
            "references_anciennes": r["references_anciennes"],
        })
    sortie = {
        "version_catalogue": cat["version"],
        "empreinte_catalogue_sha256": hashlib.sha256(brut).hexdigest(),
        "genere_depuis": "data/catalogue-v5/catalogue_devis_scan.json",
        "familles": cat["familles"],
        "references": index,
        "alias_historiques": anciens,
        "convention_volume": cat["convention_volume"],
    }
    json.dump(sortie, open(os.path.join(ICI, "index_catalogue_v5.json"), "w"), ensure_ascii=False, indent=0)
    print(f"{len(index)} références, {len(anciens)} alias historiques, empreinte {sortie['empreinte_catalogue_sha256'][:12]}…")


if __name__ == "__main__":
    main()
