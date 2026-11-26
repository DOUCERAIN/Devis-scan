import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chargerCatalogue, type Catalogue } from "./catalogue.ts";
import { depuisV1 } from "./compat_v1.ts";
import { texteCatalogue, versionConsignes, CONSIGNES_V2 } from "./consignes.ts";
import { lireReponse, VERSION_CONTRAT, type ObjetIA, type ReponsePiece } from "./contrat.ts";
import { analyserAvecSecours, comparer, FournisseurSimule, rejouer, type EntreePiece } from "./fournisseurs.ts";
import { rechercherCandidates } from "./recherche.ts";
import { resoudreObjet, resoudrePiece, totaux } from "./resolution.ts";

/**
 * Tests SIMULÉS de l'intégration catalogue ↔ IA (aucun appel réseau, aucun modèle réel, aucune dépense).
 * Lancer : node --test prototypes/integration-catalogue/
 */
const cat = chargerCatalogue();
const CAS = JSON.parse(readFileSync(new URL("./cas_tests.json", import.meta.url), "utf8"));
const car0 = { nb_portes: null, nb_places: null, nb_tiroirs: null, largeur_couchage_cm: null, diagonale_pouces: null, forme: null, materiau: null, portes_coulissantes: null, extensible: null, demontable_apparent: null, fragile: null, ancien: null };

function objet(p: Partial<ObjetIA> & { id_objet: string; libelle: string }): ObjetIA {
  return {
    famille_id: "DIV", sous_categorie_id: null, reference_id: null, statut_reference: "trouvee", alternatives: [], quantite: 1,
    exemplaires: [{ id_exemplaire: `${p.id_objet}-1`, images: [0], cadres: [{ image: 0, x: 0.1, y: 0.1, largeur: 0.3, hauteur: 0.6 }], position_piece: "mur du fond", signes_distinctifs: "" }],
    caracteristiques: car0, dimensions_apparentes_cm: null, indices: ["forme visible"], confiance: 0.9, motif_incertitude: null, doute_identite: null, ...p,
  };
}
const reponse = (objets: ObjetIA[]): ReponsePiece => ({ version_contrat: VERSION_CONTRAT, objets, remarques_piece: "" });
const entree: EntreePiece = { id_analyse: "an-1", id_piece: "p-1", nom_piece: "Chambre", images: [], consignes: CONSIGNES_V2, version_consignes: versionConsignes(CONSIGNES_V2) };

// ------------------------------------------------------------------ catalogue et cas de test
test("les cas de test correspondent au catalogue actuel (même empreinte)", () => {
  assert.equal(CAS.empreinte_catalogue_sha256, cat.empreinte_catalogue_sha256, "catalogue modifié : regénérer cas_tests.json et revoir les attentes");
});

for (const c of CAS.cas) {
  test(`cas « ${c.objet_attendu} » : recherche, choix et volume lus dans le catalogue`, () => {
    const candidates = rechercherCandidates(cat, c.requete, 5).map((x) => x.id);
    if (c.reference_attendue) {
      assert.ok(candidates.slice(0, 3).includes(c.reference_attendue), `${c.reference_attendue} absent des 3 premières candidates : ${candidates.join(", ")}`);
      const el = resoudreObjet(cat, objet({ id_objet: "o1", libelle: c.objet_attendu, famille_id: c.requete.famille_id, reference_id: c.reference_attendue, sous_categorie_id: c.sous_categorie_attendue }), candidates);
      assert.equal(el.statut, "trouvee");
      assert.equal(el.sous_categorie_id, c.sous_categorie_attendue);
      const v = c.volume_catalogue_attendu;
      assert.equal(el.volume.statut, v.statut);
      assert.equal(el.volume.geometrique_unitaire_m3?.mediane ?? null, v.geometrique_mediane_m3);
      assert.equal(el.volume.demenagement_reference_unitaire_m3, v.demenagement_reference_m3);
      assert.equal(el.volume.fiabilite, v.fiabilite);
      for (const variante of c.variantes_possibles) assert.ok(cat.references.some((r) => r.id === variante), `variante ${variante} inexistante`);
    } else {
      // Objet absent du catalogue : le modèle répond « inconnue » ; jamais de volume
      const el = resoudreObjet(cat, objet({ id_objet: "o1", libelle: c.objet_attendu, statut_reference: "inconnue", dimensions_apparentes_cm: c.requete.dimensions_apparentes_cm }));
      assert.equal(el.statut, "inconnue");
      assert.equal(el.volume.statut, "non_disponible");
      assert.equal(el.volume.geometrique_unitaire_m3, null);
      assert.equal(el.confirmation_requise, true);
    }
  });
}

test("objet sans aucun équivalent : la recherche ne propose rien plutôt qu'une référence absurde", () => {
  assert.deepEqual(rechercherCandidates(cat, { libelle: "cabine de sauna d'intérieur" }), []);
});

test("caractéristique visible : la référence précise passe devant le repli « non précisé »", () => {
  const c = rechercherCandidates(cat, { libelle: "armoire", famille_id: "ARM", caracteristiques: { nb_portes: 4 } });
  assert.equal(c[0].id, "ARM-4P");
  const sans = rechercherCandidates(cat, { libelle: "canapé", famille_id: "CAN" }).map((x) => x.id);
  assert.ok(sans.includes("CAN-NC"), "le repli reste proposé quand le nombre de places n'est pas visible");
});

// ------------------------------------------------------------------ contrat
test("contrat : une réponse conforme est acceptée", () => {
  const r = lireReponse(JSON.stringify(reponse([objet({ id_objet: "o1", libelle: "armoire", famille_id: "ARM", reference_id: "ARM-2P" })])));
  assert.equal(r.ok, true);
});

test("contrat : un volume ou un prix glissé dans la réponse est refusé", () => {
  const o = { ...objet({ id_objet: "o1", libelle: "armoire", reference_id: "ARM-2P" }), volume_m3: 3 };
  const r = lireReponse(JSON.stringify(reponse([o as ObjetIA])));
  assert.equal(r.ok, false);
  const p = lireReponse(JSON.stringify({ ...reponse([]), prix: 1000 }));
  assert.equal(p.ok, false);
});

test("contrat : réponse non JSON ou mauvaise version refusée sans exception", () => {
  assert.equal(lireReponse("Voici l'inventaire : une armoire").ok, false);
  assert.equal(lireReponse(JSON.stringify({ ...reponse([]), version_contrat: "1.0" })).ok, false);
});

test("contrat : le schéma JSON publié a exactement les champs du contrat zod", () => {
  const s = JSON.parse(readFileSync(new URL("../../docs/preparation-integration-catalogue/contrat_commun_ia.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(s.properties).sort(), ["objets", "remarques_piece", "version_contrat"]);
  assert.deepEqual(Object.keys(s.properties.objets.items.properties).sort(), Object.keys(objet({ id_objet: "x", libelle: "x" })).sort());
  assert.equal(s.properties.objets.items.additionalProperties, false);
});

// ------------------------------------------------------------------ résolution
test("un identifiant inventé est refusé : aucun volume, confirmation requise", () => {
  const el = resoudreObjet(cat, objet({ id_objet: "o1", libelle: "armoire", famille_id: "ARM", reference_id: "ARM-2P-XXL" }));
  assert.equal(el.statut, "identifiant_inexistant");
  assert.equal(el.reference_id, null);
  assert.equal(el.volume.statut, "non_disponible");
  assert.equal(el.confirmation_requise, true);
  assert.equal(el.niveau_confiance, "incertain");
});

test("un doute du modèle ou une confiance faible entraîne une confirmation, jamais un choix silencieux", () => {
  const a = resoudreObjet(cat, objet({ id_objet: "o1", libelle: "armoire", famille_id: "ARM", reference_id: "ARM-NC", statut_reference: "a_confirmer", alternatives: [{ reference_id: "ARM-2P", raison: "deux portes probables" }, { reference_id: "ARM-3P", raison: "troisième porte cachée ?" }], motif_incertitude: "porte de droite masquée" }));
  assert.equal(a.confirmation_requise, true);
  assert.deepEqual(a.alternatives, ["ARM-2P", "ARM-3P"]);
  const b = resoudreObjet(cat, objet({ id_objet: "o2", libelle: "canapé", famille_id: "CAN", reference_id: "CAN-3P", confiance: 0.4 }));
  assert.equal(b.confirmation_requise, true);
  assert.equal(b.niveau_confiance, "incertain");
});

test("incohérence famille / sous-catégorie : référence conservée mais soumise à confirmation", () => {
  const el = resoudreObjet(cat, objet({ id_objet: "o1", libelle: "lit", famille_id: "LIT", reference_id: "ARM-2P", sous_categorie_id: "LIT-DOUBLE" }));
  assert.equal(el.statut, "a_confirmer");
  assert.ok(el.motifs.some((m) => m.includes("incohérente")));
});

test("le volume vient toujours du catalogue, jamais des dimensions apparentes du modèle", () => {
  const el = resoudreObjet(cat, objet({ id_objet: "o1", libelle: "armoire", famille_id: "ARM", reference_id: "ARM-2P", dimensions_apparentes_cm: { hauteur: 400, largeur: 400, profondeur: 400 } }));
  const ref = cat.references.find((r) => r.id === "ARM-2P")!;
  assert.equal(el.volume.geometrique_unitaire_m3?.mediane, ref.volume_geometrique_m3.mediane);
  assert.deepEqual(el.dimensions_apparentes_cm, { hauteur: 400, largeur: 400, profondeur: 400 });
});

test("totaux : géométrique et déménagement restent séparés ; objets sans volume listés", () => {
  const els = resoudrePiece(cat, reponse([
    objet({ id_objet: "o1", libelle: "armoire", famille_id: "ARM", reference_id: "ARM-2P", quantite: 2 }),
    objet({ id_objet: "o2", libelle: "réfrigérateur américain", famille_id: "ELM", reference_id: "ELM-REF-US" }),
  ]));
  const t = totaux(els);
  assert.equal(t.volume_geometrique_m3, Math.round(2 * 0.876 * 1000) / 1000);
  assert.equal(t.volume_demenagement_reference_m3, 1.6);
  assert.deepEqual(t.elements_sans_volume, ["o2"]);
});

// ------------------------------------------------------------------ fournisseurs
const objetsSimules = [
  objet({ id_objet: "o1", libelle: "armoire deux portes", famille_id: "ARM", reference_id: "ARM-2P", sous_categorie_id: "ARM-2P", caracteristiques: { ...car0, nb_portes: 2 } }),
  objet({ id_objet: "o2", libelle: "lit double", famille_id: "LIT", reference_id: "LIT-DOUBLE", sous_categorie_id: "LIT-DOUBLE", caracteristiques: { ...car0, largeur_couchage_cm: 140 } }),
  objet({ id_objet: "o3", libelle: "objet inconnu", statut_reference: "inconnue" }),
];
const fournisseurA = new FournisseurSimule("simulation-a", "modele-a", () => JSON.stringify(reponse(objetsSimules)));
// B : même contenu, clés dans un autre ordre, JSON entouré de balises (habitude de certains modèles)
const fournisseurB = new FournisseurSimule("simulation-b", "modele-b", () => "```json\n" + JSON.stringify({ remarques_piece: "", objets: [...objetsSimules].map((o) => Object.fromEntries(Object.entries(o).reverse())), version_contrat: VERSION_CONTRAT }, null, 2) + "\n```");

test("résultat identique quel que soit le fournisseur", async () => {
  const a = await analyserAvecSecours([fournisseurA], entree, cat);
  const b = await analyserAvecSecours([fournisseurB], entree, cat);
  assert.ok(a.retenue && b.retenue);
  assert.equal(comparer(a.elements, b.elements).identiques, true);
  assert.notEqual(a.retenue!.fournisseur, b.retenue!.fournisseur);
});

test("fournisseur de secours : erreur, puis réponse invalide, puis réponse valide ; toutes les tentatives conservées", async () => {
  const enPanne = new FournisseurSimule("panne", "x", () => { throw new Error("délai dépassé"); });
  const bavard = new FournisseurSimule("bavard", "y", () => "Je vois une armoire.");
  const r = await analyserAvecSecours([enPanne, bavard, fournisseurA], entree, cat, () => "2026-11-26T10:00:00Z");
  assert.equal(r.tentatives.length, 3);
  assert.equal(r.retenue?.fournisseur, "simulation-a");
  assert.match(r.tentatives[0].erreur ?? "", /délai/);
  assert.equal(r.tentatives[1].reponse_brute, "Je vois une armoire.");
  assert.equal(r.retenue?.version_catalogue, cat.version_catalogue);
  assert.equal(r.retenue?.version_consignes, entree.version_consignes);
});

test("comparaison de deux fournisseurs : les différences sont listées objet par objet", async () => {
  const autre = new FournisseurSimule("simulation-c", "z", () => JSON.stringify(reponse([{ ...objetsSimules[0], reference_id: "ARM-3P", sous_categorie_id: "ARM-3P" }, objetsSimules[1]])));
  const a = await analyserAvecSecours([fournisseurA], entree, cat);
  const c = await analyserAvecSecours([autre], entree, cat);
  const diff = comparer(a.elements, c.elements);
  assert.equal(diff.identiques, false);
  assert.ok(diff.differences.some((d) => d.id_objet === "o1" && d.champ === "reference_id"));
  assert.ok(diff.differences.some((d) => d.id_objet === "o3" && d.champ === "présence"));
});

// ------------------------------------------------------------------ évolution du catalogue et anciennes réponses
test("le catalogue peut évoluer sans casser les anciens dossiers (identifiant remplacé)", async () => {
  const a = await analyserAvecSecours([fournisseurA], entree, cat);
  const ref = cat.references.find((r) => r.id === "ARM-2P")!;
  const futur: Catalogue = {
    ...cat, version_catalogue: "6.0-essai", remplacements: { "ARM-2P": "ARM-2P-BATTANTES" },
    references: [...cat.references.filter((r) => r.id !== "ARM-2P"), { ...ref, id: "ARM-2P-BATTANTES", nom: "Armoire 2 portes battantes" }],
  };
  const rejoue = rejouer(a.retenue!, futur);
  const o1 = rejoue.find((e) => e.id_objet === "o1")!;
  assert.equal(o1.statut, "remplacee");
  assert.equal(o1.reference_id, "ARM-2P-BATTANTES");
  assert.equal(o1.reference_demandee, "ARM-2P");
  assert.equal(o1.volume.geometrique_unitaire_m3?.mediane, ref.volume_geometrique_m3.mediane);
});

test("réponse IA V1 (ancien format, identifiants de l'ancien catalogue) relue au format 2.0", () => {
  const v1 = {
    objects: [
      { label: "Armoire", catalog_id: "armoire-2-portes", quantity: 1, confidence: 0.9, visibility: "visible" as const, image_indexes: [0, 2], dimensions_cm: null, is_fragile: false, needs_disassembly: true, notes: "" },
      { label: "Statue", catalog_id: "autre", quantity: 1, confidence: 0.7, visibility: "visible" as const, image_indexes: [1], dimensions_cm: { width: 40, depth: 40, height: 120 }, is_fragile: true, needs_disassembly: false, notes: "" },
      { label: "Lit", catalog_id: "lit-king-size", quantity: 1, confidence: 0.5, visibility: "uncertain" as const, image_indexes: [3], dimensions_cm: null, is_fragile: false, needs_disassembly: true, notes: "" },
    ],
    room_notes: "",
  };
  const v2 = depuisV1(v1, cat);
  assert.equal(lireReponse(JSON.stringify(v2)).ok, true, "la conversion produit un contrat 2.0 valide");
  const els = resoudrePiece(cat, v2);
  assert.equal(els[0].statut, "alias_historique");
  assert.equal(els[0].reference_id, "ARM-2P");
  assert.equal(els[1].statut, "inconnue");
  assert.equal(els[1].volume.statut, "non_disponible");
  assert.equal(els[2].reference_id, "LIT-KING");
  assert.equal(els[2].confirmation_requise, true);
});

test("les 134 identifiants historiques pointent tous vers une référence existante ou sont signalés", () => {
  const ids = new Set(cat.references.map((r) => r.id));
  const sans = Object.entries(cat.alias_historiques).filter(([, a]) => !a.reference_principale || !ids.has(a.reference_principale)).map(([k]) => k);
  assert.equal(Object.keys(cat.alias_historiques).length, 134);
  assert.ok(sans.length <= 2, `identifiants historiques sans correspondance : ${sans.join(", ")}`);
});

// ------------------------------------------------------------------ consignes
test("les consignes et le catalogue remis au modèle ne contiennent ni volume ni prix, et sont stables", () => {
  const t = texteCatalogue(cat);
  assert.ok(!/m³|m3|€|volume/i.test(t));
  assert.equal(texteCatalogue(cat), t);
  assert.equal(versionConsignes(CONSIGNES_V2 + t), versionConsignes(CONSIGNES_V2 + texteCatalogue(cat)));
});
