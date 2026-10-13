#!/usr/bin/env node
/**
 * Genera los iconos de la PWA desde el logo vectorial (public/icons/logo.svg) con sharp.
 *
 *   node scripts/generate-icons.mjs
 *
 * Salida (todo en public/):
 *   icons/icon-192.png, icons/icon-512.png   propósito "any": cuadrado redondeado carbón + marca
 *   icons/maskable-512.png                   propósito "maskable": fondo completo, marca dentro de la zona segura
 *   icons/apple-touch-icon.png (180)         iOS aplica su propia máscara: fondo completo, sin transparencia
 *   icons/badge-96.png                       insignia monocromática (Android usa solo el canal alfa)
 *   favicon.ico                              16, 32 y 48 px (PNG dentro de ICO)
 *
 * La geometría (anillo y punto) se lee del SVG: si cambia el logo, basta volver a ejecutar el script.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");
const LOGO_FILE = path.join(ICONS_DIR, "logo.svg");

// Paleta de marca (docs/DESIGN_SYSTEM.md §1).
const ORANGE = "#FF6B00";
const CARBON = "#17181C";
const SNOW = "#F7F8FA";
const WHITE = "#FFFFFF";

/** Radio del contenido de la marca medido desde el centro (24, 24) del viewBox de 48. */
const MARK_RADIUS = 21.2;

function attr(element, name) {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(element);
  if (!match) throw new Error(`El logo no tiene el atributo ${name} en ${element}`);
  return match[1];
}

/** Lee el anillo y el punto de logo.svg (elementos con data-part="ring" y data-part="dot"). */
async function readLogo() {
  const svg = await fs.readFile(LOGO_FILE, "utf8");
  const ring = /<path\b[^>]*data-part="ring"[^>]*\/>/.exec(svg)?.[0];
  const dot = /<circle\b[^>]*data-part="dot"[^>]*\/>/.exec(svg)?.[0];
  if (!ring || !dot) throw new Error("public/icons/logo.svg debe tener <path data-part=\"ring\"> y <circle data-part=\"dot\">.");
  return {
    ringPath: attr(ring, "d"),
    ringWidth: Number(attr(ring, "stroke-width")),
    dot: { cx: Number(attr(dot, "cx")), cy: Number(attr(dot, "cy")), r: Number(attr(dot, "r")) },
  };
}

/**
 * SVG de un icono cuadrado de `size` px.
 * - background: "rounded" (cuadrado con esquinas), "full" (todo el lienzo) o "none" (transparente).
 * - coverage: fracción del lado que ocupa el diámetro de la marca.
 */
function iconSvg(logo, { size, background, coverage, ringColor = ORANGE, dotColor = SNOW, backgroundColor = CARBON }) {
  const scale = (coverage * size) / (2 * MARK_RADIUS);
  const offset = size / 2 - 24 * scale;
  const radius = background === "rounded" ? Math.round(size * 0.225) : 0;
  const bg = background === "none" ? "" : `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${backgroundColor}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${offset.toFixed(3)} ${offset.toFixed(3)}) scale(${scale.toFixed(5)})">
    <path d="${logo.ringPath}" fill="none" stroke="${ringColor}" stroke-width="${logo.ringWidth}" stroke-linecap="round"/>
    <circle cx="${logo.dot.cx}" cy="${logo.dot.cy}" r="${logo.dot.r}" fill="${dotColor}"/>
  </g>
</svg>`;
}

async function renderPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

/** Arma un .ico con imágenes PNG embebidas (formato admitido por todos los navegadores actuales). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // ancho
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // alto
    entry.writeUInt8(0, 2); // colores de paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

async function main() {
  const logo = await readLogo();
  await fs.mkdir(ICONS_DIR, { recursive: true });

  const outputs = [
    { file: "icons/icon-192.png", svg: iconSvg(logo, { size: 192, background: "rounded", coverage: 0.62 }) },
    { file: "icons/icon-512.png", svg: iconSvg(logo, { size: 512, background: "rounded", coverage: 0.62 }) },
    // Zona segura de un icono maskable: círculo de radio 40 % del lado. La marca usa 33 %.
    { file: "icons/maskable-512.png", svg: iconSvg(logo, { size: 512, background: "full", coverage: 0.66 }) },
    { file: "icons/apple-touch-icon.png", svg: iconSvg(logo, { size: 180, background: "full", coverage: 0.62 }) },
    {
      file: "icons/badge-96.png",
      svg: iconSvg(logo, { size: 96, background: "none", coverage: 0.84, ringColor: WHITE, dotColor: WHITE }),
    },
  ];

  for (const output of outputs) {
    const png = await renderPng(output.svg);
    await fs.writeFile(path.join(PUBLIC_DIR, output.file), png);
    console.log(`✓ public/${output.file} (${png.length} bytes)`);
  }

  const icoImages = [];
  for (const size of [16, 32, 48]) {
    // En tamaños chicos la marca ocupa más del lienzo para seguir siendo legible.
    const data = await renderPng(iconSvg(logo, { size, background: "rounded", coverage: 0.8 }));
    icoImages.push({ size, data });
  }
  const ico = buildIco(icoImages);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), ico);
  console.log(`✓ public/favicon.ico (${ico.length} bytes; 16, 32 y 48 px)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
