import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getAppSettings } from "@/lib/config/app-settings";

/**
 * Imagen para compartir (Open Graph / Twitter), 1200×630. Usa Geist desde el paquete `geist` y el
 * nombre vigente de la app. Sin cifras ni promesas: solo la marca y la propuesta.
 */
export const alt = "Registra lo que comes, conoce tus calorías y macros y sigue tu progreso.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS_DIR = join(process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans");

// Paleta de marca (docs/DESIGN_SYSTEM.md §1): la imagen se dibuja fuera del CSS, con valores literales.
const ORANGE = "#FF6B00";
const AMBER = "#FF9F43";
const CARBON = "#17181C";
const GRAPHITE = "#25262C";
const SNOW = "#F7F8FA";
const ZINC = "#A1A1AA";

const ARC_PATH = "M38.42 14.99 A17 17 0 1 1 18.75 7.83";

export default async function OpenGraphImage() {
  const [semibold, regular, { appName }] = await Promise.all([
    readFile(join(FONTS_DIR, "Geist-SemiBold.ttf")),
    readFile(join(FONTS_DIR, "Geist-Regular.ttf")),
    getAppSettings(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: CARBON,
          color: SNOW,
          fontFamily: "Geist",
          padding: "72px 80px",
        }}
      >
        {/* Motivo del anillo, grande y recortado a la derecha. */}
        <svg width="620" height="620" viewBox="0 0 48 48" style={{ position: "absolute", right: -150, top: 5 }}>
          <path d={ARC_PATH} fill="none" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" />
          <circle cx="29.81" cy="8.03" r="3" fill={AMBER} />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="64" height="64" viewBox="0 0 48 48">
              <path d={ARC_PATH} fill="none" stroke={ORANGE} strokeWidth="7" strokeLinecap="round" />
              <circle cx="29.81" cy="8.03" r="4.2" fill={SNOW} />
            </svg>
            <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -0.5 }}>{appName}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2 }}>
              <span>Come con intención.</span>
              <span style={{ color: AMBER }}>Avanza a tu ritmo.</span>
            </div>
            <span style={{ fontSize: 30, lineHeight: 1.35, color: ZINC, fontWeight: 400 }}>
              Calorías y macros según tu objetivo. Registra buscando, escaneando, con foto o con tu voz.
            </span>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {["Sin dietas extremas", "Tú confirmas cada registro"].map((label) => (
              <span
                key={label}
                style={{
                  display: "flex",
                  fontSize: 24,
                  padding: "10px 20px",
                  borderRadius: 999,
                  backgroundColor: GRAPHITE,
                  color: SNOW,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
