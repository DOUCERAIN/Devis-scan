"""
Lecture des fiches EPREL téléchargées (si elles existent) — PRÊT, INACTIF tant qu'aucune donnée n'est présente.

Règles :
  - dimensions hors tout seulement (« Overall dimensions (Height x Width x Depth) ») ; jamais les dimensions de niche
    d'encastrement ni de colis ; un appareil encastrable est signalé ;
  - unités : millimètres pour les appareils de froid, centimètres pour les lave-linge, sèche-linge, lave-vaisselle
    (libellés officiels) ; conversion en cm, jamais de complétion d'une dimension manquante ;
  - droits : niveau 3 (« autorisation à confirmer ») tant que les conditions de l'API n'ont pas été lues et validées
    par le porteur du projet ; niveau 1 seulement si la variable EPREL_CONDITIONS_VERIFIEES=1 est positionnée.
Les noms exacts des champs JSON seront confirmés à réception de la clé : la lecture cherche des clés contenant
« height », « width », « depth » (ou « dimensionHeight »…).
"""
from __future__ import annotations
import glob
import json
import os

from taxonomie import PAR_ID

TYPES = {  # groupe EPREL → sous-catégorie par défaut (affinée par le type d'appareil quand il est publié)
    "refrigeratingappliances2019": "ELM-REF", "dishwashers2019": "ELM-LV", "washingmachines2019": "ELM-LL",
    "washerdriers2019": "ELM-LAVANTE-SECHANTE", "tumbledriers20232534": "ELM-SL",
}
UNITE_CM = {"refrigeratingappliances2019": 0.1}  # mm → cm ; les autres groupes sont en cm


def _valeur(fiche, mot):
    for k, v in fiche.items():
        if mot in k.lower() and isinstance(v, (int, float)) and v > 0:
            return float(v)
    return None


def lire_eprel(dossier: str, date_collecte: str):
    verifie = os.environ.get("EPREL_CONDITIONS_VERIFIEES") == "1"
    for groupe, sid in TYPES.items():
        for chemin in sorted(glob.glob(os.path.join(dossier, "eprel", groupe, "page-*.json"))):
            data = json.load(open(chemin))
            for f in data.get("hits") or data.get("results") or []:
                fac = UNITE_CM.get(groupe, 1.0)
                h, w, d = (_valeur(f, m) for m in ("height", "width", "depth"))
                if not any((h, w, d)):
                    continue
                h, w, d = (round(x * fac, 1) if x else None for x in (h, w, d))
                horiz = sorted([x for x in (w, d) if x], reverse=True)
                ident = str(f.get("eprelRegistrationNumber") or f.get("registrationNumber") or f.get("id"))
                yield {
                    "id_observation": f"OBS-EPREL-{groupe}-{ident}", "source": "EPREL",
                    "nom_source": "EPREL — base européenne des étiquettes énergie (Commission européenne)",
                    "url_source": f"https://eprel.ec.europa.eu/screen/product/{groupe}/{ident}",
                    "url_jeu_de_donnees": "https://eprel.ec.europa.eu",
                    "licence": "conditions de l'API publique EPREL (à confirmer)",
                    "statut_reutilisation": "commerciale autorisée (conditions vérifiées)" if verifie else "à confirmer — autorisation nécessaire",
                    "date_collecte": date_collecte, "fabricant": "", "marque": f.get("supplierOrTrademark") or f.get("trademark") or "",
                    "nom_commercial": f"{f.get('supplierOrTrademark', '')} {f.get('modelIdentifier', '')}".strip()[:200],
                    "reference_produit": f.get("modelIdentifier") or "", "identifiant_source": ident, "domaine": "eprel.ec.europa.eu",
                    "pays": "UE", "type_produit_source": groupe, "categorie_source": groupe,
                    "hauteur_cm": h, "largeur_cm": horiz[0] if horiz else None, "profondeur_cm": horiz[1] if len(horiz) > 1 else None,
                    "dimensions_origine": f"H={h} L={w} P={d} (cm, depuis {'mm' if fac != 1 else 'cm'})",
                    "unite_origine": "mm" if fac != 1 else "cm", "type_dimensions": "appareil (dimensions hors tout déclarées pour l'étiquette énergie)",
                    "dimensions_du_nom": [], "texte_classement": groupe,
                    "commentaire_source": "modèle du marché européen" + (" ; encastrable" if str(f.get("builtIn") or f.get("installationType") or "").lower() in ("true", "built_in", "built-in") else ""),
                }, PAR_ID[sid]
