"""
Mesurabilité et transport (ajout v5, 27/11/2026).

1. Mesurabilité de chaque sous-catégorie :
   - « mesurable » : un objet a une boîte englobante stable (hauteur × largeur × profondeur) ;
   - « méthode spécifique » : mesurable, mais le volume de transport dépend d'une règle propre (roulé, démonté,
     replié, vidé, emballé en caisse) ; reste dans le dénominateur de couverture ;
   - « non directement mesurable » : pas de volume de référence universel (contenu variable) ; exclu du second
     indicateur de couverture, avec justification. Le dénominateur historique (171) n'est jamais modifié.
2. Transport : le volume géométrique (boîte du meuble monté) n'est JAMAIS converti automatiquement en volume de
   déménagement. Les champs `facteur_conversion_demenagement` et `convention_volume_demenagement` restent vides tant
   qu'une convention n'a pas été validée par des professionnels du déménagement.
"""
from __future__ import annotations

NON_MESURABLES = {
    "DIV-AUTRE": "objet non classé : par définition, aucune forme ni taille de référence ; volume à saisir objet par objet",
    "CAR-SAC": "sac, ballot ou housse remplis : le volume dépend entièrement du contenu et du remplissage",
    "ANC-AUTRE": "« autre meuble ancien » : regroupe des meubles de formes sans rapport entre elles ; la médiane n'a pas de sens physique",
}
METHODE_SPECIFIQUE = {
    "DEC-TAPIS-GRAND": "tapis transporté roulé : volume du rouleau (longueur × diamètre), pas la surface à plat",
    "DEC-TAPIS-MOYEN": "tapis transporté roulé : volume du rouleau",
    "DEC-TAPIS-PETIT": "tapis transporté roulé ou plié",
    "DEC-TAPIS-NC": "tapis transporté roulé",
    "JAR-PISCINE": "piscine ou spa transporté vidé et plié",
    "JAR-PARASOL": "parasol transporté replié",
    "JAR-ABRI": "abri ou serre transporté démonté en panneaux",
    "SPO-TENTE": "tente transportée pliée",
    "SPO-TRAMPOLINE": "trampoline transporté démonté",
    "JAR-BAC-SABLE": "portique ou aire de jeux transporté démonté",
    "JAR-BALANCELLE": "balancelle ou support de hamac transporté démonté",
    "SPO-PANIER-BASKET": "panier de basket transporté démonté",
    "SPO-BUT": "but transporté démonté",
    "LUM-LUSTRE": "lustre décroché et emballé en caisse : volume de la caisse",
    "PLA-ARBRE": "végétal de forme irrégulière : volume de la boîte englobante, tassement impossible",
    "DEC-PLANTE": "végétal de forme irrégulière",
    "ART-SCULPTURE": "œuvre emballée en caisse sur mesure",
    "CAR-CARTON": "carton de déménagement : formats standard propres à chaque déménageur",
    "CAR-BAC": "bac ou caisse : contenant, volume extérieur",
    "MUS-PIANO-QUEUE": "piano à queue transporté sur la tranche, pieds démontés",
    "COU-METIER": "grand métier à tisser transporté démonté",
}
# Meubles et objets usuellement démontés, repliés ou emboîtés pour le transport (en plus des avertissements v4).
DEMONTABLES = {
    "LIT-SIMPLE", "LIT-DOUBLE", "LIT-QUEEN", "LIT-KING", "LIT-NC", "LIT-COFFRE", "LIT-SUPERP", "LIT-BALDAQUIN", "LIT-GIGOGNE",
    "LIT-ENFANT", "LIT-BEBE", "LIT-ESCAM", "MED-LIT", "ANC-LIT", "SOM-STD", "ARM-1P", "ARM-2P", "ARM-3P", "ARM-4P", "ARM-5P+",
    "ARM-COUL", "ARM-ANG", "ARM-NC", "ARM-DRESS", "ARM-TISSU", "ARM-PORT", "TAB-4", "TAB-6", "TAB-8+", "TAB-REPAS-NC", "TAB-RONDE",
    "TAB-PLIANTE", "TAB-JEU", "BUR-DROIT", "BUR-ANGLE", "BUR-ASSIS", "BUR-REUNION", "CAN-ANG", "CAN-PANO", "CAN-MOD",
    "RAN-BIB-HAUTE", "RAN-BIB-CUBE", "ETA-NC", "ETA-METAL", "PRO-RAYONNAGE", "CHA-PLIANTE", "JAR-TABLE", "JAR-SALON",
    "SPO-BANC-MUSCU", "SPO-TAPIS-COURSE", "SPO-PINGPONG", "SPO-BILLARD", "ENF-PARC", "ENF-POUSSETTE", "MED-FAUTEUIL-ROULANT",
    "MED-DEAMBULATEUR", "COU-CHEVALET", "MUS-BATTERIE", "BRI-ETABLI",
}
EMPILABLES = {"CHA-REPAS", "CHA-PLIANTE", "JAR-CHAISE", "CHA-TABOURET", "CAR-CARTON", "CAR-BAC", "BAG-VALISE", "BAG-SET"}

MESURABILITE = {**{k: ("non directement mesurable", v) for k, v in NON_MESURABLES.items()},
                **{k: ("méthode spécifique", v) for k, v in METHODE_SPECIFIQUE.items()}}


def transport(sc_id: str, avertissement: str) -> dict:
    """Champs de transport d'une référence. Aucun coefficient : la conversion reste à définir et valider."""
    demontable = sc_id in DEMONTABLES or bool(avertissement)
    raisons = []
    if demontable:
        raisons.append("souvent démonté ou replié pour le transport")
    if sc_id in EMPILABLES:
        raisons.append("empilable ou emboîtable")
    if sc_id in METHODE_SPECIFIQUE:
        raisons.append(METHODE_SPECIFIQUE[sc_id])
    return {
        "demontable_ou_pliable": "oui" if demontable else "non",
        "empilable": "oui" if sc_id in EMPILABLES else "non",
        "volume_transport_peut_differer": " ; ".join(raisons),
        "facteur_conversion_demenagement": None,
        "convention_volume_demenagement": "non définie — à valider par des professionnels du déménagement",
    }
