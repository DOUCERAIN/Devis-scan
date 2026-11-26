import type { ReactNode } from "react";
import type { Shape } from "@/lib/inventory/scenes";

/**
 * Dessins vectoriels des objets de l'inventaire visuel (style « plan au trait », volontairement simple pour ne
 * pas être confondu avec une photo). Chaque forme s'inscrit dans sa zone cliquable [x, y, l, h] et utilise les
 * variables --obj-fill, --obj-accent, --obj-stroke posées par l'objet parent (état normal, survol, sélection),
 * elles-mêmes tirées des jetons de la charte (mode clair et sombre).
 */
const S = { stroke: "var(--obj-stroke)", strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const F = { ...S, fill: "var(--obj-fill)" };
const A = { ...S, fill: "var(--obj-accent)" };
const N = { ...S, fill: "none" };

type Box = readonly [number, number, number, number];

function Rect({ x, y, w, h, r = 3, accent = false }: { x: number; y: number; w: number; h: number; r?: number; accent?: boolean }) {
  return <rect x={x} y={y} width={Math.max(1, w)} height={Math.max(1, h)} rx={r} {...(accent ? A : F)} />;
}
function Line({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} {...N} />;
}
function Circle({ cx, cy, r, accent = false, none = false }: { cx: number; cy: number; r: number; accent?: boolean; none?: boolean }) {
  return <circle cx={cx} cy={cy} r={r} {...(none ? N : accent ? A : F)} />;
}
/** Pieds d'un meuble posé au sol. */
function Legs({ x, y, w, h, inset = 6 }: { x: number; y: number; w: number; h: number; inset?: number }) {
  return (
    <>
      <Line x1={x + inset} y1={y} x2={x + inset} y2={y + h} />
      <Line x1={x + w - inset} y1={y} x2={x + w - inset} y2={y + h} />
    </>
  );
}

const DRAW: Record<Shape, (b: Box) => ReactNode> = {
  sofa: ([x, y, w, h]) => (
    <>
      <Rect x={x + 10} y={y + 4} w={w - 20} h={h * 0.5} r={8} />
      <Rect x={x + 4} y={y + h * 0.42} w={w - 8} h={h * 0.4} r={6} accent />
      <Rect x={x} y={y + h * 0.3} w={16} h={h * 0.55} r={6} />
      <Rect x={x + w - 16} y={y + h * 0.3} w={16} h={h * 0.55} r={6} />
      <Line x1={x + w / 2} y1={y + h * 0.45} x2={x + w / 2} y2={y + h * 0.8} />
      <Legs x={x + 4} y={y + h * 0.85} w={w - 8} h={h * 0.15} inset={8} />
    </>
  ),
  armchair: ([x, y, w, h]) => (
    <>
      <Rect x={x + 8} y={y + 2} w={w - 16} h={h * 0.55} r={8} />
      <Rect x={x + 4} y={y + h * 0.45} w={w - 8} h={h * 0.35} r={6} accent />
      <Rect x={x} y={y + h * 0.32} w={12} h={h * 0.52} r={5} />
      <Rect x={x + w - 12} y={y + h * 0.32} w={12} h={h * 0.52} r={5} />
      <Legs x={x + 4} y={y + h * 0.84} w={w - 8} h={h * 0.16} />
    </>
  ),
  "coffee-table": ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y + 4} w={w} h={10} r={3} />
      <Rect x={x + 10} y={y + h * 0.55} w={w - 20} h={6} r={2} accent />
      <Legs x={x + 2} y={y + 14} w={w - 4} h={h - 16} inset={6} />
    </>
  ),
  "tv-stand": ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 6} />
      <Line x1={x + w / 3} y1={y + 4} x2={x + w / 3} y2={y + h - 10} />
      <Line x1={x + (2 * w) / 3} y1={y + 4} x2={x + (2 * w) / 3} y2={y + h - 10} />
      <Rect x={x + w / 3 + 6} y={y + 8} w={w / 3 - 12} h={h - 22} r={2} accent />
      <Legs x={x} y={y + h - 6} w={w} h={6} inset={8} />
    </>
  ),
  tv: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 10} r={3} />
      <Rect x={x + 5} y={y + 5} w={w - 10} h={h - 20} r={2} accent />
      <Line x1={x + w / 2} y1={y + h - 10} x2={x + w / 2} y2={y + h - 3} />
      <Line x1={x + w / 2 - 16} y1={y + h - 2} x2={x + w / 2 + 16} y2={y + h - 2} />
    </>
  ),
  bookcase: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={2} />
      {[1, 2, 3].map((i) => <Line key={i} x1={x + 3} y1={y + (h * i) / 4} x2={x + w - 3} y2={y + (h * i) / 4} />)}
      {[0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((k) => (
        <rect key={`${row}-${k}`} x={x + 7 + k * ((w - 14) / 4)} y={y + (h * row) / 4 + 8 + (k % 2) * 3} width={(w - 14) / 4 - 3}
          height={h / 4 - 11 - (k % 2) * 3} rx={1} {...A} />
      )))}
    </>
  ),
  "floor-lamp": ([x, y, w, h]) => (
    <>
      <path d={`M ${x + 4} ${y + 34} L ${x + 10} ${y + 2} L ${x + w - 10} ${y + 2} L ${x + w - 4} ${y + 34} Z`} {...A} />
      <Line x1={x + w / 2} y1={y + 34} x2={x + w / 2} y2={y + h - 4} />
      <Line x1={x + 6} y1={y + h - 2} x2={x + w - 6} y2={y + h - 2} />
    </>
  ),
  "table-lamp": ([x, y, w, h]) => (
    <>
      <path d={`M ${x + 6} ${y + h * 0.5} L ${x + 11} ${y + 3} L ${x + w - 11} ${y + 3} L ${x + w - 6} ${y + h * 0.5} Z`} {...A} />
      <Line x1={x + w / 2} y1={y + h * 0.5} x2={x + w / 2} y2={y + h - 5} />
      <Rect x={x + w / 2 - 9} y={y + h - 6} w={18} h={5} r={2} />
    </>
  ),
  plant: ([x, y, w, h]) => (
    <>
      <path d={`M ${x + w / 2} ${y + h * 0.66} C ${x - 6} ${y + h * 0.4}, ${x + 4} ${y + 6}, ${x + w / 2} ${y + 2} C ${x + w - 4} ${y + 6}, ${x + w + 6} ${y + h * 0.4}, ${x + w / 2} ${y + h * 0.66} Z`} {...A} />
      <Line x1={x + w / 2} y1={y + 14} x2={x + w / 2} y2={y + h * 0.66} />
      <path d={`M ${x + 6} ${y + h * 0.66} L ${x + w - 6} ${y + h * 0.66} L ${x + w - 10} ${y + h - 1} L ${x + 10} ${y + h - 1} Z`} {...F} />
    </>
  ),
  frame: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={2} />
      <Rect x={x + 7} y={y + 7} w={w - 14} h={h - 14} r={1} accent />
      <path d={`M ${x + 9} ${y + h - 10} L ${x + w * 0.4} ${y + h * 0.45} L ${x + w * 0.6} ${y + h * 0.65} L ${x + w * 0.72} ${y + h * 0.5} L ${x + w - 9} ${y + h - 10}`} {...N} />
    </>
  ),
  pouf: ([x, y, w, h]) => (
    <>
      <Rect x={x + 2} y={y + 6} w={w - 4} h={h - 10} r={12} accent />
      <Line x1={x + 6} y1={y + 14} x2={x + w - 6} y2={y + 14} />
    </>
  ),
  fridge: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={5} />
      <Line x1={x} y1={y + h * 0.36} x2={x + w} y2={y + h * 0.36} />
      <Line x1={x + w - 12} y1={y + 12} x2={x + w - 12} y2={y + h * 0.28} />
      <Line x1={x + w - 12} y1={y + h * 0.42} x2={x + w - 12} y2={y + h * 0.62} />
    </>
  ),
  dishwasher: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={3} />
      <Rect x={x + 4} y={y + 4} w={w - 8} h={12} r={2} accent />
      <Line x1={x + w / 2 - 12} y1={y + 24} x2={x + w / 2 + 12} y2={y + 24} />
    </>
  ),
  washer: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={4} />
      <Line x1={x} y1={y + 14} x2={x + w} y2={y + 14} />
      <Circle cx={x + w - 12} cy={y + 7} r={3} />
      <Circle cx={x + w / 2} cy={y + 14 + (h - 14) / 2} r={Math.min(w, h - 14) / 2 - 7} accent />
      <Circle cx={x + w / 2} cy={y + 14 + (h - 14) / 2} r={Math.min(w, h - 14) / 2 - 15} none />
    </>
  ),
  dryer: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={4} />
      <Rect x={x + 4} y={y + 4} w={w - 8} h={9} r={2} accent />
      <Circle cx={x + w / 2} cy={y + 13 + (h - 13) / 2} r={Math.min(w, h - 13) / 2 - 8} accent />
    </>
  ),
  microwave: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={4} />
      <Rect x={x + 5} y={y + 5} w={w * 0.62} h={h - 10} r={2} accent />
      <Circle cx={x + w - 11} cy={y + 12} r={3} />
      <Circle cx={x + w - 11} cy={y + h - 12} r={3} />
    </>
  ),
  kettle: ([x, y, w, h]) => (
    <>
      <path d={`M ${x + 8} ${y + h - 2} L ${x + 12} ${y + 8} L ${x + w * 0.55} ${y + 8} L ${x + w * 0.62} ${y + h - 2} Z`} {...A} />
      <path d={`M ${x + w * 0.58} ${y + 14} C ${x + w * 0.8} ${y + 14}, ${x + w * 0.8} ${y + h - 10}, ${x + w * 0.6} ${y + h - 10}`} {...N} />
      <Rect x={x + w * 0.66} y={y + h * 0.4} w={w * 0.3} h={h * 0.6 - 2} r={2} />
    </>
  ),
  "dining-table": ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y + 2} w={w} h={9} r={2} />
      <Legs x={x} y={y + 11} w={w} h={h - 11} inset={10} />
      <Rect x={x + w / 2 - 12} y={y - 1} w={24} h={3} r={1} accent />
    </>
  ),
  chair: ([x, y, w, h]) => (
    <>
      <Rect x={x + 6} y={y + 2} w={w - 12} h={h * 0.45} r={4} accent />
      <Rect x={x + 2} y={y + h * 0.5} w={w - 4} h={7} r={2} />
      <Legs x={x + 2} y={y + h * 0.5 + 7} w={w - 4} h={h * 0.5 - 7} inset={4} />
    </>
  ),
  trolley: ([x, y, w, h]) => (
    <>
      <Rect x={x + 2} y={y + 2} w={w - 4} h={6} r={2} />
      <Rect x={x + 2} y={y + h * 0.45} w={w - 4} h={6} r={2} accent />
      <Line x1={x + 6} y1={y + 8} x2={x + 6} y2={y + h - 9} />
      <Line x1={x + w - 6} y1={y + 8} x2={x + w - 6} y2={y + h - 9} />
      <Circle cx={x + 8} cy={y + h - 5} r={4} />
      <Circle cx={x + w - 8} cy={y + h - 5} r={4} />
    </>
  ),
  wardrobe: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 6} r={3} />
      <Line x1={x + w / 2} y1={y + 4} x2={x + w / 2} y2={y + h - 10} />
      <Line x1={x + w / 2 - 7} y1={y + h * 0.42} x2={x + w / 2 - 7} y2={y + h * 0.54} />
      <Line x1={x + w / 2 + 7} y1={y + h * 0.42} x2={x + w / 2 + 7} y2={y + h * 0.54} />
      <Rect x={x + 4} y={y + 4} w={w - 8} h={10} r={2} accent />
      <Legs x={x} y={y + h - 6} w={w} h={6} inset={8} />
    </>
  ),
  bed: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={16} h={h} r={4} />
      <Rect x={x + 16} y={y + h * 0.45} w={w - 18} h={h * 0.35} r={4} />
      <Rect x={x + 20} y={y + h * 0.3} w={30} h={h * 0.2} r={6} accent />
      <path d={`M ${x + 56} ${y + h * 0.42} L ${x + w - 4} ${y + h * 0.42} L ${x + w - 2} ${y + h * 0.8} L ${x + 56} ${y + h * 0.8} Z`} {...A} />
      <Line x1={x + w - 4} y1={y + h * 0.8} x2={x + w - 4} y2={y + h} />
    </>
  ),
  nightstand: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 5} r={3} />
      <Line x1={x} y1={y + (h - 5) / 2} x2={x + w} y2={y + (h - 5) / 2} />
      <Line x1={x + w / 2 - 5} y1={y + (h - 5) / 4} x2={x + w / 2 + 5} y2={y + (h - 5) / 4} />
      <Line x1={x + w / 2 - 5} y1={y + (3 * (h - 5)) / 4} x2={x + w / 2 + 5} y2={y + (3 * (h - 5)) / 4} />
      <Legs x={x} y={y + h - 5} w={w} h={5} inset={4} />
    </>
  ),
  dresser: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 6} r={3} />
      {[1, 2].map((i) => <Line key={i} x1={x} y1={y + ((h - 6) * i) / 3} x2={x + w} y2={y + ((h - 6) * i) / 3} />)}
      {[0, 1, 2].map((i) => <Line key={`h${i}`} x1={x + w / 2 - 8} y1={y + ((h - 6) * (i + 0.5)) / 3} x2={x + w / 2 + 8} y2={y + ((h - 6) * (i + 0.5)) / 3} />)}
      <Legs x={x} y={y + h - 6} w={w} h={6} inset={6} />
    </>
  ),
  mirror: ([x, y, w, h]) => (
    <>
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={(w - 4) / 2} {...F} />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} rx={(w - 16) / 2} {...A} />
      <Line x1={x + w * 0.35} y1={y + h * 0.3} x2={x + w * 0.5} y2={y + h * 0.2} />
    </>
  ),
  vanity: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y + 8} w={w} h={10} r={3} accent />
      <Line x1={x + w / 2} y1={y + 8} x2={x + w / 2} y2={y} />
      <Line x1={x + w / 2} y1={y} x2={x + w / 2 + 10} y2={y} />
      <Rect x={x + 4} y={y + 18} w={w - 8} h={h - 18} r={2} />
      <Line x1={x + w / 2} y1={y + 22} x2={x + w / 2} y2={y + h - 4} />
    </>
  ),
  column: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h} r={3} />
      <Line x1={x} y1={y + h * 0.5} x2={x + w} y2={y + h * 0.5} />
      <Rect x={x + 5} y={y + 5} w={w - 10} h={h * 0.5 - 10} r={2} accent />
      <Line x1={x + w - 9} y1={y + h * 0.6} x2={x + w - 9} y2={y + h * 0.7} />
    </>
  ),
  basket: ([x, y, w, h]) => (
    <>
      <path d={`M ${x + 2} ${y + 10} L ${x + w - 2} ${y + 10} L ${x + w - 7} ${y + h - 1} L ${x + 7} ${y + h - 1} Z`} {...A} />
      <Rect x={x} y={y + 4} w={w} h={7} r={3} />
      <Line x1={x + w / 2} y1={y + 16} x2={x + w / 2} y2={y + h - 6} />
    </>
  ),
  "shelf-unit": ([x, y, w, h]) => (
    <>
      <Line x1={x + 4} y1={y} x2={x + 4} y2={y + h} />
      <Line x1={x + w - 4} y1={y} x2={x + w - 4} y2={y + h} />
      {[0.15, 0.45, 0.75].map((f) => <Rect key={f} x={x} y={y + h * f} w={w} h={6} r={2} />)}
      <Rect x={x + 12} y={y + h * 0.15 - 18} w={14} h={18} r={2} accent />
      <Rect x={x + 32} y={y + h * 0.45 - 22} w={24} h={22} r={3} accent />
      <Rect x={x + 16} y={y + h * 0.75 - 16} w={34} h={16} r={3} accent />
    </>
  ),
  desk: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y + 2} w={w} h={9} r={2} />
      <Rect x={x + 4} y={y + 11} w={w * 0.36} h={h * 0.42} r={2} accent />
      <Line x1={x + 6} y1={y + 11} x2={x + 6} y2={y + h} />
      <Line x1={x + w - 6} y1={y + 11} x2={x + w - 6} y2={y + h} />
    </>
  ),
  "office-chair": ([x, y, w, h]) => (
    <>
      <Rect x={x + 12} y={y + 2} w={w - 24} h={h * 0.42} r={8} accent />
      <Rect x={x + 4} y={y + h * 0.48} w={w - 8} h={10} r={4} />
      <Line x1={x + w / 2} y1={y + h * 0.48 + 10} x2={x + w / 2} y2={y + h - 10} />
      <Line x1={x + 8} y1={y + h - 8} x2={x + w - 8} y2={y + h - 8} />
      <Circle cx={x + 10} cy={y + h - 4} r={3} />
      <Circle cx={x + w - 10} cy={y + h - 4} r={3} />
    </>
  ),
  "drawer-unit": ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 6} r={3} />
      {[1, 2].map((i) => <Line key={i} x1={x} y1={y + ((h - 6) * i) / 3} x2={x + w} y2={y + ((h - 6) * i) / 3} />)}
      <Circle cx={x + 10} cy={y + h - 3} r={3} />
      <Circle cx={x + w - 10} cy={y + h - 3} r={3} />
    </>
  ),
  shelf: ([x, y, w, h]) => (
    <>
      <Line x1={x + 3} y1={y} x2={x + 3} y2={y + h} />
      <Line x1={x + w - 3} y1={y} x2={x + w - 3} y2={y + h} />
      {[0.05, 0.3, 0.55, 0.8].map((f) => <Rect key={f} x={x} y={y + h * f} w={w} h={5} r={1} />)}
      <Rect x={x + 10} y={y + h * 0.3 - 22} w={20} h={22} r={2} accent />
      <Rect x={x + 36} y={y + h * 0.55 - 18} w={26} h={18} r={2} accent />
      <Rect x={x + 8} y={y + h * 0.8 - 20} w={30} h={20} r={2} accent />
    </>
  ),
  "coat-rack": ([x, y, w, h]) => (
    <>
      <Line x1={x + w / 2} y1={y + 4} x2={x + w / 2} y2={y + h - 4} />
      <Line x1={x + 8} y1={y + h - 2} x2={x + w - 8} y2={y + h - 2} />
      <Line x1={x + w / 2} y1={y + 18} x2={x + 8} y2={y + 8} />
      <Line x1={x + w / 2} y1={y + 18} x2={x + w - 8} y2={y + 8} />
      <path d={`M ${x + 10} ${y + 24} L ${x + w / 2 - 2} ${y + 24} L ${x + w / 2 - 4} ${y + 92} L ${x + 6} ${y + 92} Z`} {...A} />
    </>
  ),
  "shoe-cabinet": ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 4} r={3} />
      <Line x1={x} y1={y + (h - 4) / 2} x2={x + w} y2={y + (h - 4) / 2} />
      <Rect x={x + 10} y={y + 6} w={w - 20} h={(h - 4) / 2 - 12} r={2} accent />
      <Line x1={x + w / 2 - 8} y1={y + (h - 4) * 0.75} x2={x + w / 2 + 8} y2={y + (h - 4) * 0.75} />
    </>
  ),
  console: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y + 2} w={w} h={12} r={2} />
      <Line x1={x + w / 2 - 10} y1={y + 8} x2={x + w / 2 + 10} y2={y + 8} />
      <Legs x={x} y={y + 14} w={w} h={h - 14} inset={8} />
      <Rect x={x + 10} y={y + h * 0.72} w={w - 20} h={5} r={2} accent />
    </>
  ),
  bench: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y + 2} w={w} h={12} r={4} accent />
      <Rect x={x + 4} y={y + 14} w={w - 8} h={h - 22} r={2} />
      <Legs x={x + 4} y={y + h - 8} w={w - 8} h={8} inset={4} />
    </>
  ),
  "metal-shelf": ([x, y, w, h]) => (
    <>
      <Line x1={x + 3} y1={y} x2={x + 3} y2={y + h} />
      <Line x1={x + w - 3} y1={y} x2={x + w - 3} y2={y + h} />
      {[0.04, 0.3, 0.56, 0.82].map((f) => <Rect key={f} x={x} y={y + h * f} w={w} h={5} r={1} />)}
      <Rect x={x + 8} y={y + h * 0.3 - 24} w={34} h={24} r={2} accent />
      <Rect x={x + 46} y={y + h * 0.56 - 20} w={36} h={20} r={2} accent />
      <Rect x={x + 10} y={y + h * 0.82 - 26} w={40} h={26} r={2} accent />
    </>
  ),
  bike: ([x, y, w, h]) => (
    <>
      <Circle cx={x + 24} cy={y + h - 24} r={22} none />
      <Circle cx={x + w - 24} cy={y + h - 24} r={22} none />
      <path d={`M ${x + 24} ${y + h - 24} L ${x + w * 0.42} ${y + h * 0.32} L ${x + w * 0.72} ${y + h * 0.32} L ${x + w - 24} ${y + h - 24} M ${x + w * 0.42} ${y + h * 0.32} L ${x + w * 0.5} ${y + h - 24} L ${x + w * 0.72} ${y + h * 0.32}`} {...N} />
      <Line x1={x + w * 0.38} y1={y + h * 0.2} x2={x + w * 0.48} y2={y + h * 0.2} />
      <Line x1={x + w * 0.72} y1={y + h * 0.32} x2={x + w * 0.76} y2={y + h * 0.12} />
      <Line x1={x + w * 0.72} y1={y + h * 0.12} x2={x + w * 0.82} y2={y + h * 0.12} />
    </>
  ),
  ladder: ([x, y, w, h]) => (
    <>
      <Line x1={x + 8} y1={y + 2} x2={x + 4} y2={y + h} />
      <Line x1={x + w - 8} y1={y + 2} x2={x + w - 4} y2={y + h} />
      {[0.12, 0.3, 0.48, 0.66, 0.84].map((f) => <Line key={f} x1={x + 7} y1={y + h * f} x2={x + w - 7} y2={y + h * f} />)}
    </>
  ),
  suitcase: ([x, y, w, h]) => (
    <>
      <Rect x={x + 2} y={y + 12} w={w - 4} h={h - 18} r={5} accent />
      <path d={`M ${x + w / 2 - 8} ${y + 12} L ${x + w / 2 - 8} ${y + 3} L ${x + w / 2 + 8} ${y + 3} L ${x + w / 2 + 8} ${y + 12}`} {...N} />
      <Line x1={x + w / 2} y1={y + 18} x2={x + w / 2} y2={y + h - 12} />
      <Circle cx={x + 9} cy={y + h - 3} r={3} />
      <Circle cx={x + w - 9} cy={y + h - 3} r={3} />
    </>
  ),
  crate: ([x, y, w, h]) => (
    <>
      <path d={`M ${x + 2} ${y + 6} L ${x + w - 2} ${y + 6} L ${x + w - 5} ${y + h - 1} L ${x + 5} ${y + h - 1} Z`} {...A} />
      <Rect x={x} y={y + 2} w={w} h={7} r={2} />
      <Rect x={x + w / 2 - 8} y={y + 14} w={16} h={6} r={3} />
    </>
  ),
  mower: ([x, y, w, h]) => (
    <>
      <Line x1={x + w * 0.35} y1={y + h * 0.55} x2={x + 6} y2={y + 4} />
      <Line x1={x + 2} y1={y + 4} x2={x + 14} y2={y + 4} />
      <Rect x={x + w * 0.3} y={y + h * 0.5} w={w * 0.68} h={h * 0.3} r={6} accent />
      <Circle cx={x + w * 0.4} cy={y + h - 7} r={6} />
      <Circle cx={x + w - 10} cy={y + h - 7} r={6} />
    </>
  ),
  piano: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h * 0.56} r={3} />
      <Rect x={x - 0} y={y + h * 0.56} w={w} h={10} r={1} accent />
      {Array.from({ length: 12 }, (_, i) => <Line key={i} x1={x + 6 + i * ((w - 12) / 12)} y1={y + h * 0.56} x2={x + 6 + i * ((w - 12) / 12)} y2={y + h * 0.56 + 10} />)}
      <Rect x={x + 6} y={y + h * 0.56 + 10} w={w - 12} h={h * 0.44 - 10} r={2} />
      <Rect x={x + w / 2 - 18} y={y + 12} w={36} h={20} r={2} accent />
    </>
  ),
  safe: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h - 4} r={4} />
      <Rect x={x + 6} y={y + 6} w={w - 12} h={h - 16} r={3} accent />
      <Circle cx={x + w / 2} cy={y + (h - 4) / 2} r={9} />
      <Line x1={x + w / 2} y1={y + (h - 4) / 2} x2={x + w / 2 + 6} y2={y + (h - 4) / 2 - 5} />
    </>
  ),
  "exercise-bike": ([x, y, w, h]) => (
    <>
      <Circle cx={x + w * 0.68} cy={y + h * 0.58} r={Math.min(w, h) * 0.2} accent />
      <path d={`M ${x + w * 0.22} ${y + h * 0.3} L ${x + w * 0.4} ${y + h * 0.62} L ${x + w * 0.68} ${y + h * 0.58} M ${x + w * 0.4} ${y + h * 0.62} L ${x + w * 0.3} ${y + h - 4} M ${x + w * 0.68} ${y + h * 0.58} L ${x + w * 0.78} ${y + h * 0.12}`} {...N} />
      <Line x1={x + w * 0.12} y1={y + h * 0.28} x2={x + w * 0.32} y2={y + h * 0.28} />
      <Line x1={x + w * 0.72} y1={y + h * 0.1} x2={x + w * 0.9} y2={y + h * 0.1} />
      <Line x1={x + 6} y1={y + h - 2} x2={x + w - 6} y2={y + h - 2} />
    </>
  ),
  aquarium: ([x, y, w, h]) => (
    <>
      <Rect x={x} y={y} w={w} h={h * 0.56} r={3} accent />
      <path d={`M ${x + 8} ${y + h * 0.18} C ${x + w * 0.3} ${y + h * 0.12}, ${x + w * 0.6} ${y + h * 0.24}, ${x + w - 8} ${y + h * 0.16}`} {...N} />
      <path d={`M ${x + w * 0.35} ${y + h * 0.36} q 10 -8 20 0 q -10 8 -20 0 l -6 -5 v 10 z`} {...F} />
      <Rect x={x + 4} y={y + h * 0.56} w={w - 8} h={h * 0.44} r={2} />
      <Line x1={x + w / 2} y1={y + h * 0.6} x2={x + w / 2} y2={y + h - 4} />
    </>
  ),
};

export function ShapeDrawing({ shape, box }: { shape: Shape; box: Box }) {
  return <>{DRAW[shape](box)}</>;
}
