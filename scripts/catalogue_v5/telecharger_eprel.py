"""
Téléchargement EPREL (base européenne des étiquettes énergie) — PRÉPARÉ, NON EXÉCUTÉ (27/11/2026).

L'API publique d'EPREL exige une clé (« An API key is required when calling the Public API for searching and
retrieving models », site officiel). Ce script refuse de fonctionner sans clé : il ne contourne rien et n'utilise
jamais les adresses internes du site public.

Utilisation, une fois la clé obtenue par Devis Scan (voir data/catalogue-v5/rapport_eprel.md) :
    EPREL_API_KEY=… python3 scripts/catalogue_v5/telecharger_eprel.py refrigeratingappliances2019 dishwashers2019 …
La clé n'est jamais écrite dans un fichier ni affichée. Les réponses sont enregistrées telles quelles dans
data/catalogue-v5/cache/eprel/<groupe>/page-<n>.json (non versionnées), avec une pause entre deux requêtes.

Points à confirmer à réception de la clé (documentation de l'API réservée aux comptes EU Login) : adresse exacte
des recherches, nom de l'en-tête de la clé, taille maximale des pages, limites de fréquence.
"""
from __future__ import annotations
import json
import os
import sys
import time
import urllib.request

BASE = "https://eprel.ec.europa.eu/api/products"   # à confirmer avec la documentation officielle
EN_TETE_CLE = "x-api-key"                          # à confirmer
TAILLE_PAGE = 100
PAUSE_S = 2.0
# Groupes utiles au déménagement dont les fiches publient les dimensions hors tout (libellés officiels lus le 27/11/2026)
GROUPES = {
    "refrigeratingappliances2019": "Réfrigérateurs, congélateurs, caves à vin (hauteur × largeur × profondeur, mm)",
    "dishwashers2019": "Lave-vaisselle (hauteur × largeur × profondeur, cm)",
    "washingmachines2019": "Lave-linge (hauteur × largeur × profondeur, cm)",
    "washerdriers2019": "Lave-linge séchants (hauteur × largeur × profondeur, cm)",
    "tumbledriers20232534": "Sèche-linge (hauteur × largeur × profondeur, cm)",
}


def main(groupes):
    cle = os.environ.get("EPREL_API_KEY")
    if not cle:
        sys.exit("Aucune clé EPREL (variable EPREL_API_KEY). Rien n'est téléchargé : la clé doit d'abord être obtenue par Devis Scan.")
    racine = os.path.join(os.path.dirname(__file__), "..", "..", "data", "catalogue-v5", "cache", "eprel")
    for g in groupes or GROUPES:
        os.makedirs(os.path.join(racine, g), exist_ok=True)
        page = 1
        while True:
            req = urllib.request.Request(f"{BASE}/{g}?_page={page}&_limit={TAILLE_PAGE}", headers={EN_TETE_CLE: cle, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            json.dump(data, open(os.path.join(racine, g, f"page-{page}.json"), "w"))
            hits = data.get("hits") or data.get("results") or []
            print(f"{g} page {page} : {len(hits)} fiches")
            if len(hits) < TAILLE_PAGE:
                break
            page += 1
            time.sleep(PAUSE_S)


if __name__ == "__main__":
    main(sys.argv[1:])
