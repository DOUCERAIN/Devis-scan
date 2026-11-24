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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Caméra autorisée pour notre propre site (tournage des vidéos en phase 3).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  experimental: {
    // Envoi du logo (2 Mo maximum) par une action serveur, avec une marge pour l'enveloppe du formulaire.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
