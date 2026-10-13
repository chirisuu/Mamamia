/**
 * Markdown seguro para `content_pages` (FAQ, legales, bloques, artículos).
 *
 * No hay HTML crudo en ningún paso: el texto se convierte a un árbol propio y se pinta con
 * elementos de React (que escapan todo). Cualquier etiqueta `<script>` o `<img onerror>` escrita
 * en el markdown se muestra como texto. Los enlaces solo aceptan http(s), mailto, rutas internas
 * ("/…") y anclas ("#…"). Sin imágenes ni tablas (no hacen falta para estos contenidos).
 *
 * Soporta: títulos (#, ##, ###…), párrafos, **negrita**, *cursiva*, `código`, bloques ```,
 * citas (>), listas con viñetas y numeradas, separador (---), [enlaces](url), <https://autoenlaces>
 * y saltos de línea forzados (dos espacios o "\" al final).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type MdInline =
  | { type: "text"; value: string }
  | { type: "strong"; children: MdInline[] }
  | { type: "em"; children: MdInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: MdInline[] }
  | { type: "break" };

export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { type: "paragraph"; children: MdInline[] }
  | { type: "list"; ordered: boolean; start: number; items: MdInline[][] }
  | { type: "blockquote"; children: MdBlock[] }
  | { type: "code"; value: string }
  | { type: "hr" };

/** Tamaño máximo que se procesa (el resto se ignora): evita trabajo excesivo con textos enormes. */
export const MARKDOWN_MAX_LENGTH = 50_000;
const MAX_QUOTE_DEPTH = 4;

/* -------------------------------------------------------------------------- */
/* Enlaces                                                                      */
/* -------------------------------------------------------------------------- */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Devuelve el href si es seguro (http, https, mailto, ruta interna o ancla) o null.
 * Rechaza `javascript:`, `data:`, `vbscript:` y variantes con espacios o caracteres de control.
 */
export function safeHref(raw: string): string | null {
  // Quitar caracteres de control y espacios que los navegadores ignoran dentro del esquema.
  // eslint-disable-next-line no-control-regex
  const href = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (!href || href.length > 2000) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/")) return href.startsWith("//") || href.startsWith("/\\") ? null : href;
  try {
    const url = new URL(href);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/* -------------------------------------------------------------------------- */
/* Inline                                                                       */
/* -------------------------------------------------------------------------- */

const ESCAPABLE = new Set("\\`*_{}[]()#+-.!>~|<".split(""));
const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

function pushText(out: MdInline[], value: string) {
  if (!value) return;
  const last = out[out.length - 1];
  if (last?.type === "text") last.value += value;
  else out.push({ type: "text", value });
}

/** Busca el cierre de un delimitador de énfasis que no esté escapado ni pegado a espacio. */
function findClosing(text: string, from: number, delim: string): number {
  let i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end === -1) return -1;
      i = end + 1;
      continue;
    }
    if (text.startsWith(delim, i) && i > from && !/\s/.test(text[i - 1])) {
      // Para "*" simple, no confundir con "**".
      if (delim.length === 1 && text[i + 1] === delim[0]) {
        i += 2;
        continue;
      }
      if (delim[0] === "_" && isWordChar(text[i + delim.length])) {
        i += delim.length;
        continue;
      }
      return i;
    }
    i++;
  }
  return -1;
}

/** Busca el "]" que cierra un "[" (con anidamiento simple). */
function findBracket(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

export function parseInline(text: string, depth = 0): MdInline[] {
  const out: MdInline[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\") {
      const next = text[i + 1];
      if (next === "\n") {
        out.push({ type: "break" });
        i += 2;
        continue;
      }
      if (next && ESCAPABLE.has(next)) {
        pushText(out, next);
        i += 2;
        continue;
      }
      pushText(out, ch);
      i++;
      continue;
    }

    if (ch === "\n") {
      // Dos espacios antes del salto = salto forzado; si no, el salto es un espacio.
      const last = out[out.length - 1];
      if (last?.type === "text" && / {2,}$/.test(last.value)) {
        last.value = last.value.replace(/ +$/, "");
        out.push({ type: "break" });
      } else {
        pushText(out, " ");
      }
      i++;
      continue;
    }

    if (ch === "`") {
      let ticks = 1;
      while (text[i + ticks] === "`") ticks++;
      const fence = "`".repeat(ticks);
      const end = text.indexOf(fence, i + ticks);
      if (end !== -1) {
        out.push({ type: "code", value: text.slice(i + ticks, end).replace(/\n/g, " ") });
        i = end + ticks;
        continue;
      }
      pushText(out, fence);
      i += ticks;
      continue;
    }

    if ((ch === "*" || ch === "_") && depth < 8) {
      const double = text[i + 1] === ch;
      const delim = double ? ch + ch : ch;
      const canOpen = !/\s/.test(text[i + delim.length] ?? " ") && !(ch === "_" && isWordChar(text[i - 1]));
      if (canOpen) {
        const end = findClosing(text, i + delim.length, delim);
        if (end !== -1) {
          const children = parseInline(text.slice(i + delim.length, end), depth + 1);
          out.push(double ? { type: "strong", children } : { type: "em", children });
          i = end + delim.length;
          continue;
        }
      }
      pushText(out, delim);
      i += delim.length;
      continue;
    }

    if (ch === "[" && depth < 8) {
      const close = findBracket(text, i + 1);
      if (close !== -1 && text[close + 1] === "(") {
        const end = text.indexOf(")", close + 2);
        if (end !== -1) {
          const label = text.slice(i + 1, close);
          const target = text.slice(close + 2, end).trim().split(/\s+/)[0] ?? "";
          const href = safeHref(target.replace(/^<|>$/g, ""));
          const children = parseInline(label, depth + 1);
          if (href) out.push({ type: "link", href, children });
          else for (const c of children) c.type === "text" ? pushText(out, c.value) : out.push(c);
          i = end + 1;
          continue;
        }
      }
      pushText(out, ch);
      i++;
      continue;
    }

    if (ch === "<") {
      const end = text.indexOf(">", i + 1);
      if (end !== -1) {
        const inner = text.slice(i + 1, end);
        if (/^(https?:\/\/|mailto:)[^\s<>]+$/i.test(inner)) {
          const href = safeHref(inner);
          if (href) {
            out.push({ type: "link", href, children: [{ type: "text", value: inner.replace(/^mailto:/i, "") }] });
            i = end + 1;
            continue;
          }
        }
      }
      pushText(out, ch);
      i++;
      continue;
    }

    // Texto plano hasta el próximo carácter especial.
    let j = i + 1;
    while (j < text.length && !"\\\n`*_[<".includes(text[j])) j++;
    pushText(out, text.slice(i, j));
    i = j;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Bloques                                                                      */
/* -------------------------------------------------------------------------- */

const RE_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_FENCE = /^ {0,3}(`{3,}|~{3,})/;
const RE_QUOTE = /^ {0,3}> ?/;
const RE_UL = /^ {0,3}([-*+])[ \t]+(.*)$/;
const RE_OL = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/;

const isBlank = (line: string) => line.trim() === "";

function startsBlock(line: string): boolean {
  return RE_HEADING.test(line) || RE_HR.test(line) || RE_FENCE.test(line) || RE_QUOTE.test(line) || RE_UL.test(line) || RE_OL.test(line);
}

function parseLines(lines: string[], quoteDepth: number): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = RE_FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(marker)) {
        body.push(lines[i]);
        i++;
      }
      i++; // cierre (o fin del texto)
      blocks.push({ type: "code", value: body.join("\n") });
      continue;
    }

    const heading = RE_HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2] ?? ""),
      });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && !isBlank(lines[i]) && (RE_QUOTE.test(lines[i]) || !startsBlock(lines[i]))) {
        inner.push(lines[i].replace(RE_QUOTE, ""));
        i++;
      }
      if (quoteDepth >= MAX_QUOTE_DEPTH) blocks.push({ type: "paragraph", children: parseInline(inner.join("\n")) });
      else blocks.push({ type: "blockquote", children: parseLines(inner, quoteDepth + 1) });
      continue;
    }

    const ul = RE_UL.exec(line);
    const ol = ul ? null : RE_OL.exec(line);
    if (ul || ol) {
      const ordered = Boolean(ol);
      const re = ordered ? RE_OL : RE_UL;
      const items: string[][] = [];
      const start = ol ? Math.min(Number(ol[1]), 999_999_999) : 1;
      while (i < lines.length) {
        const current = lines[i];
        const match = re.exec(current);
        if (match) {
          items.push([match[2]]);
          i++;
          continue;
        }
        // Continuación del ítem: línea con sangría (o texto pegado) que no inicia otro bloque.
        if (!isBlank(current) && items.length && (/^\s{2,}/.test(current) || !startsBlock(current))) {
          items[items.length - 1].push(current.trim());
          i++;
          continue;
        }
        break;
      }
      blocks.push({ type: "list", ordered, start, items: items.map((parts) => parseInline(parts.join("\n"))) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !startsBlock(lines[i]))) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", children: parseInline(para.join("\n").replace(/^[ \t]+/gm, "")) });
  }
  return blocks;
}

export function parseMarkdown(source: string): MdBlock[] {
  const text = (source ?? "").slice(0, MARKDOWN_MAX_LENGTH).replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  return parseLines(text.split("\n"), 0);
}

/** Texto plano (sin marcas) para extractos, metadatos o búsquedas. */
export function markdownToPlainText(source: string): string {
  const inline = (nodes: MdInline[]): string =>
    nodes.map((n) => (n.type === "text" || n.type === "code" ? n.value : n.type === "break" ? " " : inline(n.children))).join("");
  const block = (b: MdBlock): string => {
    switch (b.type) {
      case "heading":
      case "paragraph":
        return inline(b.children);
      case "list":
        return b.items.map(inline).join(" ");
      case "blockquote":
        return b.children.map(block).join(" ");
      case "code":
        return b.value;
      case "hr":
        return "";
    }
  };
  return parseMarkdown(source).map(block).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/* -------------------------------------------------------------------------- */
/* Render                                                                       */
/* -------------------------------------------------------------------------- */

function renderInline(nodes: MdInline[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case "break":
        return <br key={key} />;
      case "code":
        return (
          <code key={key} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
            {node.value}
          </code>
        );
      case "strong":
        return (
          <strong key={key} className="font-semibold">
            {renderInline(node.children, key)}
          </strong>
        );
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "link": {
        const external = isExternalHref(node.href);
        return (
          <a
            key={key}
            href={node.href}
            className="font-medium text-primary-strong underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
            {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          >
            {renderInline(node.children, key)}
          </a>
        );
      }
    }
  });
}

const HEADING_CLASSES = [
  "text-2xl font-semibold tracking-tight",
  "text-xl font-semibold tracking-tight",
  "text-lg font-semibold",
  "text-base font-semibold",
];

function renderBlocks(blocks: MdBlock[], keyPrefix: string, headingOffset: number): React.ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (block.type) {
      case "heading": {
        const level = Math.min(6, block.level + headingOffset) as 1 | 2 | 3 | 4 | 5 | 6;
        const Tag = `h${level}` as const;
        return (
          <Tag key={key} className={cn(HEADING_CLASSES[Math.min(block.level - 1, 3)], "mt-6 first:mt-0")}>
            {renderInline(block.children, key)}
          </Tag>
        );
      }
      case "paragraph":
        return (
          <p key={key} className="leading-relaxed">
            {renderInline(block.children, key)}
          </p>
        );
      case "list": {
        const items = block.items.map((item, i) => (
          <li key={`${key}-${i}`} className="pl-1">
            {renderInline(item, `${key}-${i}`)}
          </li>
        ));
        return block.ordered ? (
          <ol key={key} start={block.start === 1 ? undefined : block.start} className="ml-5 list-decimal space-y-1">
            {items}
          </ol>
        ) : (
          <ul key={key} className="ml-5 list-disc space-y-1">
            {items}
          </ul>
        );
      }
      case "blockquote":
        return (
          <blockquote key={key} className="space-y-3 border-l-4 border-border pl-4 text-muted-foreground">
            {renderBlocks(block.children, key, headingOffset)}
          </blockquote>
        );
      case "code":
        return (
          <pre key={key} className="overflow-x-auto rounded-xl bg-muted p-4 font-mono text-sm">
            <code>{block.value}</code>
          </pre>
        );
      case "hr":
        return <hr key={key} className="border-border" />;
    }
  });
}

type MarkdownContentProps = Omit<React.ComponentProps<"div">, "children"> & {
  source: string;
  /** Suma niveles a los títulos (# → h2 con 1) para no competir con el h1 de la página. */
  headingOffset?: number;
};

/** Renderiza markdown de forma segura (sin dangerouslySetInnerHTML). Sirve en servidor y cliente. */
export function MarkdownContent({ source, headingOffset = 1, className, ...props }: MarkdownContentProps) {
  const blocks = parseMarkdown(source);
  return (
    <div data-slot="markdown" className={cn("flex flex-col gap-4 text-base text-foreground", className)} {...props}>
      {renderBlocks(blocks, "md", headingOffset)}
    </div>
  );
}
