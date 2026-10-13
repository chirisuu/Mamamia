/**
 * Códigos de barras de productos (GTIN): EAN-13, EAN-8, UPC-A y UPC-E, con dígito verificador.
 * Puro (sin I/O): se usa en el escáner (cliente), en la entrada manual y en el servidor.
 *
 * Un mismo producto puede leerse con formatos distintos (UPC-A de 12 dígitos = EAN-13 con un 0
 * delante; UPC-E es la versión comprimida de un UPC-A), así que `lookupCodes` lista todas las
 * variantes con las que puede estar guardado.
 */

export type BarcodeFormat = "ean13" | "ean8" | "upca" | "upce";

export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat, string> = {
  ean13: "EAN-13",
  ean8: "EAN-8",
  upca: "UPC-A",
  upce: "UPC-E",
};

export type BarcodeErrorCode = "EMPTY" | "NOT_NUMERIC" | "LENGTH" | "CHECK_DIGIT";

export type ParsedBarcode =
  | {
      ok: true;
      /** Código tal como se leyó (solo dígitos). */
      code: string;
      format: BarcodeFormat;
      /** Variantes equivalentes para buscar en la base (la primera es la leída). */
      lookupCodes: string[];
      /** Código con el que se consulta Open Food Facts (EAN-13 para UPC). */
      offCode: string;
    }
  | { ok: false; error: BarcodeErrorCode; message: string };

const MESSAGES: Record<BarcodeErrorCode, string> = {
  EMPTY: "Escribe el código de barras.",
  NOT_NUMERIC: "El código de barras solo tiene números.",
  LENGTH: "Los códigos de barras tienen 8, 12 o 13 dígitos.",
  CHECK_DIGIT: "Ese código no es válido: revisa que esté bien escrito (el último dígito no coincide).",
};

/** Dígito verificador GTIN (módulo 10, pesos 3 y 1 desde la derecha) para el cuerpo sin verificador. */
export function gtinCheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) throw new Error("gtinCheckDigit: solo dígitos");
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** ¿El último dígito coincide con el verificador GTIN? (vale para EAN-8, UPC-A, EAN-13 y GTIN-14). */
export function hasValidGtinCheckDigit(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === code.charCodeAt(code.length - 1) - 48;
}

/**
 * Expande un UPC-E de 8 dígitos (sistema numérico 0 o 1 + 6 dígitos + verificador) a UPC-A.
 * Devuelve null si no tiene forma de UPC-E. No valida el verificador.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if (last === "0" || last === "1" || last === "2") body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === "3") body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === "4") body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  return `${ns}${body}${check}`;
}

/** ¿Es un UPC-E válido (su UPC-A expandido tiene el verificador correcto)? */
export function isValidUpcE(code: string): boolean {
  const upca = expandUpcE(code);
  return upca !== null && hasValidGtinCheckDigit(upca);
}

const unique = (values: string[]) => [...new Set(values)];

/**
 * Valida y normaliza un código leído o escrito. Acepta espacios y guiones (se ignoran) y un
 * GTIN-14 con 0 inicial (se trata como EAN-13).
 */
export function parseBarcode(raw: string | null | undefined): ParsedBarcode {
  const cleaned = String(raw ?? "").replace(/[\s-]/g, "");
  if (cleaned === "") return { ok: false, error: "EMPTY", message: MESSAGES.EMPTY };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "NOT_NUMERIC", message: MESSAGES.NOT_NUMERIC };

  const code = cleaned.length === 14 && cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;

  if (code.length === 13) {
    if (!hasValidGtinCheckDigit(code)) return { ok: false, error: "CHECK_DIGIT", message: MESSAGES.CHECK_DIGIT };
    const variants = code.startsWith("0") ? [code, code.slice(1)] : [code];
    return { ok: true, code, format: "ean13", lookupCodes: variants, offCode: code };
  }
  if (code.length === 12) {
    if (!hasValidGtinCheckDigit(code)) return { ok: false, error: "CHECK_DIGIT", message: MESSAGES.CHECK_DIGIT };
    return { ok: true, code, format: "upca", lookupCodes: [code, `0${code}`], offCode: `0${code}` };
  }
  if (code.length === 8) {
    const ean8 = hasValidGtinCheckDigit(code);
    const upce = isValidUpcE(code);
    if (!ean8 && !upce) return { ok: false, error: "CHECK_DIGIT", message: MESSAGES.CHECK_DIGIT };
    const upca = upce ? expandUpcE(code) : null;
    const variants = unique([code, ...(upca ? [upca, `0${upca}`] : [])]);
    // Un código de 8 dígitos puede ser EAN-8 y UPC-E a la vez: se prefiere EAN-8 (más común fuera de EE. UU.).
    return {
      ok: true,
      code,
      format: ean8 ? "ean8" : "upce",
      lookupCodes: variants,
      offCode: ean8 || !upca ? code : `0${upca}`,
    };
  }
  return { ok: false, error: "LENGTH", message: MESSAGES.LENGTH };
}

/** Código válido o null (atajo para el escáner, que descarta lecturas parciales). */
export function normalizeScannedBarcode(raw: string | null | undefined): string | null {
  const parsed = parseBarcode(raw);
  return parsed.ok ? parsed.code : null;
}
