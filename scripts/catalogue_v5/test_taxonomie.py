"""Tests de la classification (python3 -m unittest scripts/catalogue_v2/test_taxonomie.py)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from taxonomie import FAMILLES, PAR_ID, SOUS_CATEGORIES, classer  # noqa: E402
from sources_abo import dimensions_du_nom, normaliser  # noqa: E402


class TestTaxonomie(unittest.TestCase):
    def test_identifiants_uniques_et_familles_connues(self):
        self.assertEqual(len(PAR_ID), len(SOUS_CATEGORIES))
        familles = {f for f, _ in FAMILLES}
        self.assertTrue(all(s.famille in familles for s in SOUS_CATEGORIES))

    def test_exemples_reels(self):
        cas = [
            ("Amazon Brand - Solimo Pyxis Engineered Wood 2-Door Wardrobe", "CABINET", "ARM-2P"),
            ("Amazon Brand - Movian Morava 4-Door 2-Drawer Wardrobe with Mirrors", "CABINET", "ARM-4P"),
            ("Movian Ola - 3 Seater Sofa - 88L x 200W x 79H cm", "SOFA", "CAN-3P"),
            ("Marque Amazon - Movian Lina - Canapé 2,5 places", "SOFA", "CAN-NC"),
            ("Stone & Beam Tisbury Nailhead Trim King Bed, 84\"W", "BED", "LIT-KING"),
            ("Movian Atran 4-Drawer Chest, 220 x 84 x 50cm", "CABINET", "COM-4T"),
            ("Ravenna Home Angela Modern Turned Leg Coffee Table", "TABLE", "TAB-BASSE"),
            ("AmazonBasics Racing Style Office Chair", "CHAIR", "FAU-BUR"),
        ]
        for nom, type_produit, attendu in cas:
            s = classer(normaliser(nom), type_produit)
            self.assertIsNotNone(s, nom)
            self.assertEqual(s.id, attendu, nom)

    def test_faux_positifs_ecartes(self):
        for nom, type_produit in [
            ("AmazonBasics - Set di 4 batterie a bottone al litio CR2032", "BATTERY"),
            ("AmazonBasics Dect Home Telephone, with answering machine", "LANDLINE_PHONE"),
            ("AmazonBasics Replacement GE Refrigerator Water Filter", "MAJOR_HOME_APPLIANCES"),
            ("Amazon Basics - Funda para cortacésped", "OUTDOOR_LIVING"),
            ("AmazonBasics Cat Condo Ottoman, Grey", "OTTOMAN"),
        ]:
            s = classer(normaliser(nom), type_produit)
            self.assertTrue(s is None or s.id in ("DIV-AUTRE",), f"{nom} -> {s.id if s else None}")

    def test_dimensions_du_nom(self):
        self.assertEqual(dimensions_du_nom("Movian Lek - Cómoda, 65 x 119 x 40 cm"), [65.0, 119.0, 40.0])
        self.assertAlmostEqual(dimensions_du_nom('Console Entry Table, 47.2"W, Grey')[0], 119.888, places=2)
        self.assertEqual(dimensions_du_nom("Armoire sans dimension"), [])


if __name__ == "__main__":
    unittest.main()
