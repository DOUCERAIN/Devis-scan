# Devis : volumes, tarifs, versions (phase 4)

## Volume

- Volume de chaque objet = **volume de déménagement** (catalogue, ou valeur saisie par le déménageur), distinct du volume géométrique du meuble monté (voir `docs/catalogue-sources.md`).
- Règles validées : confirmé (sûr ou vérifié) + à vérifier = **volume estimé** ; doublon possible = **compté à vérifier** (depuis le 26/11/2026 : on ne retire jamais un meuble peut-être réel ; le devis le signale dans ses hypothèses) ; incertain = **volume potentiel, non compté** ; fourchette = estimé → estimé + potentiel.
- Volume facturé = volume estimé **arrondi au dixième de m³ supérieur**.
- Recalcul automatique à chaque affichage (par objet, pièce, logement, demande) ; le devis fige le résultat dans `volume_snapshot`.

## Tarif (`src/lib/pricing/engine.ts`)

Calcul déterministe, **en centimes**, avec la seule grille de l'entreprise :

| Ligne | Calcul |
| --- | --- |
| Volume | volume facturé × prix au m³ |
| Déplacement | forfait fixe |
| Kilomètres | (distance arrondie au km supérieur − distance incluse) × prix au km |
| Étages | étage × supplément (sans ascenseur / petit ascenseur), au départ et à l'arrivée |
| Portage | tranches de 10 m entamées au-delà de la distance gratuite × prix |
| Objets lourds | supplément spécifique de l'entreprise (même nom), sinon supplément par défaut ; seulement pour les objets comptés |
| Options du client | forfait, au m³ facturé, ou à l'unité |
| Forfait minimum | ligne d'ajustement explicite si le total HT est inférieur |
| TVA | sur le total HT, arrondie au centime |

Chaque ligne est arrondie au centime (demi-centime vers le haut). La distance vient du calcul d'itinéraire de la Géoplateforme (IGN) ; à défaut, vol d'oiseau × 1,3, **signalé comme estimation** sur le devis.

**Aucun prix inventé** : sans volume, sans prix au m³ ou sans distance quand un prix au km est prévu, aucun montant n'est affiché. Les hypothèses (étage inconnu, distance estimée, objets non comptés, objets sans volume) sont listées sur le devis.

### Grille non configurée
La grille créée avec l'entreprise contient des valeurs d'exemple. Tant que l'entreprise ne l'a pas **enregistrée** (`pricing_settings.configured_at`), aucune estimation n'est présentée : le client est informé que son déménageur va compléter son tarif, et le déménageur voit une alerte sur la fiche et la page Tarifs.

## Validation par le client, devis final et vérification (depuis le 26/11/2026)

Parcours des demandes venues du lien client (`src/lib/quotes/customer-validation.ts`, `src/lib/quotes/verification.ts`) :

1. **Analyse IA terminée** → la demande passe « Inventaire en attente de validation client » (`awaiting_customer`). Aucun prix n'est calculé à ce stade.
2. **Validation par le client** (page de suivi `/d/<slug>/devis/<jeton>`) :
   - il voit son inventaire par pièce ;
   - les doublons possibles sont regroupés dans **« Éléments à vérifier »**, avec une explication en français simple et les images concernées ;
   - pour chacun, il répond « C'est un autre meuble : garder les deux » ou « C'est le même meuble : ne le compter qu'une fois ». Une réponse est **obligatoire** pour chaque élément (contrôle dans le navigateur, sur le serveur et en base) ;
   - il confirme l'avertissement de responsabilité. Son texte exact est enregistré (`customer_acknowledgement`), avec la date.
3. **Devis final immédiat** : inventaire et volume recalculés avec ses réponses, prix calculé avec la grille de l'entreprise, version figée **transmise aussitôt** (`origin = customer_validation`). Le client peut le consulter, le télécharger en PDF, l'accepter ou le refuser **sans attendre** le déménageur.
   - Seuls trois empêchements objectifs retardent ce devis : grille non enregistrée, identité légale incomplète, prix impossible à calculer. La demande passe alors « Inventaire validé par le client » et le déménageur est prévenu.
4. **Vérification par le déménageur, en parallèle**. Son suivi est indépendant de celui du devis (`verification_status` : en attente → vérifié ou corrigé). Le dossier de vérification de la fiche réunit :
   - les vidéos et les images ;
   - l'inventaire initial (proposition de l'IA conservée) ;
   - les doublons possibles et les réponses du client ;
   - le volume ;
   - le devis transmis et la réponse du client.
5. **Le déménageur confirme** : aucun changement de volume ni de prix, aucune nouvelle version, aucune notification. Le dossier passe « Vérifié par le déménageur » et le client n'a plus rien à faire.
6. **Le déménageur corrige** (ajout, retrait, quantité, décision sur un doublon) : chaque correction est journalisée avec son auteur, puis il indique la raison et enregistre. Le devis est recalculé et **comparé** à la version transmise (montant, détail des prix, volume facturé) :
   - **conditions identiques** (cas C) : aucune nouvelle version, trace conservée, client informé sans nouvelle acceptation ;
   - **devis pas encore accepté** (cas A) : nouvelle version transmise, qui remplace la précédente (conservée) ; le client l'accepte ou la refuse ;
   - **devis déjà accepté** (cas B) : **avenant** (`quotes.amends_quote_id`) soumis à l'accord explicite du client. Le devis accepté reste **inchangé et en vigueur** ; un avenant refusé le laisse en vigueur. Un avenant n'est jamais accepté d'office (contrôle en base).

   Le client voit les différences entre les deux versions, la raison et peut télécharger chaque version (`/pdf?version=N`).

Les **réponses du client ne sont jamais écrasées** : elles sont stockées à part (`customer_duplicate_decision`) et ne peuvent plus changer, même par un membre de l'entreprise (déclencheur). La décision du déménageur est stockée à côté (`mover_duplicate_decision`) et prime pour le calcul.

**E-mail au client après une correction** : il est préparé avec la vérification humaine, les meubles ajoutés, retirés ou corrigés, l'ancien et le nouveau volume, l'ancien et le nouveau montant, la raison et la suite à donner. **Aucun service d'e-mail n'est configuré à ce jour** : le message est conservé (`customer_notifications`, statut « not_configured ») et affiché au déménageur comme **non envoyé**. Rien n'est simulé. Le client voit néanmoins la modification sur sa page de suivi. Limite : seul le hachage du lien de suivi est en base, l'e-mail ne peut donc pas contenir ce lien.

| Suivi du devis | Suivi de la vérification |
| --- | --- |
| Analyse IA terminée · Inventaire en attente de validation client · Inventaire validé par le client · Devis transmis au client · Devis accepté / refusé · Nouvelle version (ou avenant) transmise · Nouvelle version acceptée / refusée | Vérification humaine en attente · Vérifié par le déménageur · Inventaire corrigé par le déménageur |

L'ancien réglage « Envoyer automatiquement un devis formel quand l'analyse est fiable » ne s'applique plus aux demandes du lien client. Il a été retiré de la page Entreprise ; la colonne `companies.auto_formal_quotes` est conservée sans être utilisée. Les demandes saisies à la main par le déménageur gardent le fonctionnement manuel : recalculer, puis valider et envoyer.

## Estimation ou devis

### Devis formel automatique (option de l'entreprise)
Réglage « Envoyer automatiquement un devis formel quand l'analyse est fiable » (page Entreprise, désactivé par défaut). Après l'analyse, un devis formel n'est envoyé automatiquement que si **toutes** les conditions sont réunies (`src/lib/quotes/eligibility.ts`) : option activée, identité légale complète, grille enregistrée, analyse réelle (jamais le simulateur), toutes les pièces filmées et analysées, aucun objet à vérifier ni doublon possible, aucun volume potentiel, aucun objet sans volume, aucune hypothèse dans le calcul du prix (étages, portage, distance estimée…). Sinon : **estimation indicative** et demande signalée au déménageur, avec la liste des motifs (`quotes.review_reasons`), visible sur la fiche ; côté client, seuls les motifs qui concernent sa demande sont affichés.


- **Estimation indicative** : calculée automatiquement après l'analyse, ou recalculée par le déménageur. Bandeau explicite : elle n'engage pas l'entreprise tant qu'elle n'a pas vérifié l'inventaire.
- **Devis** : version « Valider et envoyer au client », possible seulement si la raison sociale, le SIRET et l'adresse de l'entreprise sont renseignés. Le client peut alors l'accepter ou le refuser (avant la date de validité).

## Versions et statuts

Chaque calcul crée une **nouvelle version** (`quotes.version`), avec ses instantanés : grille et options (`pricing_snapshot`), entreprise et conditions (`company_snapshot`), demande et adresses (`request_snapshot`), inventaire (`inventory_snapshot`), volume, hypothèses et résumé des corrections. Une modification ultérieure de la grille ne change pas un devis existant.

| Statut | Signification |
| --- | --- |
| Analyse en cours | `analysis_runs` en cours (affiché au client avec les étapes) |
| Devis initial généré | `generated` : estimation automatique |
| Devis corrigé | `corrected` : recalculé après corrections |
| Devis envoyé | `sent` : version formelle envoyée |
| Accepté / Refusé / Expiré | réponse du client, ou date de validité dépassée |
| Remplacé | `superseded` : version antérieure, conservée |

Garanties en base :
- une version n'est **jamais modifiée** (déclencheur `freeze_quote`, motifs de validation et lien d'avenant compris), seul son statut évolue ;
- un devis accepté ne change plus de statut ;
- un devis n'est jamais supprimé ;
- après une acceptation, **seul un avenant au dernier devis accepté** peut être créé, et jamais au statut accepté (déclencheur `forbid_quote_after_acceptance`, en plus des contrôles de l'application).

## Corrections de l'inventaire

Le déménageur peut renommer, changer la quantité, le volume, la pièce, confirmer, retirer, rétablir, déclarer « pas un doublon », ou ajouter un objet (catalogue ou saisie libre). Chaque action est journalisée (`inventory_item_changes` : valeurs avant / après, auteur, date, impact sur le volume) et affichée sur la fiche. La proposition d'origine de l'IA reste consultable.

## Accès du client

- À l'envoi, le client reçoit un **lien secret de suivi** `/d/<entreprise>/devis/<jeton>` (64 caractères aléatoires, seul le hachage est en base, aucun identifiant de demande dans l'adresse, page non indexée, pas de transmission du lien à d'autres sites).
- Ce lien affiche la progression de l'analyse, puis l'estimation ou le devis, et le PDF (généré à la demande depuis les instantanés).
- **Limite actuelle** : l'envoi de ce lien par e-mail n'est pas encore en place (aucun service d'e-mail transactionnel configuré) ; le client doit conserver l'adresse de la page.

## Mentions légales

Le devis affiche : identité de l'entreprise (raison sociale, adresse, SIRET, TVA), date, numéro et durée de validité, client, adresses, accès, date souhaitée, volume, distance, détail des prix HT, TVA et TTC, type de voyage (réglage de la grille), assurance, conditions de paiement, réserves à la livraison, responsabilité et conditions générales **rédigées par l'entreprise**. Devis Scan n'ajoute aucune clause juridique.

Textes de référence identifiés (arrêté du 27 avril 2010 sur l'information du consommateur en matière de déménagement, fiche service-public F33997) : **non consultés en intégralité** (sites inaccessibles depuis l'environnement de développement). La conformité des mentions doit être vérifiée par un professionnel du droit avant la commercialisation.
