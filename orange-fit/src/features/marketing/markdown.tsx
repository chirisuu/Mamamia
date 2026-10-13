/**
 * Markdown seguro para `content_pages` publicadas (legales y FAQ del sitio público).
 *
 * No se genera HTML en ningún paso: el texto se convierte en un árbol propio y se pinta con
 * elementos de React, que escapan todo. Una etiqueta `<script>` o `<img onerror>` escrita en el
 * markdown se ve como texto. Los enlaces solo aceptan http(s), mailto, rutas internas y anclas.
 *
 * Soporta lo que necesitan estos documentos: títulos, párrafos, listas (con viñetas y numeradas),
 * citas, separadores, bloques de código, **negrita**, *cursiva*, `código`, [enlaces](url) y
 * <https://autoenlaces>. No soporta imágenes, tablas ni HTML.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type MdInline =
  | { type: "text"; value: string }
  | { type: "strong"; children: MdInline[] }
  | { type: "em"; children: MdInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: MdInline[] };

export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { type: "paragraph"; children: MdInline[] }
  | { type: "list"; ordered: boolean; items: MdInline[][] }
  | { type: "quote"; children: MdInline[] }
  | { type: "code"; value: string }
  | { type: "hr" };

/** Más allá de esto no se procesa (evita trabajo excesivo con textos enormes). */
export const MAX_MARKDOWN_LENGTH = 60_000;
const MAX_INLINE_DEPTH = 6;

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * href seguro o null. Quita espacios y caracteres de control (los navegadores los ignoran dentro
 * del esquema, así "java\tscript:" no se cuela) y rechaza todo esquema que no sea http(s)/mailto.
 */
export function safeHref(raw: string): string | null {
  const href = raw.replace(/[\u0000- \u007F-\u009F]+/g, "");
  if (!href || href.length > 2048) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/")) {
    // "//dominio" y "/\dominio" son URLs de otro sitio para el navegador.
    return href.startsWith("//") || href.startsWith("/\\") ? null : href;
  }
  try {
    const url = new URL(href);
    return SAFE_PROTOCOLS.has(url.protocol) ? href : null;
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

function pushText(out: MdInline[], value: string) {
  if (!value) return;
  const last = out[out.length - 1];
  if (last?.type === "text") last.value += value;
  else out.push({ type: "text", value });
}

/** Índice del delimitador de cierre (no escapado, no precedido de espacio) o -1. */
function findClosing(text: string, from: number, delim: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text.startsWith(delim, i) && i > from && !/\s/.test(text[i - 1]!)) {
      if (delim.length === 1 && text[i + 1] === delim) {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

export function parseInline(text: string, depth = 0): MdInline[] {
  const out: MdInline[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;

    if (ch === "\\" && i + 1 < text.length && /[\\`*_[\]()<>#!.-]/.test(text[i + 1]!)) {
      pushText(out, text[i + 1]!);
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        out.push({ type: "code", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if ((ch === "*" || ch === "_") && depth < MAX_INLINE_DEPTH) {
      const delim = text[i + 1] === ch ? ch + ch : ch;
      const next = text[i + delim.length];
      if (next && !/\s/.test(next)) {
        const end = findClosing(text, i + delim.length, delim);
        if (end !== -1) {
          const children = parseInline(text.slice(i + delim.length, end), depth + 1);
          out.push(delim.length === 2 ? { type: "strong", children } : { type: "em", children });
          i = end + delim.length;
          continue;
        }
      }
      pushText(out, delim);
      i += delim.length;
      continue;
    }

    if (ch === "[" && depth < MAX_INLINE_DEPTH) {
      const close = text.indexOf("](", i + 1);
      const end = close === -1 ? -1 : text.indexOf(")", close + 2);
      if (close !== -1 && end !== -1 && !text.slice(i + 1, close).includes("[")) {
        const label = parseInline(text.slice(i + 1, close), depth + 1);
        const target = text.slice(close + 2, end).trim().split(/\s+/)[0] ?? "";
        const href = safeHref(target.replace(/^<|>$/g, ""));
        if (href) out.push({ type: "link", href, children: label });
        else {
          // Enlace con esquema no permitido: queda solo su texto.
          for (const node of label) {
            if (node.type === "text") pushText(out, node.value);
            else out.push(node);
          }
        }
        i = end + 1;
        continue;
      }
    }

    if (ch === "<") {
      const end = text.indexOf(">", i + 1);
      const inner = end === -1 ? "" : text.slice(i + 1, end);
      if (/^(https?:\/\/|mailto:)[^\s<>]+$/i.test(inner)) {
        const href = safeHref(inner);
        if (href) {
          out.push({ type: "link", href, children: [{ type: "text", value: inner.replace(/^mailto:/i, "") }] });
          i = end + 1;
          continue;
        }
      }
    }

    // Texto llano hasta el siguiente carácter con significado.
    let j = i + 1;
    while (j < text.length && !"\\`*_[<".includes(text[j]!)) j++;
    pushText(out, text.slice(i, j));
    i = j;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Bloques                                                                      */
/* -------------------------------------------------------------------------- */

const RE_HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t#]*$/;
const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_FENCE = /^ {0,3}(```|~~~)/;
const RE_QUOTE = /^ {0,3}>[ ]?/;
const RE_UL = /^ {0,3}[-*+][ \t]+(.*)$/;
const RE_OL = /^ {0,3}\d{1,9}[.)][ \t]+(.*)$/;

const isBlank = (line: string) => line.trim() === "";
const startsBlock = (line: string) =>
  RE_HEADING.test(line) || RE_HR.test(line) || RE_FENCE.test(line) || RE_QUOTE.test(line) || RE_UL.test(line) || RE_OL.test(line);

export function parseMarkdown(source: string): MdBlock[] {
  const lines = (source ?? "").slice(0, MAX_MARKDOWN_LENGTH).replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = RE_FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith(fence[1]!)) body.push(lines[i++]!);
      i++;
      blocks.push({ type: "code", value: body.join("\n") });
      continue;
    }

    const heading = RE_HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6, children: parseInline(heading[2]!) });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i]!)) body.push(lines[i++]!.replace(RE_QUOTE, ""));
      blocks.push({ type: "quote", children: parseInline(body.join(" ").trim()) });
      continue;
    }

    const ordered = RE_OL.test(line);
    if (ordered || RE_UL.test(line)) {
      const re = ordered ? RE_OL : RE_UL;
      const items: string[][] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const match = re.exec(current);
        if (match) {
          items.push([match[1]!]);
          i++;
        } else if (!isBlank(current) && items.length > 0 && !startsBlock(current)) {
          // Continuación del ítem anterior.
          items[items.length - 1]!.push(current.trim());
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered, items: items.map((parts) => parseInline(parts.join(" "))) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]!) && (para.length === 0 || !startsBlock(lines[i]!))) para.push(lines[i++]!.trim());
    blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
  }
  return blocks;
}

/** Texto plano (para descripciones, JSON-LD y extractos). */
export function markdownToPlainText(source: string): string {
  const inline = (nodes: MdInline[]): string =>
    nodes.map((n) => (n.type === "text" || n.type === "code" ? n.value : inline(n.children))).join("");
  return parseMarkdown(source)
    .map((b) => {
      switch (b.type) {
        case "heading":
        case "paragraph":
        case "quote":
          return inline(b.children);
        case "list":
          return b.items.map(inline).join(" ");
        case "code":
          return b.value;
        case "hr":
          return "";
      }
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Render                                                                       */
/* -------------------------------------------------------------------------- */

const linkClass =
  "font-medium text-primary-strong underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring";

function renderInline(nodes: MdInline[], key: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const k = `${key}.${index}`;
    switch (node.type) {
      case "text":
        return <React.Fragment key={k}>{node.value}</React.Fragment>;
      case "code":
        return (
          <code key={k} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
            {node.value}
          </code>
        );
      case "strong":
        return (
          <strong key={k} className="font-semibold text-foreground">
            {renderInline(node.children, k)}
          </strong>
        );
      case "em":
        return <em key={k}>{renderInline(node.children, k)}</em>;
      case "link":
        return (
          <a
            key={k}
            href={node.href}
            className={linkClass}
            {...(isExternalHref(node.href) ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          >
            {renderInline(node.children, k)}
          </a>
        );
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  2: "mt-4 text-xl font-semibold tracking-tight first:mt-0",
  3: "mt-2 text-lg font-semibold first:mt-0",
  4: "text-base font-semibold",
  5: "text-base font-semibold",
  6: "text-sm font-semibold",
};

type MarkdownProps = Omit<React.ComponentProps<"div">, "children"> & {
  source: string;
  /** Niveles que se suman a los títulos para no competir con el h1 de la página (# → h2). */
  headingOffset?: number;
};

/** Pinta markdown sin HTML crudo. Funciona en Server Components. */
export function Markdown({ source, headingOffset = 1, className, ...props }: MarkdownProps) {
  const blocks = parseMarkdown(source);
  return (
    <div data-slot="markdown" className={cn("flex flex-col gap-4 text-base leading-relaxed", className)} {...props}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case "heading": {
            const level = Math.min(6, Math.max(2, block.level + headingOffset)) as 2 | 3 | 4 | 5 | 6;
            const Tag = `h${level}` as const;
            return (
              <Tag key={key} className={HEADING_CLASS[level]}>
                {renderInline(block.children, key)}
              </Tag>
            );
          }
          case "paragraph":
            return <p key={key}>{renderInline(block.children, key)}</p>;
          case "quote":
            return (
              <blockquote key={key} className="border-l-4 border-primary/60 pl-4 text-muted-foreground">
                {renderInline(block.children, key)}
              </blockquote>
            );
          case "list": {
            const items = block.items.map((item, i) => (
              <li key={`${key}.${i}`} className="pl-1">
                {renderInline(item, `${key}.${i}`)}
              </li>
            ));
            return block.ordered ? (
              <ol key={key} className="ml-5 list-decimal space-y-1.5">
                {items}
              </ol>
            ) : (
              <ul key={key} className="ml-5 list-disc space-y-1.5">
                {items}
              </ul>
            );
          }
          case "code":
            return (
              <pre key={key} className="overflow-x-auto rounded-xl bg-muted p-4 font-mono text-sm">
                <code>{block.value}</code>
              </pre>
            );
          case "hr":
            return <hr key={key} className="border-border" />;
        }
      })}
    </div>
  );
}
