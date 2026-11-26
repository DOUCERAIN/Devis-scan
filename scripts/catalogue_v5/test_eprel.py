"""Tests EPREL sur réponses FICTIVES (aucun appel réseau, aucune clé). Lancer : python3 -m unittest scripts/catalogue_v5/test_eprel.py"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from sources_eprel import lire_eprel  # noqa: E402


class TestEprel(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        os.environ.pop("EPREL_CONDITIONS_VERIFIEES", None)

    def ecrire(self, groupe, fiches):
        os.makedirs(os.path.join(self.tmp, "eprel", groupe), exist_ok=True)
        json.dump({"hits": fiches}, open(os.path.join(self.tmp, "eprel", groupe, "page-1.json"), "w"))

    def test_millimetres_et_droits_par_defaut(self):
        self.ecrire("refrigeratingappliances2019", [{"eprelRegistrationNumber": 1, "supplierOrTrademark": "Fictif", "modelIdentifier": "F1",
                                                    "dimensionHeight": 1850, "dimensionWidth": 595, "dimensionDepth": 650}])
        (obs, sc), = list(lire_eprel(self.tmp, "2026-11-26"))
        self.assertEqual((obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"]), (185.0, 65.0, 59.5))
        self.assertEqual(sc.id, "ELM-REF")
        self.assertIn("à confirmer", obs["statut_reutilisation"])

    def test_dimensions_imbriquees_et_emballage_ignore(self):
        self.ecrire("dishwashers2019", [{"eprelRegistrationNumber": 2, "overallDimensions": {"height": 85, "width": 60, "depth": 57},
                                         "packagingDimensions": {"height": 95, "width": 66, "depth": 70}, "nicheHeight": 82}])
        (obs, _), = list(lire_eprel(self.tmp, "2026-11-26"))
        self.assertEqual((obs["hauteur_cm"], obs["largeur_cm"], obs["profondeur_cm"]), (85.0, 60.0, 57.0))

    def test_dimension_manquante_jamais_completee(self):
        self.ecrire("washingmachines2019", [{"eprelRegistrationNumber": 3, "overallDimensions": {"height": 85, "width": 60}}])
        (obs, _), = list(lire_eprel(self.tmp, "2026-11-26"))
        self.assertIsNone(obs["profondeur_cm"])

    def test_conditions_verifiees_explicitement(self):
        os.environ["EPREL_CONDITIONS_VERIFIEES"] = "1"
        self.ecrire("tumbledriers20232534", [{"eprelRegistrationNumber": 4, "overallDimensions": {"height": 85, "width": 60, "depth": 65}}])
        (obs, _), = list(lire_eprel(self.tmp, "2026-11-26"))
        self.assertIn("vérifiées", obs["statut_reutilisation"])

    def test_telechargement_refuse_sans_cle(self):
        env = {k: v for k, v in os.environ.items() if k != "EPREL_API_KEY"}
        r = subprocess.run([sys.executable, os.path.join(ICI, "telecharger_eprel.py")], env=env, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("Aucune clé EPREL", r.stderr)


if __name__ == "__main__":
    unittest.main()
