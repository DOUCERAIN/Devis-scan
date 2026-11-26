# Guide : demander une clé API EPREL au nom de Devis Scan

À faire **par vous**, personnellement. Je n'ai rien demandé, créé ni signé. Prévoir environ 1 heure, plus le délai de validation par la Commission (non publié).

## 1. Avant de commencer : trois décisions

1. **Qui demande ?**
   - **Organisation** (recommandé si une société existe) : il faut sa raison sociale exacte et le nom de son représentant légal.
   - **Particulier** : vous-même, si aucune société n'existe encore.

   « Devis Scan » est un nom de travail. Le nom déclaré doit être celui de l'entité juridique réelle.
2. **Quelle adresse e-mail ?** Elle recevra la clé et les annonces de l'API. Utilisez une adresse durable, par exemple une adresse générique de la société, plutôt qu'une adresse personnelle.
3. **Quelle adresse d'application ?** Elle doit commencer par `https://`. Le domaine définitif n'est pas encore choisi (phase 6). Vous pouvez indiquer l'adresse actuelle du site, en précisant dans la description qu'elle est provisoire.

## 2. Lire les deux documents à accepter

- Conditions générales : sur le formulaire, lien « Terms and Conditions ». Copie lue le 26/11/2026 dans `data/catalogue-v5/cache/eprel/officiel/`, résumé dans `rapport_eprel.md` § 2. Engagements à retenir :
  - ne pas revendre les données brutes ;
  - **tenir à jour** toute copie stockée ;
  - citer la Commission (services d'EPREL) ;
  - ne jamais laisser entendre un partenariat ou une approbation.
- Déclaration de confidentialité : votre nom et votre e-mail sont conservés tant que la clé sert.

## 3. Lever le doute sur la signature (avant toute dépense)

Les textes officiels se contredisent (voir `rapport_eprel.md` § 1). Les infobulles exigent un cachet ou une signature **qualifiés**. La note de l'étape 2 dit qu'une signature **simple** suffit. Un cachet qualifié s'achète chez un prestataire de confiance. Avant d'acheter quoi que ce soit, écrivez au support : **ENER-EPREL-HELPDESK@ec.europa.eu**.

Texte proposé (en anglais, langue de travail du support) :

> Subject: EPREL Public API key – type of electronic signature required for the EPREL Declaration
>
> Dear EPREL Helpdesk,
>
> We intend to request an EPREL Public API key as an organisation (a legal entity established in France) for a business application that estimates the volume of household appliances for removal quotes.
>
> The request form states that the EPREL Declaration must be sealed with a *qualified electronic seal* of the organisation, while the note of Step 2 states that a *simple* digital signature is sufficient and that advanced or qualified signatures are not required.
>
> Could you please confirm which of the following is accepted for an organisation:
> 1. a simple digital signature (PDF signed with a certificate identifying the legal representative);
> 2. an advanced electronic signature of the legal representative;
> 3. only a qualified electronic seal of the organisation?
>
> Could you also indicate the usual processing time, and where the Public API technical documentation can be read (it currently requires an EU Login account)?
>
> Kind regards,
> [Prénom Nom], [fonction], [organisation]

## 4. Remplir le formulaire

Adresse officielle : **https://eprel.ec.europa.eu/screen/requestpublicapikey** (aucun compte nécessaire).

| Champ du formulaire | À saisir |
| --- | --- |
| Requester type | *Company* (organisation) ou *Individual* (particulier) |
| Organisation name | raison sociale exacte |
| Legal representative | prénom et nom du représentant légal |
| Requester | prénom et nom de la personne qui fait la demande |
| Contact email address | l'adresse choisie au § 1 |
| Use of data | texte ci-dessous |
| Application name | nom de l'application (nom de travail accepté, à préciser) |
| Application URL | adresse en `https://` |
| Application description | texte ci-dessous |
| Cases à cocher | acceptation des conditions générales et de la déclaration de confidentialité (après lecture) |

**Use of data** (proposition, en anglais) :

> Our software helps removal companies prepare quotes. The overall dimensions (height, width, depth) of refrigerating appliances, wine coolers, freezers, dishwashers, washing machines, washer-dryers and tumble dryers are used to compute, for each appliance type, median reference dimensions and volumes, so that the volume of the appliances present in a home can be estimated. Data are aggregated per appliance type; individual records are not resold or republished. EPREL is credited as the source, and stored data are refreshed regularly.

**Application description** (proposition) :

> Web application for removal companies: customers film their home, the software prepares an inventory and an estimated volume, and the removal company checks it before sending its quote.

## 5. Signer et envoyer la déclaration

1. Cliquez sur « Download EPREL Declaration » (ou validez le formulaire : selon la version du site, un e-mail arrive avec le lien de dépôt).
2. **Relisez la déclaration** avant de la signer : identité, usage, engagements. En cas de doute sur un engagement, ne signez pas.
3. Signez ou scellez le PDF selon la réponse du support (§ 3). Un PDF scanné n'est pas une signature numérique.
4. Déposez le PDF signé par le lien reçu par e-mail (PDF, 2 Mo maximum).
5. Attendez l'e-mail de validation, qui contient la clé.

## 6. Après réception de la clé

1. **Ne collez jamais la clé dans la conversation.** Enregistrez-la comme variable d'environnement `EPREL_API_KEY` de l'environnement cloud « devis-scan » (réglages de l'environnement), puis ouvrez une nouvelle session.
2. Demandez-moi de lire la documentation technique. Si elle reste réservée à EU Login, vous pouvez créer vous-même un compte EU Login et me transmettre les pages utiles (adresses, en-tête de la clé, pagination, limites).
3. Je mettrai à jour `telecharger_eprel.py` (adresse, en-tête, pagination), puis je téléchargerai les groupes utiles en respectant les limites.
4. Je produirai une version de catalogue v6 où les fiches EPREL restent **au niveau de droits 3** tant que vous n'avez pas validé les conditions. Après votre validation explicite : `EPREL_CONDITIONS_VERIFIEES=1`, puis reconstruction.
5. **Obligations durables** :
   - rafraîchir les données (proposé : chaque mois) ;
   - conserver la mention de la source ;
   - supprimer toutes les copies si l'accès est retiré pour manquement.

## 7. Récapitulatif de ce qui vous revient

- [ ] Choisir le demandeur et l'adresse e-mail.
- [ ] Écrire au support au sujet de la signature.
- [ ] Lire et accepter les conditions.
- [ ] Remplir le formulaire.
- [ ] Signer la déclaration.
- [ ] Déposer le PDF.
- [ ] Enregistrer la clé dans l'environnement, jamais dans la conversation.
- [ ] Valider les conditions de réutilisation pour Devis Scan, si possible avec un juriste.
