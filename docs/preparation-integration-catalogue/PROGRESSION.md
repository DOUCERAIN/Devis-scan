# Progression — préparation de l'intégration du catalogue au moteur IA

Mise à jour : 26/11/2026. Mission de **préparation** : aucune modification du moteur IA, du parcours client, du moteur de devis, de Supabase, de `main` ni de la production. Le catalogue v5 et les versions v2 à v4 sont intacts.

## Fait

| Volet | Livrable | État |
| --- | --- | --- |
| EPREL : étude officielle | `rapport_eprel.md` : conditions générales de l'API (3 juin 2024) et déclaration de confidentialité **lues** ; formulaire public ; documentation réservée à EU Login ; contradiction sur la signature documentée ; champs dimensionnels par groupe | terminé |
| EPREL : démarche | `guide_demande_eprel.md` : étapes, champs, textes proposés, question au support | prêt, **à faire par vous** |
| EPREL : intégration | `scripts/catalogue_v5/sources_eprel.py` amélioré (clés imbriquées, emballage et niche exclus) ; `test_eprel.py` (5 tests fictifs) ; téléchargement bloqué sans clé | prêt, inactif |
| Recherche dans le catalogue | `architecture_recherche_catalogue.md` ; prototype `prototypes/integration-catalogue/` (index v5, recherche structurée, résolution serveur) | prototype testé |
| Contrat commun | `contrat_commun_ia.json` (généré depuis `contrat.ts`, zod) | proposé |
| Fournisseurs | `architecture_fournisseurs_ia.md` ; secours, rejeu, comparaison, compatibilité V1 (`fournisseurs.ts`, `compat_v1.ts`) | prototype testé |
| Tests simulés | `protocole_tests_catalogue.md` : 15 cas, 34 tests prototype + 5 tests EPREL réussis | réussis |
| Plan | `plan_integration_future.md` (10 étapes, risques) | proposé |

## Décisions qui vous reviennent

1. **Volume utilisé par le devis** quand une référence v5 n'a pas de volume de déménagement validé. Trois possibilités :
   - (a) volume géométrique médian, signalé « provisoire » ;
   - (b) saisie obligatoire par le déménageur ;
   - (c) conservation du volume hérité de l'ancien catalogue quand il existe.

   Recommandation : (c), sinon (b), tant que les conventions des déménageurs pilotes ne sont pas établies. Le volume géométrique est montré à côté, jamais à la place.
2. **Dimensions estimées par l'IA**. La règle actuelle de la V1 calcule un volume avec les dimensions estimées multipliées par un coefficient de manutention. Faut-il la conserver pour les objets inconnus, ou la remplacer par « dimensions à saisir » ? Recommandation : la remplacer pour les dimensions estimées par l'IA, et la garder pour les dimensions saisies par une personne (règle validée du parcours client).
3. **Import du catalogue v5 en base** : une migration non destructive (étape 1 du plan), à autoriser explicitement.
4. **EPREL** :
   - qui demande (organisation ou particulier) ;
   - question au support sur la signature ;
   - lecture et acceptation des conditions ;
   - avis d'un juriste sur les conditions (usage agrégé, mise à jour obligatoire, attribution).
5. **Benchmark réel** des modèles sur les 15 cas et sur de vrais logements : accord et budget (cadre existant : 0,75 $ par modèle, 5 $ au total).
6. **Niveaux de pertinence** (appréciation qualitative) : à faire relire par un ou deux déménageurs.
7. **Fournisseur open source** : quand et comment l'héberger (pas urgent ; l'architecture est prête).
8. **Exposition des variantes de taille** : espace professionnel seulement (recommandé), ou aussi côté client.

## Non fait (volontairement)

Aucune clé EPREL demandée, aucun compte, aucune signature, aucun contact avec une organisation, aucun appel Anthropic, aucune dépense, aucune migration, aucun déploiement.
