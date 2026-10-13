/**
 * PDF del plan con pdf-lib y la fuente estándar Helvetica (codificación WinAnsi). Todo texto pasa
 * por `toWinAnsi`, que conserva tildes, ñ, ¿ y ¡ (están en WinAnsi) y reemplaza de forma segura lo
 * que la fuente no puede dibujar (≥, emojis…) en vez de fallar.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { addDays } from "@/lib/dates";
import { formatLongDate, formatNumber, formatShortDate } from "@/lib/format";
import { roundDecimals } from "@/lib/nutrition";
import { planSlots } from "./plan";
import type { DraftItem, PlanDraft } from "./types";

export interface PlanPdfRow {
  meal: string;
  name: string;
  amount: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface PlanPdfDay {
  title: string;
  rows: PlanPdfRow[];
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

export interface PlanPdfData {
  appName: string;
  planName: string;
  subtitle: string;
  days: PlanPdfDay[];
  summary: string[];
  footer: string[];
}

const REPLACEMENTS: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "≈": "~",
  "±": "+/-",
  " ": " ",
  " ": " ",
  " ": " ",
  "−": "-",
  "✓": "v",
  "•": "-",
};

/**
 * Convierte un texto a lo que la fuente puede codificar. `charset` = `font.getCharacterSet()`.
 * Orden: carácter soportado → reemplazo conocido → letra base sin diacrítico → "?" (los emojis y
 * símbolos raros se quitan). Saltos de línea y tabs pasan a espacio.
 */
export function toWinAnsi(text: string, charset: ReadonlySet<number>): string {
  let out = "";
  for (const ch of text.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0)!;
    if (charset.has(cp)) {
      out += ch;
      continue;
    }
    const rep = REPLACEMENTS[ch];
    if (rep !== undefined) {
      out += [...rep].every((c) => charset.has(c.codePointAt(0)!)) ? rep : "?";
      continue;
    }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (base && [...base].every((c) => charset.has(c.codePointAt(0)!))) {
      out += base;
      continue;
    }
    // Emojis, selectores de variación y otros símbolos: se omiten (no aportan al plan).
    if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x200d) continue;
    out += "?";
  }
  return out;
}

const amountLabel = (it: Pick<DraftItem, "kind" | "servings" | "grams">) =>
  it.kind === "recipe"
    ? `${formatNumber(it.servings ?? 1, Number.isInteger(it.servings ?? 1) ? 0 : 2)} ${it.servings === 1 ? "porción" : "porciones"}`
    : `${formatNumber(it.grams ?? 0)} g`;

/** Arma los datos del PDF desde el plan (puro). */
export function planPdfData(plan: Pick<PlanDraft, "name" | "startDate" | "days" | "params" | "items">, appName: string): PlanPdfData {
  const slots = planSlots(plan.params.mealsPerDay);
  const days: PlanPdfDay[] = [];
  let sumKcal = 0;
  let sumProtein = 0;
  for (let d = 0; d < plan.days; d++) {
    const items = plan.items.filter((it) => it.dayIndex === d).sort((a, b) => a.slotIndex - b.slotIndex);
    const rows: PlanPdfRow[] = items.map((it) => ({
      meal: slots[it.slotIndex]?.label ?? "Comida",
      name: it.name,
      amount: amountLabel(it),
      kcal: it.kcal,
      proteinG: it.proteinG,
      carbsG: it.carbsG,
      fatG: it.fatG,
    }));
    const totals = {
      kcal: roundDecimals(items.reduce((s, it) => s + it.kcal, 0), 0),
      proteinG: roundDecimals(items.reduce((s, it) => s + it.proteinG, 0), 1),
      carbsG: roundDecimals(items.reduce((s, it) => s + it.carbsG, 0), 1),
      fatG: roundDecimals(items.reduce((s, it) => s + it.fatG, 0), 1),
    };
    sumKcal += totals.kcal;
    sumProtein += totals.proteinG;
    days.push({ title: `Día ${d + 1} · ${formatLongDate(addDays(plan.startDate, d))}`, rows, totals });
  }
  const end = addDays(plan.startDate, plan.days - 1);
  const target = plan.params.targetKcal;
  const subtitle =
    `Del ${formatShortDate(plan.startDate)} al ${formatShortDate(end)}` +
    (target ? ` · Meta diaria: ${formatNumber(target)} kcal${plan.params.proteinG ? ` y ${formatNumber(plan.params.proteinG)} g de proteína` : ""}` : "");
  const summary = [
    `Promedio por día: ${formatNumber(sumKcal / Math.max(1, plan.days))} kcal · ${formatNumber(sumProtein / Math.max(1, plan.days), 1)} g de proteína.`,
  ];
  return {
    appName,
    planName: plan.name,
    subtitle,
    days,
    summary,
    footer: [
      "Nutrientes calculados desde los ingredientes de cada receta y la base de alimentos (valores aproximados).",
      "Este plan es una guía general y no reemplaza la indicación de un profesional de la salud.",
    ],
  };
}

const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const COLS = [
  { key: "meal", label: "Comida", width: 78, align: "left" },
  { key: "name", label: "Plato", width: 189, align: "left" },
  { key: "amount", label: "Cantidad", width: 72, align: "left" },
  { key: "kcal", label: "kcal", width: 44, align: "right" },
  { key: "proteinG", label: "Prot. g", width: 44, align: "right" },
  { key: "carbsG", label: "Carb. g", width: 44, align: "right" },
  { key: "fatG", label: "Grasa g", width: 44, align: "right" },
] as const;

const INK = rgb(0.09, 0.094, 0.11);
const MUTED = rgb(0.37, 0.376, 0.408);
const ORANGE = rgb(1, 0.42, 0);
const LINE = rgb(0.89, 0.9, 0.918);

/** Corta un texto para que entre en `maxWidth` (con "..."). */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Parte un texto en líneas que entren en `maxWidth` (máx. `maxLines`, la última con "..."). */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.map((l) => fit(l, font, size, maxWidth));
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(`${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, font, size, maxWidth);
  return kept;
}

export async function buildPlanPdf(data: PlanPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(regular.getCharacterSet());
  const t = (s: string) => toWinAnsi(s, charset);

  doc.setTitle(t(`${data.planName} · ${data.appName}`));
  doc.setAuthor(t(data.appName));
  doc.setCreator(t(data.appName));
  doc.setProducer("pdf-lib");
  doc.setLanguage("es-PE");

  const contentWidth = PAGE.width - PAGE.margin * 2;
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const ensure = (needed: number) => {
    if (y - needed < PAGE.margin + 24) newPage();
  };
  const text = (s: string, x: number, size: number, font: PDFFont = regular, color = INK) => {
    page.drawText(t(s), { x, y, size, font, color });
  };

  // Encabezado.
  page.drawRectangle({ x: PAGE.margin, y: y - 4, width: 28, height: 4, color: ORANGE });
  y -= 22;
  text(data.appName, PAGE.margin, 10, bold, MUTED);
  y -= 22;
  for (const line of wrap(t(data.planName), bold, 18, contentWidth, 2)) {
    page.drawText(line, { x: PAGE.margin, y, size: 18, font: bold, color: INK });
    y -= 22;
  }
  for (const line of wrap(t(data.subtitle), regular, 10, contentWidth, 3)) {
    page.drawText(line, { x: PAGE.margin, y, size: 10, font: regular, color: MUTED });
    y -= 14;
  }
  y -= 8;

  const drawHeaderRow = () => {
    let x = PAGE.margin;
    for (const col of COLS) {
      const label = t(col.label);
      const w = bold.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: col.align === "right" ? x + col.width - w - 4 : x + 4, y, size: 8, font: bold, color: MUTED });
      x += col.width;
    }
    y -= 6;
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.margin + contentWidth, y }, thickness: 0.6, color: LINE });
    y -= 12;
  };

  for (const day of data.days) {
    ensure(70);
    page.drawText(fit(t(day.title), bold, 12, contentWidth), { x: PAGE.margin, y, size: 12, font: bold, color: INK });
    y -= 18;
    drawHeaderRow();
    if (day.rows.length === 0) {
      text("Sin comidas planificadas.", PAGE.margin + 4, 9, regular, MUTED);
      y -= 16;
    }
    for (const row of day.rows) {
      const nameLines = wrap(t(row.name), regular, 9, COLS[1].width - 8, 2);
      const rowHeight = 12 * nameLines.length + 4;
      if (y - rowHeight < PAGE.margin + 24) {
        newPage();
        drawHeaderRow();
      }
      const values: Record<(typeof COLS)[number]["key"], string> = {
        meal: fit(t(row.meal), regular, 9, COLS[0].width - 8),
        name: "",
        amount: fit(t(row.amount), regular, 9, COLS[2].width - 8),
        kcal: formatNumber(row.kcal),
        proteinG: formatNumber(row.proteinG, 1),
        carbsG: formatNumber(row.carbsG, 1),
        fatG: formatNumber(row.fatG, 1),
      };
      let x = PAGE.margin;
      for (const col of COLS) {
        if (col.key === "name") {
          nameLines.forEach((line, i) => page.drawText(line, { x: x + 4, y: y - i * 12, size: 9, font: regular, color: INK }));
        } else {
          const v = t(values[col.key]);
          const w = regular.widthOfTextAtSize(v, 9);
          page.drawText(v, { x: col.align === "right" ? x + col.width - w - 4 : x + 4, y, size: 9, font: regular, color: INK });
        }
        x += col.width;
      }
      y -= rowHeight;
      page.drawLine({ start: { x: PAGE.margin, y: y + 6 }, end: { x: PAGE.margin + contentWidth, y: y + 6 }, thickness: 0.3, color: LINE });
    }
    // Totales del día.
    ensure(20);
    const totals: Record<string, string> = {
      kcal: formatNumber(day.totals.kcal),
      proteinG: formatNumber(day.totals.proteinG, 1),
      carbsG: formatNumber(day.totals.carbsG, 1),
      fatG: formatNumber(day.totals.fatG, 1),
    };
    let x = PAGE.margin;
    for (const col of COLS) {
      if (col.key === "meal") page.drawText(t("Total del día"), { x: x + 4, y, size: 9, font: bold, color: INK });
      const v = totals[col.key];
      if (v) {
        const w = bold.widthOfTextAtSize(v, 9);
        page.drawText(v, { x: x + col.width - w - 4, y, size: 9, font: bold, color: INK });
      }
      x += col.width;
    }
    y -= 26;
  }

  ensure(60);
  for (const line of data.summary) {
    for (const l of wrap(t(line), bold, 10, contentWidth, 3)) {
      page.drawText(l, { x: PAGE.margin, y, size: 10, font: bold, color: INK });
      y -= 14;
    }
  }
  y -= 6;
  for (const line of data.footer) {
    for (const l of wrap(t(line), regular, 8, contentWidth, 3)) {
      ensure(12);
      page.drawText(l, { x: PAGE.margin, y, size: 8, font: regular, color: MUTED });
      y -= 11;
    }
  }

  // Numeración de páginas.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = t(`${data.appName} · Página ${i + 1} de ${pages.length}`);
    const w = regular.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: PAGE.width - PAGE.margin - w, y: PAGE.margin / 2, size: 8, font: regular, color: MUTED });
  });

  return doc.save();
}

/** Nombre de archivo seguro (ASCII) para la descarga. */
export function pdfFileName(planName: string): string {
  const base = planName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `plan-${base || "comidas"}.pdf`;
}
