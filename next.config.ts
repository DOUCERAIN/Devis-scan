import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le mode « Cache Components » de Next.js 16 est volontairement désactivé :
  // l'espace déménageur dépend de la session à chaque requête, et le modèle
  // classique (rendu dynamique dès qu'on lit les cookies) est plus simple et plus sûr.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  experimental: {
    // Envoi du logo (2 Mo maximum) par une action serveur, avec une marge pour l'enveloppe du formulaire.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
