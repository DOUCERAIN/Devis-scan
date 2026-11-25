#!/usr/bin/env python3
"""
Construction du catalogue mobilier Devis Scan.

Sources (voir docs/catalogue-sources.md) :
  - ABO : Amazon Berkeley Objects (CC BY 4.0, crédit « Amazon.com »). Seules les
    MÉTADONNÉES produits (abo-listings.tar) sont utilisées : dimensions et poids des
    produits correspondant à chaque référence → statistiques p10 / médiane / p90.
  - PROTO : table de volumes du prototype Devis Scan (prototype/index.html),
    propriété du porteur du projet, origine non documentée → « référence interne
    non vérifiée ».
  - DS : taxonomie, noms, synonymes, règles de correspondance et coefficients de
    manutention définis par Devis Scan (hypothèses documentées, à calibrer).

Aucune donnée n'est inventée : une référence sans dimension ABO ni volume interne
garde des volumes vides (à renseigner par le déménageur).

Usage :
  python3 scripts/catalog/build_catalog.py /chemin/vers/abo/listings/metadata
Sortie : data/catalog/catalog.json (catalogue) et data/catalog/abo-provenance.json
(identifiants ABO utilisés par référence, pour la traçabilité de l'attribution).
"""
import gzip, json, glob, re, sys, os, statistics, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = {"inches": 2.54, "centimeters": 1, "millimeters": 0.1, "feet": 30.48, "meters": 100}
W = {"pounds": 0.4536, "kilograms": 1, "grams": 0.001, "ounces": 0.02835}

# Coefficients de manutention (volume de déménagement = volume géométrique × coefficient)
# utilisés UNIQUEMENT quand aucun volume de référence interne n'existe.
# Hypothèses Devis Scan, à calibrer avec des déménageurs.
HANDLING = {
    "rigide": (1.10, "meuble rigide transporté monté, + protection"),
    "rembourre": (1.15, "meuble rembourré, + housse et calage"),
    "empilable": (0.70, "objet empilable ou imbriquable"),
    "demontable": (0.45, "meuble transporté démonté (éléments à plat)"),
    "fragile": (1.30, "objet fragile emballé (carton, papier bulle)"),
}

# Volumes du prototype (m³ de déménagement) — reprise telle quelle.
PROTO = {
    "Canapé 2 places": 1.0, "Canapé 3 places": 1.5, "Méridienne": 0.8, "Fauteuil": 0.5,
    "Lit double 140": 1.2, "Lit double 160": 1.4, "Lit simple": 0.8, "Sommier": 0.3,
    "Matelas double": 0.5, "Matelas simple": 0.3, "Armoire 1 porte": 0.5, "Armoire 2 portes": 0.8,
    "Grande armoire": 1.2, "Commode": 0.5, "Table de nuit": 0.1, "Bureau": 0.6, "Chaise de bureau": 0.3,
    "Table repas": 0.5, "Chaise": 0.15, "Table basse": 0.3, "Bibliothèque": 0.6, "Étagère": 0.3,
    "Télévision": 0.2, "Réfrigérateur": 0.4, "Congélateur": 0.4, "Lave-linge": 0.3, "Sèche-linge": 0.3,
    "Lave-vaisselle": 0.3, "Machine à café": 0.05, "Micro-ondes": 0.05, "Piano droit": 2.5,
    "Piano à queue": 5.0, "Coffre-fort": 0.8, "Vélo": 0.5, "Vélo fitness": 1.0, "Cartons (×10)": 1.0,
}

CATEGORIES = {
    "salon": "Salon et séjour", "chambre": "Chambres", "cuisine": "Cuisine", "salle_de_bain": "Salle de bain",
    "bureau": "Bureau", "entree": "Entrée et couloirs", "garage_cave": "Garage et cave",
    "jardin": "Jardin et extérieur", "sport_loisirs": "Sport et loisirs", "electromenager": "Électroménager",
    "cartons": "Cartons et emballages", "volumineux": "Autres objets volumineux",
}

def R(node=".", inc=".", exc=None, pt=None, width=None, vol=None):
    """Règle de sélection ABO : chemin de catégorie, nom (inclus/exclu), type produit, bornes."""
    return dict(node=node, inc=inc, exc=exc, pt=pt, width=width, vol=vol)

COVER = r"cover|slipcover|cushion|pad\b|pads\b|replacement|parts?\b|hardware|leg(s)?\b|caster|protector|sheet|pillow"

# id, nom, catégorie, sous-catégorie, synonymes, classe COCO, manutention, lourd, règle ABO, volume interne (clé PROTO)
E = [
    # ---------------- Salon et séjour ----------------
    ("canape-2-places", "Canapé 2 places", "salon", "Canapés", ["loveseat", "petit canapé", "canapé deux places"], "couch", "rembourre", False,
     R(r"Sofas", r"loveseat|2[- ]seat|two[- ]seat|sofa|couch", COVER + r"|sectional|sleeper|futon|bed|ottoman|chair", width=(120, 175)), "Canapé 2 places"),
    ("canape-3-places", "Canapé 3 places", "salon", "Canapés", ["sofa", "canapé trois places"], "couch", "rembourre", False,
     R(r"Sofas", r"sofa|couch", COVER + r"|sectional|sleeper|futon|bed|ottoman|chair|loveseat", width=(175, 235)), "Canapé 3 places"),
    ("canape-4-places", "Canapé 4 places", "salon", "Canapés", ["grand canapé", "canapé quatre places"], "couch", "rembourre", False,
     R(r"Sofas", r"sofa|couch", COVER + r"|sectional|sleeper|futon|bed|ottoman|chair|loveseat", width=(235, 320)), None),
    ("canape-angle", "Canapé d'angle", "salon", "Canapés", ["canapé en L", "sectional", "canapé modulable"], "couch", "rembourre", False,
     R(r"Sofas", r"sectional|l-shape|corner|modular", COVER, width=(150, 400)), None),
    ("canape-convertible", "Canapé convertible", "salon", "Canapés", ["canapé-lit", "clic-clac", "BZ", "futon"], "couch", "rembourre", False,
     R(r"Sofas|Futon", r"sleeper|futon|sofa bed|convertible|click.?clack", COVER + r"|mattress", width=(100, 260)), None),
    ("canape-panoramique", "Canapé panoramique", "salon", "Canapés", ["canapé en U", "grand canapé d'angle"], "couch", "rembourre", False,
     # ABO « sectional » : surtout de petits canapés d'angle (largeur médiane 2,24 m), non représentatifs d'un canapé en U.
     R(".", r"u-shape|u shaped|panoramic", COVER, pt=["SOFA"], width=(280, 500)), None),
    ("meridienne", "Méridienne", "salon", "Canapés", ["chaise longue", "lit de repos", "chaise lounge"], "couch", "rembourre", False,
     R(r"Sofas|Chaise|Chairs", r"chaise lounge|chaise longue|daybed|fainting couch", COVER), "Méridienne"),
    ("fauteuil", "Fauteuil", "salon", "Fauteuils", ["fauteuil club", "bergère", "armchair"], "chair", "rembourre", False,
     R(r"Living Room Furniture/Chairs", r"chair|armchair", COVER + r"|recliner|set of|swivel|rocking|kids|bean", width=(50, 120)), "Fauteuil"),
    ("fauteuil-relax", "Fauteuil relax", "salon", "Fauteuils", ["fauteuil inclinable", "recliner", "fauteuil releveur"], "chair", "rembourre", False,
     R(r"Chairs", r"recliner", COVER + r"|kids|youth", width=(60, 120)), None),
    ("fauteuil-pivotant", "Fauteuil pivotant", "salon", "Fauteuils", ["fauteuil tournant"], "chair", "rembourre", False,
     R(r"Living Room Furniture/Chairs", r"swivel", COVER + r"|bar|stool|office|desk", width=(50, 120)), None),
    ("rocking-chair", "Rocking-chair", "salon", "Fauteuils", ["fauteuil à bascule"], "chair", "rigide", False,
     R(r"Chairs", r"rocking|rocker", COVER + r"|kids|baby|toy"), None),
    ("pouf", "Pouf", "salon", "Poufs et repose-pieds", ["repose-pieds", "ottoman"], None, "rembourre", False,
     R(r"Ottomans", r"ottoman|pouf|footstool", COVER + r"|storage bench", width=(25, 110)), None),
    ("pouf-poire", "Pouf poire", "salon", "Poufs et repose-pieds", ["bean bag", "pouf géant"], None, "rembourre", False,
     R(r"Filled Bean Bags", r"bean", None), None),
    ("table-basse", "Table basse", "salon", "Tables", ["table de salon"], "dining table", "rigide", False,
     R(r"Coffee Tables", r"table", r"cloth|runner|book\b", width=(50, 160)), "Table basse"),
    ("bout-de-canape", "Bout de canapé", "salon", "Tables", ["table d'appoint", "guéridon", "sellette"], "dining table", "rigide", False,
     R(r"End Tables", r"table", r"cloth|lamp", width=(25, 90)), None),
    ("console", "Console", "salon", "Tables", ["table console", "console d'entrée"], "dining table", "rigide", False,
     R(r"Console Tables", r"table|console", None, width=(60, 200)), None),
    ("meuble-tv", "Meuble TV", "salon", "Meubles de rangement", ["banc TV", "meuble télé", "meuble hi-fi"], None, "rigide", False,
     R(r"Television Stands|Media Storage", r".", r"mount|bracket", width=(60, 250)), None),
    ("buffet-bas", "Buffet bas", "salon", "Meubles de rangement", ["enfilade", "bahut", "sideboard"], None, "rigide", False,
     R(r".", r"sideboard|buffet|credenza", r"lamp|server tray|cabinet hardware", width=(80, 220)), None),
    ("bibliotheque", "Bibliothèque", "salon", "Meubles de rangement", ["étagère haute", "bookcase"], None, "demontable", False,
     R(r"Bookcases", r".", r"bookend", width=(50, 200)), "Bibliothèque"),
    ("vitrine", "Vitrine", "salon", "Meubles de rangement", ["vaisselier", "meuble vitré"], None, "fragile", False,
     R(r".", r"curio|display cabinet|china cabinet|glass cabinet", r"light|knob"), None),
    ("tapis", "Tapis", "salon", "Décoration", ["tapis roulé"], None, "empilable", False, None, None),
    ("lampadaire", "Lampadaire", "salon", "Luminaires", ["lampe sur pied", "liseuse"], None, "fragile", False,
     R(r"Floor Lamps", r"lamp", r"bulb|shade only", width=(20, 200)), None),
    ("lampe-a-poser", "Lampe à poser", "salon", "Luminaires", ["lampe de chevet", "lampe de table"], None, "fragile", False,
     R(r"Table Lamps", r"lamp", r"bulb|shade only", width=(10, 80)), None),
    ("miroir-mural", "Miroir", "salon", "Décoration", ["grand miroir", "miroir sur pied"], None, "fragile", False,
     R(".", r"mirror", r"car\b|compact|makeup|vanity|led\b|lighted", pt=["HOME_MIRROR"], width=(40, 200)), None),
    ("tableau-cadre", "Tableau ou cadre", "salon", "Décoration", ["toile", "cadre", "affiche encadrée"], None, "fragile", False,
     R(r"Wall Art|Frames", r"canvas|print|frame|art", r"tabletop|set of|album|4x6|5x7", width=(40, 200)), None),
    ("television", "Télévision", "salon", "Audio et vidéo", ["TV", "écran plat", "téléviseur"], "tv", "fragile", False,
     R(r".", r"\btv\b|television", r"stand|mount|console|cabinet|unit|bracket|antenna|remote|cable|table|box|stick", width=(60, 200)), "Télévision"),
    ("enceinte-colonne", "Enceinte colonne", "salon", "Audio et vidéo", ["haut-parleur colonne", "chaîne hi-fi"], None, "fragile", False, None, None),
    ("piano-droit", "Piano droit", "volumineux", "Instruments", ["piano"], None, "rigide", True, None, "Piano droit"),
    ("piano-a-queue", "Piano à queue", "volumineux", "Instruments", ["piano de concert", "crapaud"], None, "rigide", True, None, "Piano à queue"),
    ("piano-numerique", "Piano numérique", "volumineux", "Instruments", ["clavier sur meuble"], None, "fragile", False, None, None),
    ("aquarium", "Aquarium", "volumineux", "Divers", ["meuble aquarium"], None, "fragile", True, None, None),
    ("coffre-fort", "Coffre-fort", "volumineux", "Divers", ["armoire forte"], None, "rigide", True, None, "Coffre-fort"),
    ("horloge-comtoise", "Horloge comtoise", "volumineux", "Divers", ["horloge de parquet"], "clock", "fragile", True, None, None),
    ("plante-grande", "Grande plante en pot", "salon", "Décoration", ["plante d'intérieur", "palmier en pot"], "potted plant", "fragile", False, None, None),

    # ---------------- Salle à manger / cuisine ----------------
    ("table-a-manger-4", "Table à manger 4 personnes", "cuisine", "Tables", ["table de cuisine", "petite table"], "dining table", "demontable", False,
     R(r"Dining Room Furniture/Tables|Kitchen & Dining", r"table", r"cloth|runner|mat|set\b|chairs", width=(70, 140)), "Table repas"),
    ("table-a-manger-6", "Table à manger 6 personnes", "cuisine", "Tables", ["table de salle à manger"], "dining table", "demontable", False,
     R(r"Dining Room Furniture/Tables", r"table", r"cloth|runner|mat|chairs", width=(140, 190)), None),
    ("table-a-manger-8", "Table à manger 8 personnes et plus", "cuisine", "Tables", ["grande table", "table de ferme"], "dining table", "demontable", False,
     R(r"Dining Room Furniture/Tables", r"table", r"cloth|runner|mat|chairs", width=(190, 320)), None),
    ("chaise", "Chaise", "cuisine", "Chaises", ["chaise de salle à manger", "chaise de cuisine"], "chair", "empilable", False,
     R(r"Dining Room Furniture/Chairs", r"chair", COVER + r"|set of (4|6)|bench", width=(35, 75)), "Chaise"),
    ("tabouret-de-bar", "Tabouret de bar", "cuisine", "Chaises", ["tabouret haut", "chaise de bar"], "chair", "empilable", False,
     R(r"Barstools", r"stool", COVER + r"|set of", width=(30, 75)), None),
    ("tabouret", "Tabouret", "cuisine", "Chaises", ["petit tabouret", "repose-pieds"], "chair", "empilable", False,
     R(r"Stools|Ottomans", r"step stool|stool", COVER + r"|bar|counter|set of", width=(20, 60)), None),
    ("banc-de-table", "Banc de table", "cuisine", "Chaises", ["banc de salle à manger"], "bench", "rigide", False,
     R(r"Dining|Bench", r"bench", COVER + r"|storage|shoe|weight|piano", width=(80, 200)), None),
    ("desserte-cuisine", "Desserte de cuisine", "cuisine", "Rangements", ["îlot de cuisine", "chariot de cuisine"], None, "rigide", False,
     R(r".", r"kitchen cart|kitchen island|serving cart|utility cart", None, width=(40, 150)), None),
    ("buffet-cuisine", "Buffet de cuisine", "cuisine", "Rangements", ["meuble de cuisine indépendant", "garde-manger"], None, "rigide", False,
     R(r".", r"pantry cabinet|kitchen pantry|kitchen hutch|storage cabinet", r"organizer|bin|basket|shelf liner", width=(50, 150)), None),
    ("etagere-cuisine", "Étagère de cuisine", "cuisine", "Rangements", ["étagère à micro-ondes", "baker's rack"], None, "demontable", False,
     R(r".", r"baker.?s rack|microwave cart|kitchen shelf|kitchen rack", r"spice|dish rack|drying", width=(40, 150)), None),
    ("refrigerateur", "Réfrigérateur", "electromenager", "Froid", ["frigo", "réfrigérateur combiné"], "refrigerator", "rigide", True, None, "Réfrigérateur"),
    ("refrigerateur-americain", "Réfrigérateur américain", "electromenager", "Froid", ["frigo américain", "side-by-side"], "refrigerator", "rigide", True, None, None),
    ("refrigerateur-top", "Réfrigérateur top", "electromenager", "Froid", ["petit frigo", "frigo table top", "mini-frigo"], "refrigerator", "rigide", False, None, None),
    ("congelateur", "Congélateur", "electromenager", "Froid", ["congélateur armoire", "congélateur coffre"], "refrigerator", "rigide", True, None, "Congélateur"),
    ("cave-a-vin", "Cave à vin", "electromenager", "Froid", ["armoire à vin"], "refrigerator", "rigide", True, None, None),
    ("lave-linge", "Lave-linge", "electromenager", "Lavage", ["machine à laver"], None, "rigide", True, None, "Lave-linge"),
    ("seche-linge", "Sèche-linge", "electromenager", "Lavage", ["séchoir électrique"], None, "rigide", True, None, "Sèche-linge"),
    ("lave-vaisselle", "Lave-vaisselle", "electromenager", "Lavage", [], None, "rigide", True, None, "Lave-vaisselle"),
    ("four", "Four", "electromenager", "Cuisson", ["four encastrable", "four indépendant"], "oven", "rigide", False, None, None),
    ("cuisiniere", "Cuisinière", "electromenager", "Cuisson", ["piano de cuisson", "gazinière"], "oven", "rigide", True, None, None),
    ("micro-ondes", "Micro-ondes", "electromenager", "Cuisson", ["four à micro-ondes"], "microwave", "fragile", False, None, "Micro-ondes"),
    ("petit-electromenager", "Petit électroménager", "electromenager", "Petit électroménager", ["machine à café", "robot", "grille-pain"], None, "fragile", False, None, "Machine à café"),

    # ---------------- Chambres ----------------
    ("lit-simple", "Lit simple", "chambre", "Lits", ["lit une place", "lit 90", "lit enfant"], "bed", "demontable", False,
     R(r"Beds|Bed Frames", r"twin|single", COVER + r"|bunk|loft|daybed|headboard|sofa|toddler", pt=["BED"], width=(85, 130)), "Lit simple"),
    ("lit-double", "Lit double", "chambre", "Lits", ["lit 140", "lit deux places"], "bed", "demontable", False,
     R(r"Beds|Bed Frames", r"\bfull\b|double", COVER + r"|bunk|loft|headboard|sofa", pt=["BED"], width=(130, 175)), "Lit double 140"),
    ("lit-queen-size", "Lit queen size", "chambre", "Lits", ["lit 160", "grand lit"], "bed", "demontable", False,
     R(r"Beds|Bed Frames", r"queen", COVER + r"|headboard only|bunk|sofa", pt=["BED"]), "Lit double 160"),
    ("lit-king-size", "Lit king size", "chambre", "Lits", ["lit 180", "lit 200"], "bed", "demontable", False,
     R(r"Beds|Bed Frames", r"\bking", COVER + r"|headboard only|bunk|sofa", pt=["BED"]), None),
    ("lit-superpose", "Lit superposé", "chambre", "Lits", ["lits superposés", "lit mezzanine"], "bed", "demontable", False,
     R(r".", r"bunk bed|loft bed", COVER), None),
    ("lit-coffre", "Lit avec rangement", "chambre", "Lits", ["lit coffre", "lit à tiroirs"], "bed", "demontable", False,
     R(r"Beds", r"storage bed|platform bed with (storage|drawers)|drawers bed|bed with (storage|drawers)", COVER + r"|bedside|nightstand", pt=["BED"]), None),
    ("lit-bebe", "Lit bébé", "chambre", "Lits", ["lit à barreaux", "berceau"], "bed", "demontable", False, None, None),
    ("tete-de-lit", "Tête de lit", "chambre", "Lits", ["headboard"], None, "rigide", False,
     R(r"Headboards", r"headboard", COVER, pt=["HEADBOARD"], width=(80, 220)), None),
    ("sommier", "Sommier", "chambre", "Literie", ["sommier à lattes", "box spring"], "bed", "rigide", False, None, "Sommier"),
    ("matelas-simple", "Matelas une place", "chambre", "Literie", ["matelas 90", "matelas enfant"], "bed", "rembourre", False, None, "Matelas simple"),
    ("matelas-double", "Matelas deux places", "chambre", "Literie", ["matelas 140", "matelas 160", "matelas 180"], "bed", "rembourre", False, None, "Matelas double"),
    ("table-de-chevet", "Table de chevet", "chambre", "Rangements", ["table de nuit", "chevet"], None, "rigide", False,
     R(r"Nightstands", r".", None, width=(30, 80)), "Table de nuit"),
    ("commode", "Commode", "chambre", "Rangements", ["chiffonnier", "semainier", "dresser"], None, "rigide", False,
     R(r"Dressers|Chest of Drawers", r".", r"knob|pull|mirror only", width=(40, 200)), "Commode"),
    ("armoire-1-porte", "Armoire 1 porte", "chambre", "Armoires", ["penderie étroite", "bonnetière"], None, "demontable", False, None, "Armoire 1 porte"),
    ("armoire-2-portes", "Armoire 2 portes", "chambre", "Armoires", ["penderie", "garde-robe"], None, "demontable", False,
     R(r"Wardrobe|Armoire", r"wardrobe|armoire|closet", r"hanger|organizer|bag|cover|hook|rod|shelf divider", width=(70, 130)), "Armoire 2 portes"),
    ("armoire-3-portes", "Armoire 3 portes", "chambre", "Armoires", ["grande armoire"], None, "demontable", False,
     R(r"Wardrobe|Armoire", r"wardrobe|armoire", r"hanger|organizer|bag|cover|hook|rod", width=(130, 170)), None),
    ("armoire-4-portes", "Armoire 4 portes", "chambre", "Armoires", ["très grande armoire"], None, "demontable", False,
     R(r"Wardrobe|Armoire", r"wardrobe|armoire", r"hanger|organizer|bag|cover|hook|rod", width=(170, 260)), "Grande armoire"),
    ("armoire-basse", "Armoire basse", "chambre", "Armoires", ["meuble bas à portes"], None, "rigide", False,
     R(r".", r"storage cabinet|accent cabinet", r"organizer|medicine|file|bathroom|wall", width=(60, 160)), None),
    ("dressing", "Dressing", "chambre", "Armoires", ["système de penderie", "rangement de placard"], None, "demontable", False,
     None, None),
    ("portant-vetements", "Portant à vêtements", "chambre", "Armoires", ["penderie mobile"], None, "demontable", False,
     R(r".", r"garment rack|clothes rack|clothing rack", r"hanger"), None),
    ("coiffeuse", "Coiffeuse", "chambre", "Rangements", ["table de maquillage"], None, "rigide", False,
     R(r".", r"vanity (table|desk|set)|makeup (table|desk)|dressing table", r"mirror only|light|stool only"), None),
    ("coffre-a-jouets", "Coffre à jouets", "chambre", "Rangements", ["malle", "coffre de rangement"], None, "rigide", False,
     R(r"Storage Boxes|Toy", r"toy (box|chest)|storage chest|trunk", r"bag|bin\b"), None),
    ("bureau-enfant", "Bureau enfant", "chambre", "Enfants", ["table d'activité enfant"], "dining table", "rigide", False,
     R(r"Kids' Furniture", r"desk|table", COVER), None),
    ("chaise-enfant", "Chaise enfant", "chambre", "Enfants", ["fauteuil enfant"], "chair", "empilable", False,
     R(r"Kids' Furniture/Chairs", r"chair", COVER), None),

    # ---------------- Salle de bain ----------------
    ("meuble-vasque", "Meuble sous-vasque", "salle_de_bain", "Meubles", ["meuble de salle de bain"], "sink", "rigide", False,
     R(r"Bathroom", r"vanity|sink cabinet", r"light|mirror|faucet|top only", width=(40, 160)), None),
    ("colonne-salle-de-bain", "Colonne de salle de bain", "salle_de_bain", "Meubles", ["meuble colonne"], None, "rigide", False,
     R(r"Bathroom", r"linen (tower|cabinet)|tall cabinet|storage tower", r"organizer|caddy"), None),
    ("etagere-salle-de-bain", "Étagère de salle de bain", "salle_de_bain", "Meubles", ["étagère au-dessus des toilettes"], None, "demontable", False,
     R(r"Bathroom", r"over.the.toilet|bathroom (shelf|shelves|rack)", r"caddy|suction"), None),
    ("panier-a-linge", "Panier à linge", "salle_de_bain", "Accessoires", ["coffre à linge"], None, "empilable", False,
     R(r"Laundry", r"hamper|laundry basket", r"bag\b|pop-up"), None),

    # ---------------- Bureau ----------------
    ("bureau", "Bureau", "bureau", "Bureaux", ["table de bureau", "bureau droit"], "dining table", "demontable", False,
     R(r"Office Desks|Desks & Workstations/Desks", r"desk", r"organizer|lamp|mat|converter|riser|l-shaped|corner|standing", width=(80, 180)), "Bureau"),
    ("bureau-angle", "Bureau d'angle", "bureau", "Bureaux", ["bureau en L"], "dining table", "demontable", False,
     R(r"Desk", r"l-shaped|corner desk|l shape", r"organizer|mat|lamp"), None),
    ("bureau-assis-debout", "Bureau assis-debout", "bureau", "Bureaux", ["bureau réglable en hauteur"], "dining table", "demontable", False,
     R(r"Desk", r"standing desk|height adjustable|sit.stand", r"converter|riser|mat"), None),
    ("chaise-de-bureau", "Chaise de bureau", "bureau", "Sièges", ["fauteuil de bureau", "siège de bureau"], "chair", "rigide", False,
     R(r"Office Chairs|Desk Chairs", r"chair", COVER + r"|mat\b", width=(45, 100)), "Chaise de bureau"),
    ("caisson-de-bureau", "Caisson de bureau", "bureau", "Rangements", ["caisson à tiroirs", "classeur à tiroirs"], None, "rigide", False,
     R(r".", r"file cabinet|filing cabinet|mobile pedestal", r"folder|hanging file|frame", width=(30, 120)), None),
    ("armoire-de-bureau", "Armoire de bureau", "bureau", "Rangements", ["armoire à dossiers", "armoire métallique"], None, "rigide", False,
     R(r".", r"office cabinet|storage cabinet with doors|metal cabinet|locking cabinet", r"key|organizer|wall"), None),
    ("etagere", "Étagère", "bureau", "Rangements", ["étagère basse", "rayonnage", "étagère cube"], None, "demontable", False,
     R(r"Bookcases|Shelves|Racks", r"shelf|shelving|cube|bookshelf", r"bracket|liner|divider|wall shelf|floating|bin\b|basket", width=(40, 180)), "Étagère"),
    ("imprimante", "Imprimante", "bureau", "Informatique", ["imprimante multifonction"], None, "fragile", False, None, None),
    ("ordinateur-fixe", "Ordinateur fixe et écran", "bureau", "Informatique", ["unité centrale", "PC fixe", "écran d'ordinateur"], "laptop", "fragile", False, None, None),

    # ---------------- Entrée et couloirs ----------------
    ("meuble-a-chaussures", "Meuble à chaussures", "entree", "Rangements", ["range-chaussures", "banc à chaussures"], None, "rigide", False,
     R(r".", r"shoe (rack|storage|cabinet|bench|organizer)", r"bag|over the door|hanging", width=(40, 150)), None),
    ("banc-entree", "Banc d'entrée", "entree", "Assises", ["banc coffre", "banc de rangement"], "bench", "rigide", False,
     R(r"Storage Benches|Entryway", r"bench", COVER, width=(60, 160)), None),
    ("portemanteau", "Portemanteau sur pied", "entree", "Rangements", ["vestiaire", "hall tree"], None, "demontable", False,
     R(r".", r"coat rack stand|standing coat rack|hall tree|coat tree", r"wall mount|hook"), None),
    ("meuble-d-entree", "Meuble d'entrée", "entree", "Rangements", ["console d'entrée avec tiroirs"], None, "rigide", False,
     R(r"Entryway", r"cabinet|console|table", COVER), None),

    # ---------------- Garage et cave ----------------
    ("etabli", "Établi", "garage_cave", "Atelier", ["table d'atelier"], None, "demontable", True,
     R(r".", r"workbench|work bench", r"light|vise|mat"), None),
    ("etagere-metallique", "Étagère métallique", "garage_cave", "Rangements", ["rayonnage métallique", "étagère de garage"], None, "demontable", False,
     R(r".", r"metal shelving|steel shelving|garage shelving|wire shelving|shelving unit", r"liner|bracket|hook", width=(60, 200)), None),
    ("armoire-de-garage", "Armoire de garage", "garage_cave", "Rangements", ["armoire métallique de garage"], None, "rigide", True, None, None),
    ("servante-outils", "Servante à outils", "garage_cave", "Atelier", ["coffre à outils roulant"], None, "rigide", True,
     R(r".", r"tool chest|rolling tool cabinet|tool cart", r"organizer tray|bag"), None),
    ("tondeuse", "Tondeuse à gazon", "jardin", "Outillage", ["tondeuse thermique", "tondeuse électrique"], None, "rigide", True, None, None),
    ("echelle", "Échelle ou escabeau", "garage_cave", "Atelier", ["escabeau"], None, "empilable", False,
     R(r".", r"ladder|step stool", r"hook|rack|bookshelf|decorative|blanket"), None),
    ("malle", "Malle", "garage_cave", "Rangements", ["coffre", "cantine"], "suitcase", "rigide", False,
     R(r".", r"\btrunk\b|footlocker|steamer", r"car|organizer"), None),
    ("valise", "Valise", "garage_cave", "Bagages", ["bagage", "valise cabine"], "suitcase", "empilable", False,
     R(r".", r"suitcase|luggage|carry-on|spinner", r"tag|strap|scale|cover|cube|organizer|lock", width=(30, 90)), None),

    # ---------------- Jardin et extérieur ----------------
    ("chaise-de-jardin", "Chaise de jardin", "jardin", "Mobilier de jardin", ["fauteuil de jardin", "chaise d'extérieur"], "chair", "empilable", False,
     R(r"Patio|Outdoor", r"chair", COVER + r"|set of|lounge", width=(40, 110)), None),
    ("table-de-jardin", "Table de jardin", "jardin", "Mobilier de jardin", ["table d'extérieur"], "dining table", "demontable", False,
     R(r"Patio|Outdoor", r"table", r"cover|cloth|umbrella|planter|side table|end table|fire", width=(60, 250)), None),
    ("salon-de-jardin", "Salon de jardin", "jardin", "Mobilier de jardin", ["canapé d'extérieur", "ensemble de jardin"], "couch", "rembourre", False,
     R(r"Patio|Outdoor", r"sofa|sectional|conversation set|loveseat", COVER), None),
    ("bain-de-soleil", "Bain de soleil", "jardin", "Mobilier de jardin", ["transat", "chaise longue de jardin"], "chair", "empilable", False,
     R(r"Patio|Outdoor", r"lounger|chaise lounge|sun lounger|daybed", COVER), None),
    ("parasol", "Parasol", "jardin", "Mobilier de jardin", ["parasol déporté"], "umbrella", "empilable", False,
     None, None),
    ("barbecue", "Barbecue", "jardin", "Cuisine d'extérieur", ["plancha", "grill"], None, "rigide", True,
     R(r".", r"\bgrill\b|barbecue|bbq", r"cover|brush|mat|tool|pan|light|thermometer|basket", pt=["OUTDOOR_LIVING", "GRILL"]), None),
    ("jardiniere", "Jardinière ou grand pot", "jardin", "Décoration", ["bac à fleurs"], "potted plant", "rigide", False,
     R(r".", r"planter", r"tabletop|hanging|small|set of 3|mini", width=(40, 150)), None),
    ("abri-de-jardin", "Abri ou coffre de jardin", "jardin", "Rangements", ["coffre de jardin", "deck box"], None, "demontable", False,
     R(r".", r"deck box|storage shed|outdoor storage box", r"cover"), None),

    # ---------------- Sport et loisirs ----------------
    ("velo", "Vélo", "sport_loisirs", "Vélos", ["bicyclette", "VTT", "vélo de ville"], "bicycle", "rigide", False, None, "Vélo"),
    ("velo-enfant", "Vélo enfant", "sport_loisirs", "Vélos", ["draisienne"], "bicycle", "rigide", False, None, None),
    ("trottinette", "Trottinette", "sport_loisirs", "Vélos", ["trottinette électrique"], None, "rigide", False, None, None),
    ("velo-appartement", "Vélo d'appartement", "sport_loisirs", "Fitness", ["vélo fitness", "vélo elliptique"], "bicycle", "rigide", True, None, "Vélo fitness"),
    ("tapis-de-course", "Tapis de course", "sport_loisirs", "Fitness", ["tapis roulant"], None, "rigide", True, None, None),
    ("banc-de-musculation", "Banc de musculation", "sport_loisirs", "Fitness", ["banc de développé couché"], "bench", "demontable", True,
     R(r"Exercise|Fitness|Strength", r"weight bench|workout bench|exercise bench|utility bench", r"cover|pad"), None),
    ("rameur", "Rameur", "sport_loisirs", "Fitness", ["machine à ramer"], None, "rigide", True, None, None),
    ("table-de-ping-pong", "Table de ping-pong", "sport_loisirs", "Jeux", ["table de tennis de table"], "dining table", "rigide", True, None, None),
    ("baby-foot", "Baby-foot", "sport_loisirs", "Jeux", ["table de football"], None, "rigide", True, None, None),
    ("billard", "Billard", "sport_loisirs", "Jeux", ["table de billard"], None, "rigide", True, None, None),
    ("planche-de-surf", "Planche de surf ou paddle", "sport_loisirs", "Sports", ["paddle", "planche à voile"], "surfboard", "rigide", False, None, None),
    ("skis", "Skis et équipement de ski", "sport_loisirs", "Sports", ["snowboard", "skis"], "skis", "empilable", False, None, None),
    ("sac-de-golf", "Sac de golf", "sport_loisirs", "Sports", ["clubs de golf"], None, "rigide", False, None, None),
    ("poussette", "Poussette", "sport_loisirs", "Enfants", ["landau"], None, "rigide", False, None, None),

    # ---------------- Cartons et emballages ----------------
    ("carton-standard", "Carton standard", "cartons", "Cartons", ["carton de déménagement"], None, "empilable", False, None, None),
    ("carton-livres", "Carton livres", "cartons", "Cartons", ["petit carton", "carton vaisselle"], None, "empilable", False, None, None),
    ("carton-penderie", "Carton penderie", "cartons", "Cartons", ["carton à vêtements sur cintres"], None, "empilable", False, None, None),
    ("lot-10-cartons", "Lot de 10 cartons", "cartons", "Cartons", ["dizaine de cartons"], None, "empilable", False, None, "Cartons (×10)"),
    ("caisse-plastique", "Caisse ou bac de rangement", "cartons", "Bacs", ["boîte de rangement", "bac plastique"], None, "empilable", False,
     R(r"Storage Boxes|Storage Bins|Totes", r"box|bin|tote|container", r"jewelry|shoe box|small|mini|drawer organizer|set of [6-9]", width=(35, 90)), None),
    ("sac-ou-ballot", "Sac ou ballot", "cartons", "Sacs", ["sac de linge", "housse de couette"], None, "empilable", False, None, None),

    # ---------------- Autres objets ----------------
    ("autre-objet", "Autre objet", "volumineux", "Non classé", ["objet non identifié", "divers"], None, "rigide", False, None, None),
]


# Variantes dérivées d'une référence parente disposant d'un volume interne :
# volume de déménagement = volume du parent × (volume géométrique ABO variante / parent).
# Références unitaires déduites d'un lot de la table interne (même source, simple division).
UNIT_FROM = {"carton-standard": ("lot-10-cartons", 10)}

DERIVED = {
    "lit-king-size": "lit-queen-size",
    "lit-coffre": "lit-queen-size",
    "canape-4-places": "canape-3-places",
    "canape-angle": "canape-3-places",
    "canape-convertible": "canape-3-places",
    "fauteuil-relax": "fauteuil",
    "fauteuil-pivotant": "fauteuil",
    "table-a-manger-6": "table-a-manger-4",
    "table-a-manger-8": "table-a-manger-4",
    "bureau-angle": "bureau",
}


def cm(x):
    v = x.get("normalized_value") or x
    return v["value"] * F[v["unit"]] if v.get("unit") in F and v.get("value") else None


def load_abo(path):
    items = []
    for f in sorted(glob.glob(os.path.join(path, "*.json.gz"))):
        for line in gzip.open(f, "rt"):
            d = json.loads(line)
            dims = d.get("item_dimensions") or {}
            if not all(k in dims for k in ("height", "length", "width")):
                continue
            name = next((n["value"] for n in d.get("item_name") or [] if (n.get("language_tag") or "").startswith("en")), None)
            if not name:
                continue
            w, l, h = (cm(dims[k]) for k in ("width", "length", "height"))
            if not (w and l and h):
                continue
            kg = None
            for x in d.get("item_weight") or []:
                v = x.get("normalized_value") or x
                if v.get("unit") in W and v.get("value"):
                    kg = v["value"] * W[v["unit"]]
            items.append(dict(id=d["item_id"], name=name, pt=(d.get("product_type") or [{}])[0].get("value"),
                              nodes=[n.get("node_name") or "" for n in d.get("node") or []],
                              width=max(w, l), depth=min(w, l), height=h, kg=kg))
    return items


def select(items, r):
    node, inc = re.compile(r["node"], re.I), re.compile(r["inc"], re.I)
    exc = re.compile(r["exc"], re.I) if r["exc"] else None
    out = []
    for it in items:
        if r["pt"] and it["pt"] not in r["pt"]:
            continue
        if r["node"] != "." and not any(node.search(n) for n in it["nodes"]):
            continue
        if not inc.search(it["name"]) or (exc and exc.search(it["name"])):
            continue
        if r["width"] and not (r["width"][0] <= it["width"] <= r["width"][1]):
            continue
        # Garde-fous : dimensions plausibles d'un meuble (élimine accessoires et erreurs d'unité).
        if it["width"] < 10 or it["height"] < 3 or it["width"] > 600 or it["height"] > 300:
            continue
        out.append(it)
    return out


def pct(values, q):
    s = sorted(values)
    if not s:
        return None
    k = (len(s) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def r2(x, n=2):
    return None if x is None else round(x, n)


def main(abo_path):
    items = load_abo(abo_path)
    today = datetime.date.today().isoformat()
    catalog, provenance = [], {}
    for (eid, name, cat, sub, syn, coco, handling, heavy, rule, proto) in E:
        sel = select(items, rule) if rule else []
        n = len(sel)
        entry = dict(id=eid, name=name, category=cat, category_label=CATEGORIES[cat], subcategory=sub, synonyms=syn,
                     coco_class=coco, handling=handling, heavy=heavy, sample_size=n,
                     dims_cm=None, geometric_volume_m3=None, weight_kg=None,
                     professional_volume_m3=None, moving_volume_m3=None,
                     dims_reliability="aucune", moving_volume_reliability="aucune",
                     sources=[], method=[], updated_at=today)
        if n >= 8:
            vols = [it["width"] * it["depth"] * it["height"] / 1e6 for it in sel]
            entry["dims_cm"] = {k: {"min": r2(pct([it[k] for it in sel], .1), 0), "avg": r2(pct([it[k] for it in sel], .5), 0),
                                    "max": r2(pct([it[k] for it in sel], .9), 0)} for k in ("width", "depth", "height")}
            entry["geometric_volume_m3"] = {"min": r2(pct(vols, .1)), "avg": r2(pct(vols, .5)), "max": r2(pct(vols, .9))}
            kgs = [it["kg"] for it in sel if it["kg"] and it["kg"] > 0.2]
            if len(kgs) >= 5:
                entry["weight_kg"] = {"min": r2(pct(kgs, .1), 0), "avg": r2(pct(kgs, .5), 0), "max": r2(pct(kgs, .9), 0), "sample_size": len(kgs)}
            entry["dims_reliability"] = "elevee" if n >= 30 else "moyenne"
            entry["sources"].append("abo")
            entry["method"].append(f"Dimensions : percentiles 10/50/90 de {n} produits ABO (largeur = plus grand côté horizontal).")
            provenance[eid] = sorted(it["id"] for it in sel)
        g = entry["geometric_volume_m3"]
        if proto:
            ref = PROTO[proto]
            if g and g["avg"]:
                lo, hi = ref * g["min"] / g["avg"], ref * g["max"] / g["avg"]
            else:
                lo, hi = ref * 0.75, ref * 1.25
            entry["moving_volume_m3"] = {"min": r2(min(lo, ref)), "avg": r2(ref), "max": r2(max(hi, ref))}
            entry["moving_volume_reliability"] = "moyenne"
            entry["sources"].append("proto")
            entry["method"].append(f"Volume de déménagement : référence interne du prototype « {proto} » ({ref} m³) ; "
                                   + ("fourchette proportionnelle à la dispersion ABO." if g else "fourchette ±25 %."))
        elif g:
            coef, why = HANDLING[handling]
            entry["moving_volume_m3"] = {k: r2(v * coef) for k, v in g.items()}
            entry["moving_volume_reliability"] = "faible"
            entry["sources"].append("ds")
            entry["method"].append(f"Volume de déménagement : volume géométrique × {coef} ({why}) — hypothèse Devis Scan à calibrer.")
        else:
            entry["method"].append("Aucune donnée ouverte exploitable : volume à renseigner par le déménageur.")
        catalog.append(entry)

    by_id = {e["id"]: e for e in catalog}
    for child, parent in DERIVED.items():
        c, p = by_id[child], by_id[parent]
        if c["geometric_volume_m3"] and p["geometric_volume_m3"] and p["moving_volume_m3"] and "proto" in p["sources"]:
            ratio = c["geometric_volume_m3"]["avg"] / p["geometric_volume_m3"]["avg"]
            base = p["moving_volume_m3"]["avg"] * ratio
            g = c["geometric_volume_m3"]
            c["moving_volume_m3"] = {"min": r2(base * g["min"] / g["avg"]), "avg": r2(base), "max": r2(base * g["max"] / g["avg"])}
            c["moving_volume_reliability"] = "faible"
            c["sources"] = [x for x in c["sources"] if x != "ds"] + ["proto", "ds"]
            c["method"] = [m for m in c["method"] if not m.startswith("Volume de déménagement")] + [
                f"Volume de déménagement : dérivé de « {p['name']} » ({p['moving_volume_m3']['avg']} m³) × rapport des volumes géométriques ABO ({ratio:.2f}) — à calibrer."]

    for child, (parent, count) in UNIT_FROM.items():
        c, p = by_id[child], by_id[parent]
        if c["moving_volume_m3"] is None and p["moving_volume_m3"]:
            c["moving_volume_m3"] = {k: r2(v / count, 3) for k, v in p["moving_volume_m3"].items()}
            c["moving_volume_reliability"] = "faible"
            c["sources"] = c["sources"] + ["proto"]
            c["method"] = [m for m in c["method"] if not m.startswith("Aucune donnée")] + [
                f"Volume de déménagement : « {p['name']} » ({p['moving_volume_m3']['avg']} m³, prototype) ÷ {count} — à calibrer."]

    os.makedirs(os.path.join(ROOT, "data/catalog"), exist_ok=True)
    with open(os.path.join(ROOT, "data/catalog/catalog.json"), "w", encoding="utf-8") as f:
        json.dump({"version": today, "categories": CATEGORIES, "handling": {k: {"coefficient": v[0], "description": v[1]} for k, v in HANDLING.items()},
                   "items": catalog}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "data/catalog/abo-provenance.json"), "w", encoding="utf-8") as f:
        json.dump({"source": "Amazon Berkeley Objects (CC BY 4.0) — credit Amazon.com", "items": provenance}, f)
    with_vol = sum(1 for e in catalog if e["moving_volume_m3"])
    with_abo = sum(1 for e in catalog if "abo" in e["sources"])
    print(f"{len(catalog)} références ; {with_abo} avec dimensions ABO ; {with_vol} avec volume de déménagement ; "
          f"{len(catalog) - with_vol} sans volume (à renseigner)")
    for e in catalog:
        g = e["geometric_volume_m3"]; m = e["moving_volume_m3"]
        print(f"  {e['id']:26} n={e['sample_size']:4} géo={g['avg'] if g else '-':>5} dém={m['avg'] if m else '-':>5}  {e['dims_reliability']}/{e['moving_volume_reliability']}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/abo/listings/metadata")
