"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Inbox, LayoutDashboard, Tag, UserRound, Users } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/components/ui/cn";

const ICONS = { dashboard: LayoutDashboard, inbox: Inbox, tag: Tag, building: Building2, users: Users, user: UserRound };

/** Liens de navigation de l'espace déménageur (charte : SidebarNav). */
export function AppNav({ pendingCount, onNavigate }: { pendingCount: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'espace" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium lg:h-10",
              active ? "bg-brand-soft text-brand-pressed" : "text-ink-secondary hover:bg-surface-subtle hover:text-ink",
            )}
          >
            <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
            {item.label}
            {item.href === "/espace/demandes" && pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-brand px-[7px] text-xs leading-5 font-semibold text-on-brand tabular-nums">
                {pendingCount}
                <span className="sr-only"> à traiter</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
