"use client";

import type { KeyboardEvent } from "react";
import { FLOOR_Y, SCENE_HEIGHT, SCENE_WIDTH, SCENES } from "@/lib/inventory/scenes";
import type { RoomTabKey } from "@/lib/inventory/rooms";
import { ShapeDrawing } from "./shapes";

/**
 * Illustration interactive d'une pièce : chaque meuble est une zone cliquable distincte (clavier compris),
 * reliée à un identifiant exact du catalogue. Un appui ajoute un exemplaire ; la quantité choisie s'affiche
 * sur le meuble. `pulse` : identifiant de l'objet qui vient d'être ajouté (retour visuel immédiat).
 */
export function RoomScene({ tab, names, quantities, pulse, onPick }: {
  tab: RoomTabKey;
  names: ReadonlyMap<string, string>;
  quantities: ReadonlyMap<string, number>;
  pulse: { key: string; n: number } | null;
  onPick: (catalogKey: string) => void;
}) {
  const scene = SCENES[tab];
  const keyDown = (e: KeyboardEvent, key: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(key);
    }
  };
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-border bg-surface-subtle" data-testid="room-scene">
      <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} className="block h-auto w-full select-none" role="group" aria-label={`${scene.title} : appuyez sur un meuble pour l'ajouter`}>
        <rect x={0} y={0} width={SCENE_WIDTH} height={FLOOR_Y} fill="var(--ds-surface)" />
        <rect x={0} y={FLOOR_Y} width={SCENE_WIDTH} height={SCENE_HEIGHT - FLOOR_Y} fill="var(--ds-surface-subtle)" />
        <line x1={0} y1={FLOOR_Y} x2={SCENE_WIDTH} y2={FLOOR_Y} stroke="var(--ds-border-input)" strokeWidth={2} />
        {scene.objects.map((obj, index) => {
          const [x, y, w, h] = obj.box;
          const name = names.get(obj.catalogKey) ?? obj.catalogKey;
          const qty = quantities.get(obj.catalogKey) ?? 0;
          const popping = pulse?.key === obj.catalogKey;
          return (
            <g key={`${obj.catalogKey}-${index}`} role="button" tabIndex={0} className="ds-scene-object" data-selected={qty > 0}
              data-testid="scene-object" data-catalog-key={obj.catalogKey}
              aria-label={qty > 0 ? `Ajouter : ${name} (déjà ${qty})` : `Ajouter : ${name}`}
              onClick={() => onPick(obj.catalogKey)} onKeyDown={(e) => keyDown(e, obj.catalogKey)}>
              <title>{name}</title>
              <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={6} className="ds-scene-hit" />
              <g key={popping ? `p${pulse.n}` : "s"} className={popping ? "ds-scene-pop" : undefined} style={{ transformOrigin: `${x + w / 2}px ${y + h}px` }}>
                <ShapeDrawing shape={obj.shape} box={obj.box} />
              </g>
              {qty > 0 ? (
                <g aria-hidden>
                  <circle cx={Math.min(x + w - 2, SCENE_WIDTH - 13)} cy={Math.max(y + 2, 13)} r={12} fill="var(--ds-brand)" />
                  <text x={Math.min(x + w - 2, SCENE_WIDTH - 13)} y={Math.max(y + 2, 13) + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ds-on-brand)">
                    {qty > 99 ? "99+" : qty}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="border-t border-border bg-surface px-3 py-2 text-xs text-ink-secondary">
        Appuyez sur un meuble pour l&apos;ajouter. Les autres objets se trouvent dans la liste et la recherche ci-dessous.
      </figcaption>
    </figure>
  );
}
