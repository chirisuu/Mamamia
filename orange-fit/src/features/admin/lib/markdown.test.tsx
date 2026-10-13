import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent, markdownToPlainText, parseInline, parseMarkdown, safeHref } from "./markdown";

const html = (source: string, headingOffset?: number) => renderToStaticMarkup(<MarkdownContent source={source} headingOffset={headingOffset} />);

describe("safeHref", () => {
  it("acepta http(s), mailto, rutas internas y anclas", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("mailto:soporte@example.com")).toBe("mailto:soporte@example.com");
    expect(safeHref("/legal/terminos")).toBe("/legal/terminos");
    expect(safeHref("#seccion")).toBe("#seccion");
  });

  it("rechaza esquemas peligrosos aunque vengan disfrazados", () => {
    for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", " java\tscript:alert(1)", "java\nscript:alert(1)", "data:text/html,<script>", "vbscript:x", "//evil.com", "/\\evil.com", "file:///etc/passwd"]) {
      expect(safeHref(bad), bad).toBeNull();
    }
  });
});

describe("render seguro", () => {
  it("nunca inserta HTML crudo: las etiquetas se muestran como texto", () => {
    const out = html('<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>\n\n<a href="javascript:alert(1)">hola</a>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<img/i);
    expect(out).not.toMatch(/<a /i);
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("los enlaces inseguros quedan como texto sin href", () => {
    const out = html("[haz clic](javascript:alert(1)) y [otro](data:text/html;base64,PHNjcmlwdD4=)");
    expect(out).not.toContain("href");
    expect(out).toContain("haz clic");
    expect(out).toContain("otro");
  });

  it("los enlaces externos abren aparte con rel seguro; los internos no", () => {
    const out = html("[USDA](https://fdc.nal.usda.gov) y [términos](/legal/terminos)");
    const [external, internal] = out.match(/<a [^>]*>/g) ?? [];
    expect(external).toContain('href="https://fdc.nal.usda.gov"');
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer nofollow"');
    expect(internal).toContain('href="/legal/terminos"');
    expect(internal).not.toContain("target=");
  });

  it("los atributos no se pueden inyectar desde la URL", () => {
    const out = html('[x](https://a.com/"onmouseover="alert(1))');
    expect(out).not.toMatch(/"\s*onmouseover=/);
  });

  it("pinta títulos con desplazamiento, listas, citas, código y énfasis", () => {
    const out = html("# Título\n\nTexto con **negrita**, *cursiva* y `code`.\n\n- uno\n- dos\n\n3. tres\n4. cuatro\n\n> cita\n\n```\n<b>sin formato</b>\n```\n\n---", 1);
    expect(out).toContain("<h2");
    expect(out).toContain("<strong");
    expect(out).toContain("<em>cursiva</em>");
    expect(out).toContain("<ul");
    expect(out).toContain('<ol start="3"');
    expect(out).toContain("<blockquote");
    expect(out).toContain("&lt;b&gt;sin formato&lt;/b&gt;");
    expect(out).toContain("<hr");
  });

  it("no confunde guiones bajos dentro de palabras con cursiva", () => {
    expect(parseInline("feature_flags_x")).toEqual([{ type: "text", value: "feature_flags_x" }]);
  });

  it("autoenlaces y escapes", () => {
    expect(parseInline("<https://example.com>")).toEqual([{ type: "link", href: "https://example.com", children: [{ type: "text", value: "https://example.com" }] }]);
    expect(parseInline("\\*no cursiva\\*")).toEqual([{ type: "text", value: "*no cursiva*" }]);
  });

  it("limita la profundidad de citas y el tamaño procesado", () => {
    const deep = parseMarkdown(">>>>>>>> muy adentro");
    expect(JSON.stringify(deep).length).toBeLessThan(2000);
    expect(() => html("a".repeat(200_000))).not.toThrow();
  });

  it("markdownToPlainText quita las marcas", () => {
    expect(markdownToPlainText("# Hola\n\n**Mundo** con [enlace](https://x.com)")).toBe("Hola Mundo con enlace");
  });
});
