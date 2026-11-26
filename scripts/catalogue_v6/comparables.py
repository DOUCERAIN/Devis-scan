"""Sous-catégories comparables (catalogue v6) : proposition PROVISOIRE de volume de déménagement.

Quand une sous-catégorie n'a pas au moins deux relevés de déménageurs, on part de celle, de même nature,
qui en a. Deux modes :
- « proportion » : volume de déménagement de la comparable × (géométrique de la sous-catégorie /
  géométrique de la comparable) ;
- « facteur » : volume de déménagement de la comparable × un facteur fixe, justifié ici.

Ce mode est préféré à l'analogie de classe quand le volume géométrique mesuré est jugé peu
représentatif (lits mesurés avec leurs têtes ou leurs coffres, objets mesurés montés). Tout est à
valider par les déménageurs pilotes.
"""

COMPARABLES = {
    # v6.2 : bacs et valises ont leurs propres conventions validées (enrichir.py, CONVENTIONS_VALIDEES).
    # v6.1 — alignement sur la convention Démén'House : utilisés quand la seule valeur professionnelle disponible
    # vient d'une source dont la convention est manifestement différente (conventions_sources.csv).
    "LIT-QUEEN": ("LIT-DOUBLE", "facteur", 1.15, "lit 160 au lieu de 140 cm de large (convention « lit complet »)"),
    "ARM-2P": ("ARM-4P", "proportion", None, "armoire, proportion des géométriques mesurés"),
    "ARM-3P": ("ARM-4P", "proportion", None, "armoire, proportion des géométriques mesurés"),
    "CAN-ANG": ("CAN-3P", "proportion", None, "canapé, proportion des géométriques mesurés"),
    "CAN-CONV": ("CAN-3P", "proportion", None, "canapé, proportion des géométriques mesurés"),
    "TAB-6": ("TAB-REPAS-NC", "proportion", None, "table à manger, proportion des géométriques"),
    "TAB-4": ("TAB-REPAS-NC", "proportion", None, "table à manger, proportion des géométriques"),
    "MAT-140": ("MAT-160", "proportion", None, "matelas, proportion des géométriques (formadem.com : convention plus basse)"),
    "RAN-BIB-HAUTE": ("RAN-BIB-NC", "proportion", None, "bibliothèque, proportion des géométriques mesurés"),
    "RAN-BIB-BASSE": ("RAN-BIB-NC", "proportion", None, "bibliothèque, proportion des géométriques mesurés"),
    "ARM-COUL": ("ARM-4P", "proportion", None, "grande armoire, proportion des géométriques mesurés"),
    # id: (comparable, mode, facteur, justification)
    "LIT-KING": ("LIT-QUEEN", "facteur", 1.15, "180 cm au lieu de 160 cm de large ; géométrique mesuré jugé non représentatif (tête de lit, ensembles)"),
    "LIT-COFFRE": ("LIT-QUEEN", "facteur", 1.3, "lit 140/160 à coffre : le coffre ne se démonte pas ; géométrique mesuré (4,36 m³) non représentatif"),
    "LIT-NC": ("LIT-DOUBLE", "facteur", 1.0, "taille non précisée : lit double par défaut ; géométrique mesuré (4,38 m³) non représentatif"),
    "LIT-GIGOGNE": ("LIT-SIMPLE", "facteur", 1.6, "lit simple et second couchage sous le lit"),
    "LIT-SUPERP": ("LIT-SIMPLE", "facteur", 2.0, "deux couchages simples complets"),
    "LIT-BALDAQUIN": ("LIT-QUEEN", "facteur", 1.4, "lit double et montants, ciel de lit démontés"),
    "CAN-NC": ("CAN-3P", "facteur", 1.0, "nombre de places non précisé : canapé 3 places par défaut"),
    "CAN-2P": ("CAN-3P", "proportion", None, "même construction, proportion des volumes géométriques mesurés"),
    "CAN-4P": ("CAN-3P", "proportion", None, "proportion avec le géométrique estimé du 4 places"),
    "CAN-5P": ("CAN-3P", "proportion", None, "proportion avec le géométrique estimé du 5 places"),
    "CAN-RELAX": ("CAN-3P", "proportion", None, "canapé à mécanisme, proportion des géométriques"),
    "CAN-MOD": ("CAN-ANG", "facteur", 1.0, "canapé modulable : ordre de grandeur d'un canapé d'angle"),
    "CAN-PANO": ("CAN-ANG", "facteur", 1.5, "canapé en U : un canapé d'angle et un module supplémentaire"),
    "COM-3T": ("COM-NC", "proportion", None, "commode, proportion des géométriques mesurés"),
    "COM-4T": ("COM-NC", "proportion", None, "commode, proportion des géométriques mesurés"),
    "COM-5T": ("COM-NC", "proportion", None, "commode, proportion des géométriques mesurés"),
    "COM-LARGE": ("COM-NC", "proportion", None, "commode, proportion des géométriques mesurés"),
    "TAB-8+": ("TAB-REPAS-NC", "proportion", None, "table à manger, proportion des géométriques"),
    "INF-TV-75": ("INF-TV-55", "facteur", 1.4, "surface d'écran 1,85 fois plus grande, épaisseur et emballage comparables"),
    "MAT-90": ("MAT-140", "proportion", None, "matelas, proportion des géométriques"),
    "MAT-180": ("MAT-160", "proportion", None, "matelas, proportion des géométriques"),
    "MAT-NC": ("MAT-140", "facteur", 1.0, "taille non précisée : matelas 140 par défaut"),
    "ELM-REF-1P": ("ELM-REF", "proportion", None, "réfrigérateur, proportion des géométriques"),
    "ELM-REF-TOP": ("ELM-REF", "proportion", None, "réfrigérateur, proportion des géométriques"),
    "ELM-REF-MULTI": ("ELM-REF-US", "proportion", None, "réfrigérateur grand format, proportion des géométriques estimés"),
    "ELM-LAVANTE-SECHANTE": ("ELM-LL", "facteur", 1.0, "même format qu'un lave-linge"),
    "ARM-1P": ("ARM-2P", "proportion", None, "armoire, proportion des géométriques mesurés"),
    "ARM-5P+": ("ARM-4P", "proportion", None, "armoire, proportion des géométriques mesurés"),
    "ARM-ANG": ("ARM-3P", "facteur", 1.0, "armoire d'angle : ordre de grandeur d'une 3 portes"),
}
