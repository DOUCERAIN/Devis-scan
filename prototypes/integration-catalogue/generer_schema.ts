// Génère docs/preparation-integration-catalogue/contrat_commun_ia.json depuis contrat.ts : node prototypes/integration-catalogue/generer_schema.ts > docs/preparation-integration-catalogue/contrat_commun_ia.json
import { z } from "zod";
import { reponsePieceSchema, enveloppeSchema } from "./contrat.ts";
const s = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://devis-scan.local/contrats/analyse-piece-2.0.json",
  title: "Contrat commun des réponses IA Devis Scan — version 2.0",
  description: "Réponse d'un modèle de reconnaissance (tout fournisseur) pour une pièce. Le modèle ne renvoie jamais de volume ni de prix : il désigne une référence existante du catalogue Devis Scan ; le serveur vérifie l'identifiant et lit dimensions et volumes dans le catalogue. Généré depuis prototypes/integration-catalogue/contrat.ts (zod).",
  ...z.toJSONSchema(reponsePieceSchema),
  $defs: { enveloppe_serveur: { description: "Ajoutée par le serveur, jamais par le modèle : traçabilité et rejeu.", ...z.toJSONSchema(enveloppeSchema) } },
};
process.stdout.write(JSON.stringify(s, null, 2));
