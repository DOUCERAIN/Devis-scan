"""Contrôles du catalogue v6.1 : `python3 -m unittest scripts/catalogue_v6/test_enrichir.py`."""
import csv
import json
import sys
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
import enrichir  # noqa: E402
from releves_demenageurs import RELEVES, SOURCES  # noqa: E402

SORTIE = enrichir.SORTIE


class CatalogueV61(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (cls.cat, cls.produits, cls.v5, cls.base, cls.variantes, cls.ratios, _, cls.releves, cls.ordre, _) = enrichir.construire()

    # --- couverture et identifiants
    def test_311_sous_categories_identifiants_stables(self):
        self.assertEqual(len(self.base), 311)
        self.assertEqual(set(self.base), set(self.v5))

    def test_volume_ou_exception(self):
        for e in self.base.values():
            self.assertTrue(e["volume_demenagement_m3"] is not None or e["type_reference"] == "exception documentée", e["identifiant"])

    # --- décisions validées
    def test_carton_010(self):
        c = self.base["CAR-CARTON"]
        self.assertEqual(c["volume_demenagement_m3"], 0.10)
        self.assertEqual(c["type_reference"], "convention validée par Devis Scan")
        self.assertIn("pas une mesure", c["statut_validation"])

    def test_carton_010_dans_les_exports(self):
        with open(SORTIE / "catalogue_volumes_v6.csv", newline="") as f:
            l = {r["identifiant"]: r for r in csv.DictReader(f, delimiter=";")}
        self.assertEqual(float(l["CAR-CARTON"]["volume_demenagement_m3"]), 0.10)
        j = json.loads((SORTIE / "catalogue_volumes_v6.json").read_text())
        self.assertEqual(next(e for e in j["sous_categories"] if e["identifiant"] == "CAR-CARTON")["volume_demenagement_m3"], 0.10)
        self.assertFalse([v for v in j["variantes"] if v["variante_de"] == "CAR-CARTON"])

    def test_demenhouse_prioritaire_quand_il_correspond(self):
        for i, e in self.base.items():
            dh = [x for x in e["references_pro"] if x["source"] == "demenhouse" and x["valeur_m3"] is not None and not x["aberrant"]]
            if dh and i != "CAR-CARTON":
                if e["regle"].startswith("1"):
                    self.assertEqual(e["volume_demenagement_m3"], dh[0]["valeur_m3"], i)
                else:
                    self.assertTrue(e["rejets"], f"{i} : valeur Démén'House non retenue sans motif")

    def test_meuble_tv_demenhouse_non_retenu(self):
        self.assertNotEqual(self.base["RAN-MEUBLE-TV"]["volume_demenagement_m3"], 3.2)

    def test_valeur_retenue_est_une_valeur_publiee(self):
        """Aucune moyenne : une valeur professionnelle retenue existe telle quelle dans les relevés."""
        for i, e in self.base.items():
            if e["regle"][:1] in "123":
                publiees = {v for sc, v, *_ in RELEVES if sc == i and v is not None}
                self.assertIn(e["volume_demenagement_m3"], publiees, i)

    def test_fourchettes_jamais_reduites_au_milieu(self):
        for sc, v, b, h, *_ in RELEVES:
            self.assertTrue((v is None) == (b is not None and h is not None), (sc, v, b, h))

    def test_convention_lit_complet(self):
        q = self.base["LIT-QUEEN"]
        self.assertNotEqual(q["volume_demenagement_m3"], 1.2)  # « cadre et sommier sans matelas » écarté
        from inventaires_types import INVENTAIRES
        for inv in INVENTAIRES.values():
            ids = [sc for sc, _ in inv["objets"]]
            if any(i.startswith("LIT-") for i in ids):
                self.assertFalse([i for i in ids if i.startswith("MAT-") or i == "SOM-STD"], "literie comptée deux fois")

    # --- qualité et traçabilité
    def test_aucune_valeur_validee_par_un_professionnel(self):
        for e in self.base.values():
            self.assertNotIn("validé par un professionnel", e["statut_validation"])
            if e["identifiant"] != "CAR-CARTON":
                self.assertTrue(e["statut_validation"].startswith("non validé"), e["identifiant"])

    def test_fiabilite_moyenne_exige_corroboration_attribuee(self):
        for e in self.base.values():
            if e["fiabilite_demenagement"] == "moyenne":
                self.assertTrue(e["pro"]["corroboration_attribuee"], e["identifiant"])

    def test_sources_anonymes_comptent_pour_une(self):
        for e in self.base.values():
            att = {x["domaine"] for x in e["references_pro"] if x["attribution"] == "attribuée" and not x["aberrant"]}
            self.assertLessEqual(e["nb_sources_independantes_pro"], len(att) + 1)

    def test_14_domaines_attribues(self):
        dom = {SOURCES[r[4]][0] for r in RELEVES if r[5] == "attribuée"}
        self.assertEqual(len(dom), 14, sorted(dom))

    def test_estimations_jamais_presentees_comme_mesures(self):
        for e in self.base.values():
            if e.get("estimation_ia") and not e["estimation_ia"]["dimensions_mesurees"]:
                self.assertEqual(e["statut_geo"], "estimé (IA)")
                self.assertIn("PAS une médiane", e["methode_geo"])

    def test_geometrique_v5_inchange_sauf_exclusions(self):
        for i, e in self.base.items():
            if e["statut_geo"] == "mesuré" and not e["produits_exclus_v6_1"]:
                self.assertEqual(e["volume_geometrique_m3"], self.v5[i]["volume_geometrique_median_m3"], i)

    def test_produits_mal_classes_exclus_mais_conserves(self):
        with open(SORTIE / "mesures_individuelles.csv", newline="") as f:
            m = list(csv.DictReader(f, delimiter=";"))
        exclus = [r for r in m if r["statut_mesure"] == "mesuré — exclu v6.1 (mal classé)"]
        self.assertTrue(exclus)
        self.assertEqual({r["sous_categorie_id"] for r in exclus}, {"RES-DISTRIBUTEUR", "PRO-COMPTOIR", "PRO-PRESENTOIR", "ENF-CHAISE-HAUTE"})

    def test_mesures_individuelles_toutes_conservees(self):
        with open(SORTIE / "mesures_individuelles.csv", newline="") as f:
            ids = {r["id_produit"] for r in csv.DictReader(f, delimiter=";") if r["id_produit"]}
        for r in self.v5.values():
            for pid in r.get("produits_utilises", []) + r.get("produits_exclus", []):
                if pid in self.produits:
                    self.assertIn(pid, ids)

    def test_rigide_jamais_sous_son_volume(self):
        for e in self.base.values():
            if e["classe_manutention"] in ("appareils et objets rigides", "meubles et objets non démontables") and e["statut_geo"] == "mesuré" and e["regle"][:1] in "123":
                self.assertGreaterEqual(e["volume_demenagement_m3"], 0.8 * e["volume_geometrique_m3"], e["identifiant"])

    def test_ordres_incoherents_signales(self):
        with open(SORTIE / "anomalies.csv", newline="") as f:
            signales = {r["sous_categories"] for r in csv.DictReader(f, delimiter=";") if r["type"] == "ordre incohérent entre variantes"}
        for petit, grand in enrichir.ORDRES_ATTENDUS:
            vp, vg = self.base[petit]["volume_demenagement_m3"], self.base[grand]["volume_demenagement_m3"]
            if vp >= vg:
                self.assertIn(f"{petit}, {grand}", signales)

    def test_anomalies_ont_un_etat(self):
        with open(SORTIE / "anomalies.csv", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                self.assertIn(r["etat_resolution"], ("ouverte", "contournée provisoirement", "résolue"))
                self.assertTrue(r["id"].startswith("ANO-"))

    def test_exports_coherents_avec_les_donnees(self):
        with open(SORTIE / "catalogue_volumes_v6.csv", newline="") as f:
            l = list(csv.DictReader(f, delimiter=";"))
        self.assertEqual(len(l), 311)
        for r in l:
            e = self.base[r["identifiant"]]
            v = e["volume_demenagement_m3"]
            self.assertEqual(r["volume_demenagement_m3"], "" if v is None else str(v))
            g = e["volume_geometrique_m3"]
            self.assertEqual(r["volume_geometrique_m3"], "" if g is None else str(g))

    def test_variantes_heritees_explicites(self):
        self.assertEqual(len(self.variantes), 204)
        for v in self.variantes:
            self.assertEqual(v["type_reference"], "hérité de la sous-catégorie parente")
            self.assertEqual(v["fiabilite_demenagement"], "provisoire")

    def test_revue_40(self):
        with open(SORTIE / "revue_40_categories.csv", newline="") as f:
            l = list(csv.DictReader(f, delimiter=";"))
        self.assertEqual(len(l), 40)
        self.assertEqual(len({r["id_devis_scan"] for r in l}), 40)
        for r in l:
            self.assertTrue(r["question_au_professionnel"])

    def test_v5_non_modifiee(self):
        brut = json.loads((enrichir.V5 / "catalogue_devis_scan.json").read_text())
        self.assertEqual(brut["version"], self.cat["version"])


if __name__ == "__main__":
    unittest.main()
