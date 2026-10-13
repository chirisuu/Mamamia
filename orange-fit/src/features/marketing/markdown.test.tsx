import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, markdownToPlainText, parseInline, parseMarkdown, safeHref } from "./markdown";

const render = (source: string) => renderToStaticMarkup(<Markdown source={source} />);

describe("safeHref", () => {
  it("acepta http(s), mailto, rutas internas y anclas", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:hola@example.com")).toBe("mailto:hola@example.com");
    expect(safeHref("/legal/privacidad")).toBe("/legal/privacidad");
    expect(safeHref("#seccion")).toBe("#seccion");
  });

  it("rechaza esquemas peligrosos aunque vengan disfrazados", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      " javascript:alert(1)",
      "java\u0000script:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "//evil.example",
      "/\\evil.example",
      "file:///etc/passwd",
      "",
    ]) {
      expect(safeHref(href), JSON.stringify(href)).toBeNull();
    }
  });
});

describe("Markdown seguro", () => {
  it("no genera HTML crudo: las etiquetas se ven como texto", () => {
    const html = render('Hola <script>alert("x")</script> y <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("los enlaces con esquemas no permitidos quedan como texto", () => {
    const html = render("[Haz clic](javascript:alert(1)) y [aquí](data:text/html,hola)");
    expect(html).not.toContain("href=");
    expect(html).toContain("Haz clic");
    expect(html).toContain("aquí");
  });

  it("los enlaces externos abren aparte sin pasar referencia ni autoridad", () => {
    const html = render("Ver [la ley](https://www.gob.pe/ley) o [privacidad](/legal/privacidad).");
    expect(html).toContain('href="https://www.gob.pe/ley"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/href="\/legal\/privacidad"(?![^>]*target)/);
  });

  it("los atributos no se pueden inyectar desde la URL", () => {
    const html = render('[x](https://a.pe/"onmouseover="alert(1))');
    expect(html).not.toMatch(/\sonmouseover=/);
  });

  it("soporta títulos, listas, citas, código, negrita y cursiva", () => {
    const html = render(
      ["# Título", "", "Texto con **negrita**, *cursiva* y `código`.", "", "- uno", "- dos", "", "1. a", "2. b", "", "> cita", "", "```", "<b>crudo</b>", "```", "", "---"].join("\n"),
    );
    // # → h2 (la página ya tiene su h1).
    expect(html).toContain("<h2");
    expect(html).toContain("<strong");
    expect(html).toContain("<em>cursiva</em>");
    expect(html).toContain("<code");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<blockquote");
    expect(html).toContain("&lt;b&gt;crudo&lt;/b&gt;");
    expect(html).toContain("<hr");
  });

  it("autoenlaces solo con esquemas seguros", () => {
    expect(parseInline("<https://a.pe>")).toEqual([{ type: "link", href: "https://a.pe", children: [{ type: "text", value: "https://a.pe" }] }]);
    expect(parseInline("<javascript:alert(1)>")).toEqual([{ type: "text", value: "<javascript:alert(1)>" }]);
  });

  it("no se cuelga ni explota con anidaciones y textos enormes", () => {
    const nested = "*".repeat(200) + "x" + "*".repeat(200);
    expect(() => render(nested)).not.toThrow();
    const blocks = parseMarkdown("a".repeat(200_000));
    expect(blocks).toHaveLength(1);
  });

  it("texto plano para JSON-LD y descripciones", () => {
    expect(markdownToPlainText("## Hola\n\nTexto con **negrita** y [enlace](https://a.pe).\n\n- uno\n- dos")).toBe(
      "Hola Texto con negrita y enlace. uno dos",
    );
  });
});
