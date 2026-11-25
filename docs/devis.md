# Devis : volumes, tarifs, versions (phase 4)

## Volume

- Volume de chaque objet = **volume de déménagement** (catalogue, ou valeur saisie par le déménageur), distinct du volume géométrique du meuble monté (voir `docs/catalogue-sources.md`).
- Règles validées : confirmé (sûr ou vérifié) + à vérifier = **volume estimé** ; incertain ou doublon possible = **volume potentiel, non compté** ; fourchette = estimé → estimé + potentiel.
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

Garanties en base : une version n'est **jamais modifiée** (déclencheur `freeze_quote`, motifs de validation compris), seul son statut évolue ; un devis accepté ne change plus de statut ; un devis n'est jamais supprimé ; **aucune nouvelle version ne peut être créée** pour une demande dont un devis est accepté (déclencheur `forbid_quote_after_acceptance`, en plus des contrôles de l'application).

## Corrections de l'inventaire

Le déménageur peut renommer, changer la quantité, le volume, la pièce, confirmer, retirer, rétablir, déclarer « pas un doublon », ou ajouter un objet (catalogue ou saisie libre). Chaque action est journalisée (`inventory_item_changes` : valeurs avant / après, auteur, date, impact sur le volume) et affichée sur la fiche. La proposition d'origine de l'IA reste consultable.

## Accès du client

- À l'envoi, le client reçoit un **lien secret de suivi** `/d/<entreprise>/devis/<jeton>` (64 caractères aléatoires, seul le hachage est en base, aucun identifiant de demande dans l'adresse, page non indexée, pas de transmission du lien à d'autres sites).
- Ce lien affiche la progression de l'analyse, puis l'estimation ou le devis, et le PDF (généré à la demande depuis les instantanés).
- **Limite actuelle** : l'envoi de ce lien par e-mail n'est pas encore en place (aucun service d'e-mail transactionnel configuré) ; le client doit conserver l'adresse de la page.

## Mentions légales

Le devis affiche : identité de l'entreprise (raison sociale, adresse, SIRET, TVA), date, numéro et durée de validité, client, adresses, accès, date souhaitée, volume, distance, détail des prix HT, TVA et TTC, type de voyage (réglage de la grille), assurance, conditions de paiement, réserves à la livraison, responsabilité et conditions générales **rédigées par l'entreprise**. Devis Scan n'ajoute aucune clause juridique.

Textes de référence identifiés (arrêté du 27 avril 2010 sur l'information du consommateur en matière de déménagement, fiche service-public F33997) : **non consultés en intégralité** (sites inaccessibles depuis l'environnement de développement). La conformité des mentions doit être vérifiée par un professionnel du droit avant la commercialisation.
