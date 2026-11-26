"""Inventaires TYPES servant à mesurer la couverture commerciale du catalogue (v6).

Ce ne sont PAS des inventaires de déménagements réels : aucun inventaire pilote n'existe encore. Ils ont été
composés par l'assistant à partir de logements français courants, pour estimer la part du volume qu'un
inventaire ordinaire peut calculer avec le catalogue. Il faudra les remplacer par les inventaires des
déménageurs pilotes (objectif 6). Les cartons sont exclus : le client en déclare le nombre.
"""

NATURE = "inventaire type construit par l'IA (non réel)"

INVENTAIRES = {
    "studio / T1 meublé simplement": {"nature": NATURE, "objets": [
        ("CAN-CONV", 1), ("TAB-BASSE", 1), ("RAN-MEUBLE-TV", 1), ("INF-TV-43", 1), ("LIT-DOUBLE", 1), ("MAT-140", 1),
        ("ARM-2P", 1), ("CHV-STD", 1), ("TAB-4", 1), ("CHA-REPAS", 2), ("ELM-REF-TOP", 1), ("ELM-MO", 1), ("ELM-LL", 1),
        ("RAN-BIB-NC", 1), ("BUR-DROIT", 1), ("FAU-BUR", 1), ("DEC-LAMPADAIRE", 1), ("DEC-MIROIR-GRAND", 1), ("PEM-ASPI", 1),
        ("BAG-VALISE", 2), ("VEL-ADULTE", 1)]},
    "T3 familial (2 chambres)": {"nature": NATURE, "objets": [
        ("CAN-3P", 1), ("FAU-STD", 1), ("TAB-BASSE", 1), ("RAN-MEUBLE-TV", 1), ("INF-TV-55", 1), ("RAN-BUFFET", 1), ("RAN-BIB-NC", 1),
        ("TAB-6", 1), ("CHA-REPAS", 6), ("DEC-TAPIS-NC", 2), ("DEC-LAMPADAIRE", 1), ("DEC-PLANTE", 2),
        ("LIT-QUEEN", 1), ("MAT-160", 1), ("SOM-STD", 1), ("ARM-3P", 1), ("COM-NC", 1), ("CHV-STD", 2), ("DEC-MIROIR-GRAND", 1),
        ("LIT-SIMPLE", 1), ("MAT-90", 1), ("ARM-2P", 1), ("BUR-DROIT", 1), ("FAU-BUR", 1), ("ETA-NC", 1), ("ENF-COFFRE", 1),
        ("ELM-REF-COMBI", 1), ("ELM-LL", 1), ("ELM-LV", 1), ("ELM-CUISINIERE", 1), ("ELM-MO", 1), ("CUI-DESSERTE", 1),
        ("ENT-CHAUSS", 1), ("PEM-ASPI", 1), ("BAG-VALISE", 3), ("VEL-ADULTE", 2), ("ENF-POUSSETTE", 1), ("ETA-METAL", 1)]},
    "maison 5 pièces avec garage et jardin": {"nature": NATURE, "objets": [
        ("CAN-ANG", 1), ("FAU-STD", 2), ("TAB-BASSE", 1), ("RAN-MEUBLE-TV", 1), ("INF-TV-75", 1), ("RAN-BUFFET", 1), ("RAN-VITRINE", 1),
        ("RAN-BIB-NC", 2), ("TAB-8+", 1), ("CHA-REPAS", 8), ("DEC-TAPIS-NC", 3), ("DEC-PLANTE", 3), ("DEC-TABLEAU", 6), ("DEC-LAMPADAIRE", 2),
        ("MUS-PIANO-DROIT", 1), ("LIT-KING", 1), ("MAT-180", 1), ("SOM-STD", 2), ("ARM-4P", 1), ("COM-NC", 2), ("CHV-STD", 4), ("COM-COIFF", 1),
        ("LIT-DOUBLE", 1), ("MAT-140", 1), ("ARM-2P", 1), ("LIT-SUPERP", 1), ("MAT-90", 3), ("LIT-SIMPLE", 1), ("ARM-3P", 1),
        ("BUR-DROIT", 2), ("BUR-ANGLE", 1), ("FAU-BUR", 3), ("ETA-NC", 2), ("ENF-COFFRE", 2), ("INF-ORDI", 2),
        ("ELM-REF-US", 1), ("ELM-CONG", 1), ("ELM-LL", 1), ("ELM-SL", 1), ("ELM-LV", 1), ("ELM-CUISINIERE", 1), ("ELM-MO", 1),
        ("CUI-DESSERTE", 1), ("CHA-BAR", 3), ("ENT-CHAUSS", 1), ("ENT-PORTEMANTEAU", 1), ("PEM-ASPI", 1),
        ("JAR-SALON", 1), ("JAR-BARBECUE", 1), ("JAR-TONDEUSE", 1), ("JAR-TRANSAT", 2), ("JAR-PARASOL", 1), ("JAR-JARDINIERE", 4),
        ("BRI-ETABLI", 1), ("ETA-METAL", 3), ("BRI-ECHELLE", 1), ("VEL-ADULTE", 4), ("VEL-ENFANT", 2), ("SPO-VELO-APPART", 1),
        ("SPO-TRAMPOLINE", 1), ("BAG-VALISE", 4), ("CAR-BAC", 10)]},
}
