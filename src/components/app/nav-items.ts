export const NAV_ITEMS = [
  { href: "/espace", label: "Tableau de bord", icon: "dashboard", exact: true },
  { href: "/espace/demandes", label: "Demandes", icon: "inbox", exact: false },
  { href: "/espace/tarifs", label: "Tarifs et options", icon: "tag", exact: false },
  { href: "/espace/entreprise", label: "Entreprise", icon: "building", exact: false },
  { href: "/espace/equipe", label: "Équipe", icon: "users", exact: false },
  { href: "/espace/profil", label: "Mon profil", icon: "user", exact: false },
] as const;
