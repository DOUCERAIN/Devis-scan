"""Estimations de dimensions produites par l'IA (catalogue v6, 26/11/2026).

AUCUNE de ces valeurs n'est une mesure. Ce sont les dimensions d'un « modèle type » courant sur le marché
européen, fixées par l'assistant à partir de connaissances générales (formats standard, normes
d'encastrement, dimensions habituelles des distributeurs), sans source vérifiée. Le volume qui en découle
est celui d'UN modèle type, jamais une médiane. La fourchette [vmin, vmax] donne l'étendue plausible
entre un petit et un grand modèle. À remplacer par des mesures dès qu'elles existent.

Clés :
- h, l, p : dimensions en cm. `None` : la dimension est mesurée dans le catalogue v5 (dimensions
  partielles) et seule la dimension manquante est estimée.
- etat : « monté » (boîte englobante du meuble en service) ou « transport » (plié ou démonté).
"""

E = {}


def est(i, h, l, p, vmin, vmax, note, etat="monté"):
    E[i] = dict(h=h, l=l, p=p, vmin=vmin, vmax=vmax, note=note, etat=etat)


# Électroménager : on garde les hauteurs et largeurs médianes mesurées (ENERGY STAR, EPREL) et on estime la profondeur.
est("ELM-REF-1P", None, None, 63, 0.35, 0.80, "profondeur type 60 à 66 cm (encastrement 60 cm et portes)")
est("ELM-REF-COMBI", None, None, 66, 0.55, 0.95, "profondeur type 63 à 68 cm ; la largeur mesurée (74,9 cm) vient du marché nord-américain (ENERGY STAR), le combiné européen fait souvent 60 cm de large")
est("ELM-REF-TOP", None, None, 55, 0.08, 0.25, "profondeur type 50 à 60 cm")
est("ELM-REF-US", None, None, 72, 0.95, 1.35, "profondeur type 65 à 75 cm sans les poignées")
est("ELM-CAVE", None, None, 57, 0.10, 0.80, "profondeur type 55 à 60 cm ; la hauteur médiane (86,6 cm) correspond aux caves sous plan, une armoire à vin fait 0,6 à 0,8 m³")
est("ELM-LV", 85, None, None, 0.24, 0.33, "hauteur standard d'encastrement 82 à 87 cm")
est("ELM-CONG", 145, 60, 63, 0.20, 0.75, "congélateur armoire type ; la seule mesure du v5 (87 cm) est un modèle top")
est("ELM-CONG-COFFRE", 85, 110, 65, 0.30, 1.00, "congélateur coffre de 200 à 300 L ; la seule mesure du v5 (54,6 cm de large) est un modèle compact")
est("ELM-REF-MULTI", 180, 83, 70, 0.90, 1.30, "réfrigérateur multiportes (« French door ») 80 à 90 cm de large")
est("MIR-PSYCHE", None, None, 45, 0.20, 0.80, "profondeur du piétement 35 à 55 cm ; hauteur et largeur : une seule mesure v5")
# Sous-catégories sans aucune dimension.
est("CAR-SAC", 60, 50, 40, 0.06, 0.20, "sac de 100 L ou ballot rempli")
est("CUI-ETAGERE", 150, 60, 40, 0.15, 0.50, "étagère de cuisine ou meuble micro-ondes")
est("LIT-BEBE", 90, 126, 66, 0.55, 0.90, "lit à barreaux 60 × 120 cm, cadre compris")
est("SDB-COLONNE", 170, 35, 30, 0.10, 0.30, "colonne de salle de bain")
est("DIV-AQUARIUM", 60, 100, 40, 0.05, 0.80, "aquarium de 200 L sans son meuble")
est("ARM-TISSU", 170, 90, 45, 0.40, 0.90, "penderie en tissu montée ; se démonte en un petit colis")
est("ARM-BAS", 100, 90, 50, 0.30, 0.60, "armoire basse")
est("ARM-DRESS", 200, 100, 50, 0.50, 2.00, "un module de dressing de 1 m ; un ensemble se compte en modules")
est("BRI-ETABLI", 90, 150, 65, 0.50, 1.20, "établi")
est("BRI-SERVANTE", 90, 70, 45, 0.15, 0.45, "servante d'atelier")
est("BRI-ARMOIRE-GARAGE", 180, 90, 45, 0.40, 1.00, "armoire métallique de garage")
est("BUR-CAISSON", 60, 40, 55, 0.10, 0.18, "caisson à tiroirs sur roulettes")
est("CAN-PANO", 85, 330, 180, 3.50, 7.00, "canapé en U (boîte englobante) ; se transporte en modules")
est("CAN-MOD", 85, 250, 95, 1.20, 4.00, "canapé modulable de 3 modules")
est("CAN-5P", 85, 280, 100, 2.00, 3.00, "canapé 5 places")
est("CAN-4P", 85, 240, 95, 1.70, 2.30, "canapé 4 places")
est("COM-SEMAINIER", 130, 50, 40, 0.18, 0.35, "semainier 7 tiroirs")
est("COU-MEUBLE", 77, 100, 50, 0.25, 0.50, "table ou meuble de couture")
est("LIT-ENFANT", 70, 168, 78, 0.60, 1.20, "lit junior 70 × 160 avec barrières")
est("BUR-ENFANT", 75, 100, 55, 0.25, 0.55, "bureau enfant")
est("ENF-COFFRE", 50, 70, 40, 0.08, 0.20, "coffre à jouets")
est("ENF-POUSSETTE", 105, 60, 85, 0.35, 0.65, "poussette dépliée ; pliée environ 0,15 à 0,25 m³")
est("ENF-PARC", 76, 124, 64, 0.40, 0.70, "lit parapluie déplié ; plié environ 0,04 m³")
est("ENF-TABLE-LANGER", 95, 80, 50, 0.25, 0.50, "table à langer")
est("ENF-CHAISE-HAUTE", 100, 60, 75, 0.25, 0.55, "chaise haute dépliée ; la mesure v5 (0,004 m³) est aberrante")
est("ENT-MEUBLE", 90, 100, 40, 0.20, 0.50, "meuble d'entrée")
est("ETA-ECHELLE", 180, 60, 35, 0.20, 0.45, "étagère échelle")
est("JAR-BROUETTE", 60, 140, 65, 0.35, 0.70, "brouette")
est("JAR-BANC", 80, 150, 60, 0.45, 0.90, "banc de jardin 2 ou 3 places")
est("JAR-SALON", 75, 150, 90, 1.50, 4.50, "table de jardin de 1 m³ plus 4 chaises de 0,5 m³ (somme de 5 boîtes) ; un ensemble n'a pas de boîte unique")
est("JAR-TONDEUSE", 100, 55, 150, 0.15, 0.90, "tondeuse poussée, guidon déplié ; guidon replié environ 0,25 m³")
est("SPO-PINGPONG", 76, 274, 152, 1.20, 3.20, "table réglementaire dépliée ; repliée environ 1,5 m³")
est("LIT-ESCAM", 220, 160, 45, 1.20, 2.20, "lit escamotable 140 dans son armoire")
est("MED-LIT", 70, 100, 215, 1.20, 1.80, "lit médicalisé 90 × 200")
est("MED-DEAMBULATEUR", 85, 60, 65, 0.10, 0.40, "rollator déplié ; plié environ 0,1 m³")
est("MUS-PIANO-NUM", 80, 135, 40, 0.05, 0.60, "piano numérique meuble ; un clavier seul fait environ 0,05 m³")
est("PLA-ARBRE", 180, 60, 60, 0.30, 1.20, "arbre ou grande plante de 1,5 à 2 m en bac")
est("DEC-PLANTE", 120, 50, 50, 0.10, 0.60, "grande plante en pot")
est("RAN-ANGLE", 180, 60, 60, 0.20, 0.70, "encoignure haute")
est("SDB-ETAGERE", 170, 60, 30, 0.05, 0.35, "étagère de salle de bain")
est("SPO-ELLIPTIQUE", 165, 160, 65, 1.20, 2.00, "vélo elliptique")
est("SPO-TAPIS-COURSE", 135, 180, 80, 1.00, 2.20, "tapis de course déplié ; replié environ 0,9 m³")
est("SPO-RAMEUR", 55, 210, 55, 0.40, 1.00, "rameur")
est("SPO-SURF", 20, 270, 70, 0.15, 0.50, "paddle rigide ou planche de surf longue")
est("SPO-SKI", 20, 180, 30, 0.05, 0.20, "housse de skis et chaussures")
est("INF-TV-55", 75, 125, 10, 0.08, 0.12, "écran 55 pouces sans pied")
est("INF-TV-75", 100, 170, 10, 0.15, 0.22, "écran 75 pouces sans pied")
est("VEL-CARGO", 110, 250, 65, 1.40, 2.20, "vélo cargo biporteur")
est("VEL-TROTTINETTE", 115, 110, 45, 0.15, 0.60, "trottinette électrique dépliée ; pliée environ 0,2 m³")
est("BUR-REUNION", 75, 240, 110, 1.20, 3.00, "table de réunion 8 à 10 personnes")
est("COU-MANNEQUIN", 160, 40, 40, 0.15, 0.30, "mannequin sur pied")
est("ENF-CHEVAL", 70, 100, 40, 0.15, 0.40, "cheval à bascule")
est("ENF-JOUET-GRAND", 100, 90, 40, 0.15, 1.00, "maison de poupée ou cuisine d'enfant")
est("JAR-BAC-SABLE", 30, 120, 120, 0.20, 0.80, "bac à sable en plastique ; une aire de jeux se démonte")
est("JEU-FLIPPER", 190, 75, 135, 1.50, 2.10, "flipper sur pieds ; pieds et fronton démontés environ 0,8 m³")
est("JEU-ARCADE", 180, 70, 80, 0.70, 1.20, "borne d'arcade")
est("JEU-TABLE-MULTI", 80, 200, 110, 1.20, 2.20, "table de jeux combinée")
est("SPO-BILLARD", 80, 250, 140, 2.00, 3.60, "billard 8 pieds")
est("MED-CHAISE-PERCEE", 90, 55, 55, 0.20, 0.35, "chaise percée")
est("MED-TABLE-EXAMEN", 70, 190, 65, 0.15, 1.00, "table de massage dépliée ; pliée environ 0,15 m³")
est("MED-SCOOTER", 95, 120, 55, 0.40, 0.90, "scooter de mobilité 4 roues")
est("MOT-TONDEUSE-AUTO", 110, 180, 100, 1.50, 2.50, "tondeuse autoportée")
est("MOT-QUAD", 115, 190, 110, 1.80, 3.00, "quad")
est("SDB-BAIGNOIRE", 60, 170, 80, 0.60, 1.10, "baignoire îlot")
est("SPO-SAC-FRAPPE", 120, 35, 35, 0.08, 0.25, "sac de frappe sans support")
est("MAC-PHOTOCOPIEUR", 115, 60, 65, 0.20, 0.80, "photocopieur multifonction sur socle")
est("PRO-ARMOIRE-RIDEAU", 198, 120, 45, 0.50, 1.20, "armoire de bureau à rideaux")
est("RES-VITRINE-REFRIG", 200, 60, 65, 0.60, 1.60, "vitrine réfrigérée 1 porte")
est("RES-TABLE-INOX", 90, 140, 70, 0.50, 1.20, "table inox de cuisine professionnelle")
est("RES-FRIGO-PRO", 200, 70, 80, 0.90, 2.00, "armoire réfrigérée professionnelle 600 L")
est("SPO-TRAMPOLINE", 30, 150, 60, 0.15, 0.60, "trampoline démonté (tubes, toile, filet)", etat="transport")
est("SPO-PANIER-BASKET", 30, 120, 80, 0.15, 0.60, "panier sur pied démonté", etat="transport")
est("JAR-PISCINE", 40, 120, 80, 0.20, 3.20, "piscine tubulaire démontée ; un spa rigide fait environ 3 m³ (sous-catégorie à scinder)", etat="transport")

# Volume de transport des objets dont la mesure v5 décrit l'état déployé (le volume géométrique déployé reste conservé).
T = {}


def tr(i, h, l, p, vmin, vmax, note):
    T[i] = dict(h=h, l=l, p=p, vmin=vmin, vmax=vmax, note=note, etat="transport")


tr("SPO-PINGPONG", 165, 150, 60, 1.20, 1.80, "table de ping-pong repliée sur ses roulettes")
tr("JAR-TONDEUSE", 50, 55, 85, 0.15, 0.35, "tondeuse poussée, guidon replié")
tr("JAR-PARASOL", 25, 250, 25, 0.08, 0.30, "parasol fermé, sans le pied (pied lesté : 0,03 à 0,1 m³ en plus)")
tr("JAR-ABRI", 30, 200, 120, 0.40, 3.00, "abri de jardin démonté en panneaux (un coffre de jardin : 0,4 à 1 m³) ; sous-catégorie hétérogène à scinder")
tr("SPO-TENTE", 30, 70, 30, 0.03, 0.30, "tente pliée dans sa housse")
tr("JAR-BALANCELLE", 40, 180, 80, 0.30, 1.20, "balancelle démontée (structure et assise)")
tr("SPO-BUT", 20, 200, 50, 0.10, 0.40, "but de football démonté")
tr("LIT-BALDAQUIN", 60, 220, 120, 1.00, 2.50, "lit à baldaquin démonté (montants, cadre, ciel de lit)")
