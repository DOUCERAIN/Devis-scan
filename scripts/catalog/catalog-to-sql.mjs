// Génère la migration SQL de chargement du catalogue à partir de data/catalog/catalog.json.
// Usage : node scripts/catalog/catalog-to-sql.mjs > supabase/migrations/<horodatage>_furniture_catalog_data.sql
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../../data/catalog/catalog.json", import.meta.url), "utf8"));
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? "null" : String(v));
const arr = (a) => `array[${a.map(q).join(", ")}]::text[]`;
const json = (v) => (v ? `${q(JSON.stringify(v))}::jsonb` : "null");

const rows = catalog.items.map((e) =>
  `(${[
    q(e.id), q(e.name), q(e.category), q(e.category_label), q(e.subcategory), arr(e.synonyms), q(e.coco_class), q(e.handling),
    e.heavy ? "true" : "false", n(e.sample_size), json(e.dims_cm),
    n(e.geometric_volume_m3?.min), n(e.geometric_volume_m3?.avg), n(e.geometric_volume_m3?.max),
    n(e.professional_volume_m3),
    n(e.moving_volume_m3?.min), n(e.moving_volume_m3?.avg), n(e.moving_volume_m3?.max),
    n(e.weight_kg?.avg), q(e.dims_reliability), q(e.moving_volume_reliability), arr(e.sources), q(e.method.join(" ")), q(e.updated_at),
  ].join(", ")})`,
);

console.log(`-- Généré par scripts/catalog/catalog-to-sql.mjs depuis data/catalog/catalog.json (version ${catalog.version}). Ne pas modifier à la main.
insert into public.furniture_catalog (id, name, category, category_label, subcategory, synonyms, coco_class, handling, heavy,
  sample_size, dims_cm, geometric_volume_min, geometric_volume_avg, geometric_volume_max, professional_volume,
  moving_volume_min, moving_volume_avg, moving_volume_max, weight_kg_avg, dims_reliability, moving_volume_reliability,
  sources, method, updated_on)
values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name, category = excluded.category, category_label = excluded.category_label, subcategory = excluded.subcategory,
  synonyms = excluded.synonyms, coco_class = excluded.coco_class, handling = excluded.handling, heavy = excluded.heavy,
  sample_size = excluded.sample_size, dims_cm = excluded.dims_cm, geometric_volume_min = excluded.geometric_volume_min,
  geometric_volume_avg = excluded.geometric_volume_avg, geometric_volume_max = excluded.geometric_volume_max,
  professional_volume = excluded.professional_volume, moving_volume_min = excluded.moving_volume_min,
  moving_volume_avg = excluded.moving_volume_avg, moving_volume_max = excluded.moving_volume_max,
  weight_kg_avg = excluded.weight_kg_avg, dims_reliability = excluded.dims_reliability,
  moving_volume_reliability = excluded.moving_volume_reliability, sources = excluded.sources, method = excluded.method,
  updated_on = excluded.updated_on;`);
