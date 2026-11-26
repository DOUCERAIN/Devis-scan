"""Sous-catégories créées dans le catalogue v6.2 (absentes du catalogue v5, qui n'est pas modifié).

Créées le 26/11/2026 à la demande du porteur du projet. Avant la création, on a vérifié qu'aucune sous-catégorie
ni variante existante ne les couvrait : seules existent CAR-BAC (bac standard), BAG-VALISE, BAG-VALISE-GRANDE et
les variantes de taille de la valise.
Leur volume de déménagement est une convention commerciale validée (enrichir.py, CONVENTIONS_VALIDEES). Leur volume
géométrique est l'estimation d'un modèle type (estimations_ia.py) : une indication, pas une mesure.
"""

NOUVELLES = [
    {"identifiant": "CAR-BAC-GRAND", "nom": "Grand bac de rangement", "famille_id": "CAR", "famille": "Cartons, bacs et emballages",
     "synonymes": ["grande caisse de rangement", "grand bac plastique"], "description_physique": "Grand bac ou caisse de rangement à couvercle, environ 100 à 150 L.",
     "caracteristiques_discriminantes": "nettement plus grand qu'un bac standard (plus de 80 cm de long environ)", "niveau_pertinence": 1,
     "pertinence": "1 — courant", "demontable_ou_pliable": "non", "empilable": "oui"},
    {"identifiant": "BAG-VALISE-TRES-GRANDE", "nom": "Très grande valise", "famille_id": "BAG", "famille": "Bagages",
     "synonymes": ["valise XL", "valise de voyage longue durée"], "description_physique": "Valise de soute de très grande taille (environ 80 cm et plus de hauteur).",
     "caracteristiques_discriminantes": "plus haute qu'une grande valise de soute", "niveau_pertinence": 2,
     "pertinence": "2 — fréquent", "demontable_ou_pliable": "non", "empilable": "non"},
]


def references_v62(familles_v5):
    """Références au format du catalogue v5, sans mesures (aucune n'existe)."""
    res = []
    for n in NOUVELLES:
        r = dict(n)
        r["famille"] = familles_v5.get(n["famille_id"], n["famille"])
        r.update({"variante_de": "", "couverture_dimensions": "aucune", "produits_utilises": [], "produits_exclus": [],
                  "volume_geometrique_median_m3": None, "volume_demenagement_reference_m3": None, "volume_demenagement_origine": "",
                  "nb_modeles_independants": 0, "nb_modeles_exclus_aberrants": 0, "dimensions_partielles": {}, "mesurabilite": "mesurable",
                  "avertissement_volume": "", "creee_en": "v6.2"})
        res.append(r)
    return res
