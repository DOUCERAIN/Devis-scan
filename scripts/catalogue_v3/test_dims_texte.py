"""python3 -m unittest scripts/catalogue_v3/test_dims_texte.py"""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dims_texte import extraire, vers_hlp


class TestDims(unittest.TestCase):
    def cas(self, texte, attendu):
        d, _ = extraire(texte)
        self.assertEqual(vers_hlp(d), attendu, texte)

    def test_formats_musees(self):
        self.cas("35 1/4 x 23 1/2 x 20 in. (89.5 x 59.7 x 50.8 cm)", (89.5, 59.7, 50.8))
        self.cas("Overall: 102.9 x 62.2 x 48.3 cm (40 1/2 x 24 1/2 x 19 in.)", (102.9, 62.2, 48.3))
        self.cas("overall: 9 1/2 in x 13 7/8 in x 16 in; 24.13 cm x 35.2425 cm x 40.64 cm", (24.1, 40.6, 35.2))
        self.cas("H. 84 1/2, W. 42, D. 21 in. (214.6 x 106.7 x 53.3 cm)", (214.6, 106.7, 53.3))
        self.cas("H. 214.6 cm, W. 106.7 cm, D. 53.3 cm", (214.6, 106.7, 53.3))
        self.cas("Seat: 45 cm; Overall: 80 x 50 x 55 cm", (80.0, 55.0, 50.0))

    def test_incomplet_jamais_complete(self):
        self.cas("overall: 21 1/2 in x 23 1/2 in; 54.61 cm x 59.69 cm", (54.6, 59.7, None))
        d, suppose = extraire("overall: 12 in; 30.48 cm")
        self.assertEqual(sum(v is not None for v in vers_hlp(d)), 1)
        self.assertEqual(extraire("bois et laiton")[0], None)

    def test_pouces_seuls(self):
        self.cas("41 x 22 x 20 in.", (104.1, 55.9, 50.8))


if __name__ == "__main__":
    unittest.main()
