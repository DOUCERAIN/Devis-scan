# Préparation de l'intégration du catalogue au moteur IA

Dossier préparatoire (26/11/2026). Rien n'est branché sur l'application.

| Document | Contenu |
| --- | --- |
| `PROGRESSION.md` | état de la mission et **décisions à prendre** (à lire en premier) |
| `rapport_eprel.md` | étude officielle EPREL : accès, conditions, dimensions disponibles |
| `guide_demande_eprel.md` | votre démarche pas à pas, textes proposés, question au support |
| `architecture_recherche_catalogue.md` | comment un objet vu est rattaché à une référence du catalogue |
| `contrat_commun_ia.json` | format de réponse commun à tous les modèles (JSON Schema) |
| `architecture_fournisseurs_ia.md` | composants, interfaces, secours, rejeu, comparaison |
| `protocole_tests_catalogue.md` | 15 cas et tests simulés (résultats) |
| `plan_integration_future.md` | ordre de développement et risques |

Code du prototype : `prototypes/integration-catalogue/` (tests : `node --test "prototypes/integration-catalogue/*.test.ts"`).
