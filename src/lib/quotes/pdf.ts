import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * PDF d'un devis ou d'une estimation, généré à la demande depuis les instantanés figés du devis
 * (aucun stockage : le document est toujours identique pour une même version).
 * Polices standard (Helvetica, encodage WinAnsi) : les caractères hors de cet encodage sont remplacés.
 */
export type PdfQuote = {
  title: string;
  reference: string;
  createdAt: string;
  validUntil: string | null;
  isEstimate: boolean;
  company: { name: string; legal: string[]; color: string | null };
  customer: string[];
  addresses: { title: string; lines: string[] }[];
  facts: [string, string][];
  inventory: { room: string; items: string[] }[];
  lines: { label: string; detail: string; amount: string }[];
  totals: [string, string][];
  notes: string[];
  terms: [string, string][];
  footer: string;
};

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Remplace les espaces fines (formatage français) et tout caractère non encodable. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[   ]/g, " ")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch) || ch === "\n" ? ch : "?";
    })
    .join("");
}

function hexToRgb(hex: string | null) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(0.188, 0.314, 0.784);
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function renderQuotePdf(q: PdfQuote): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${q.title} ${q.reference}`));
  doc.setAuthor(pdfSafe(q.company.name));
  doc.setCreator("Devis Scan");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(q.company.color);
  const ink = rgb(0.075, 0.125, 0.227);
  const muted = rgb(0.31, 0.365, 0.46);
  const margin = 48;
  const width = 595.28 - margin * 2;

  let page: PDFPage = doc.addPage([595.28, 841.89]);
  let y = 841.89 - margin;
  const ensure = (h: number) => {
    if (y - h < margin + 24) {
      page = doc.addPage([595.28, 841.89]);
      y = 841.89 - margin;
    }
  };
  const text = (t: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; w?: number } = {}) => {
    const size = opts.size ?? 9.5;
    const font = opts.font ?? regular;
    for (const line of wrap(t, font, size, opts.w ?? width)) {
      ensure(size + 4);
      page.drawText(line, { x: opts.x ?? margin, y: y - size, size, font, color: opts.color ?? ink });
      y -= size + 4;
    }
  };
  const heading = (t: string) => {
    y -= 8;
    ensure(30);
    text(t, { size: 11.5, font: bold, color: accent });
    y -= 2;
  };

  // En-tête
  page.drawRectangle({ x: 0, y: 841.89 - 6, width: 595.28, height: 6, color: accent });
  text(q.company.name, { size: 16, font: bold });
  for (const l of q.company.legal) text(l, { size: 8.5, color: muted });
  y -= 10;
  text(`${q.title} n° ${q.reference}`, { size: 14, font: bold, color: accent });
  text(`Établi le ${q.createdAt}${q.validUntil ? ` - valable jusqu'au ${q.validUntil}` : ""}`, { color: muted });
  if (q.isEstimate) {
    y -= 4;
    text("Estimation indicative calculée automatiquement à partir des vidéos du client et de la grille tarifaire de l'entreprise. Elle ne vaut pas devis tant que l'entreprise ne l'a pas vérifiée et envoyée.", { size: 9, font: bold });
  }

  heading("Client");
  for (const l of q.customer) text(l);
  for (const a of q.addresses) {
    heading(a.title);
    for (const l of a.lines) text(l);
  }
  heading("Prestation");
  for (const [k, v] of q.facts) text(`${k} : ${v}`);

  heading("Inventaire");
  for (const room of q.inventory) {
    text(room.room, { font: bold });
    for (const item of room.items) text(`- ${item}`, { x: margin + 10, w: width - 10, size: 9 });
  }

  heading("Détail du prix (HT)");
  for (const l of q.lines) {
    ensure(28);
    const top = y;
    text(l.label, { w: width - 110 });
    if (l.detail) text(l.detail, { size: 8.5, color: muted, w: width - 110 });
    const amount = pdfSafe(l.amount);
    page.drawText(amount, { x: margin + width - regular.widthOfTextAtSize(amount, 9.5), y: top - 9.5, size: 9.5, font: regular, color: ink });
    y -= 3;
  }
  y -= 4;
  ensure(16);
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.8, color: muted });
  y -= 6;
  for (const [label, value] of q.totals) {
    const isTotal = label.startsWith("Total TTC");
    const size = isTotal ? 12 : 10;
    const font = isTotal ? bold : regular;
    ensure(size + 6);
    page.drawText(pdfSafe(label), { x: margin, y: y - size, size, font, color: ink });
    const v = pdfSafe(value);
    page.drawText(v, { x: margin + width - font.widthOfTextAtSize(v, size), y: y - size, size, font, color: ink });
    y -= size + 6;
  }

  if (q.notes.length) {
    heading("Hypothèses et points à vérifier");
    for (const n of q.notes) text(`- ${n}`, { size: 9 });
  }
  for (const [title, body] of q.terms) {
    heading(title);
    text(body, { size: 8.5 });
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = pdfSafe(`${q.footer} - page ${i + 1}/${pages.length}`);
    p.drawText(footer, { x: margin, y: 24, size: 7.5, font: regular, color: muted });
  });
  return doc.save();
}
