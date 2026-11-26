"""Contrôles du catalogue v6 : `python3 -m unittest scripts/catalogue_v6/test_enrichir.py`."""
import json
import sys
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
import enrichir  # noqa: E402


class CatalogueV6(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cat, _, cls.v5, cls.base, cls.variantes, cls.ratios, _, _ = enrichir.construire()

    def test_311_sous_categories_et_identifiants_stables(self):
        self.assertEqual(len(self.base), 311)
        self.assertEqual(set(self.base), set(self.v5))

    def test_couverture_numerique_ou_exception(self):
        for e in self.base.values():
            ok = e["volume_demenagement_m3"] is not None or e["statut_demenagement"] == "exception documentée"
            self.assertTrue(ok, e["identifiant"])

    def test_aucune_valeur_presentee_comme_verifiee(self):
        self.assertFalse(any(e["statut_global"] == "vérifié" for e in self.base.values()))

    def test_estimations_jamais_presentees_comme_mesures(self):
        for e in self.base.values():
            if e.get("estimation_ia") and not e["estimation_ia"]["dimensions_mesurees"]:
                self.assertEqual(e["statut_geo"], "estimé (IA)")
                self.assertEqual(e["fiabilite_geo"], "provisoire")
                self.assertIn("PAS une médiane", e["methode_geo"])

    def test_mediane_mesuree_reprise_de_la_v5_sans_changement(self):
        for i, e in self.base.items():
            if e["statut_geo"] == "mesuré":
                self.assertEqual(e["volume_geometrique_m3"], self.v5[i]["volume_geometrique_median_m3"])

    def test_geometrique_et_demenagement_distincts(self):
        for e in self.base.values():
            self.assertIn("volume_geometrique_m3", e)
            self.assertIn("volume_demenagement_m3", e)
            self.assertNotEqual(e["methode_geo"], e["methode_demenagement"])

    def test_seuils_de_fiabilite(self):
        f = enrichir.fiabilite_geo
        self.assertEqual(f(10, 3, 0.5), "élevée")
        self.assertEqual(f(10, 2, 0.5), "moyenne")
        self.assertEqual(f(5, 2, 0.5), "moyenne")
        self.assertEqual(f(4, 4, 0.5), "provisoire")
        self.assertEqual(f(50, 5, 1.4), "moyenne")  # dispersion forte : un niveau de moins
        self.assertEqual(f(0, 0, None), "provisoire")

    def test_estime_seulement_avec_au_moins_deux_releves(self):
        for e in self.base.values():
            if e["statut_demenagement"] == "estimé":
                self.assertGreaterEqual(e["nb_releves"], 2)
            if e["fiabilite_demenagement"] == "moyenne":
                self.assertGreaterEqual(e["nb_sources_releves"], 3)

    def test_releve_aberrant_ecarte(self):
        self.assertLess(self.base["ELM-MO"]["volume_demenagement_m3"], 0.2)

    def test_volumes_positifs_et_plausibles(self):
        for e in self.base.values():
            v = e["volume_demenagement_m3"]
            if v is not None:
                self.assertGreater(v, 0, e["identifiant"])
                self.assertLess(v, 10, e["identifiant"])

    def test_variantes_toutes_couvertes(self):
        self.assertEqual(len(self.variantes), 204)
        self.assertTrue(all(v["volume_demenagement_m3"] is not None for v in self.variantes))

    def test_ordre_des_variantes_importantes(self):
        b = self.base
        v = lambda i: b[i]["volume_demenagement_m3"]  # noqa: E731
        self.assertLess(v("ARM-2P"), v("ARM-3P"))
        self.assertLess(v("ARM-3P"), v("ARM-4P"))
        self.assertLess(v("ELM-REF-TOP"), v("ELM-REF"))
        self.assertLess(v("ELM-REF"), v("ELM-REF-US"))
        self.assertLess(v("CAN-2P"), v("CAN-3P"))
        self.assertLess(v("CAN-3P"), v("CAN-ANG"))
        self.assertLess(v("LIT-SIMPLE"), v("LIT-DOUBLE"))
        self.assertLess(v("LIT-DOUBLE"), v("LIT-SUPERP"))
        self.assertLess(v("TAB-4"), v("TAB-6"))
        self.assertLess(v("TAB-6"), v("TAB-8+"))
        self.assertLess(v("BUR-DROIT"), v("BUR-ANGLE"))
        self.assertLess(v("INF-TV-43"), v("INF-TV-55"))
        self.assertLess(v("INF-TV-55"), v("INF-TV-75"))

    def test_v5_non_modifiee(self):
        brut = json.loads((enrichir.V5 / "catalogue_devis_scan.json").read_text())
        self.assertEqual(brut["version"], self.cat["version"])


if __name__ == "__main__":
    unittest.main()
