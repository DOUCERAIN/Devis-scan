# Catalogue Devis Scan v6 — volumes de référence (préparatoire)

Construit le 26/11/2026 à partir du catalogue v5. La v5 n'est pas modifiée.

**Rien n'est branché** : ni la base de données, ni le moteur IA, ni le moteur de devis.

Le catalogue donne, pour chacune des 311 sous-catégories, deux volumes distincts :
- un **volume géométrique** : mesuré, partiellement mesuré ou estimé par l'IA ;
- un **volume de déménagement de référence**, issu de relevés publics de déménageurs, d'un comparable ou d'une analogie de classe.

Chaque volume porte son statut, sa fiabilité et sa méthode. Aucune valeur n'est « vérifiée » : aucun déménageur pilote ne les a encore validées.

Pour les chiffres, les limites et les décisions à prendre : `rapport_avancement.md`.

**Reconstruction** :

```bash
python3 scripts/catalogue_v6/enrichir.py
```

**Contrôles** :

```bash
python3 -m unittest scripts/catalogue_v6/test_enrichir.py
```
