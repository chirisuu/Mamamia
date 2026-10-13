import { z } from "zod";
import type { Enums, Tables } from "@/lib/db/database.types";

/**
 * Consentimientos (tabla `consents`, historial: la fila más reciente por tipo manda).
 * La versión cambia cuando cambian los textos legales; así se sabe qué aceptó cada persona.
 */
export const CONSENT_VERSION = "2026-10";

export type ConsentType = Enums<"consent_type">;

export const LEGAL_LINKS = {
  terms: "/legal/terminos",
  privacy: "/legal/privacidad",
} as const;

export type ConsentInfo = {
  title: string;
  description: string;
  /** Obligatorio para usar la app. */
  required: boolean;
  /**
   * yes: se puede retirar desde Privacidad.
   * pauses_app: se puede retirar, pero la app deja de procesar tus datos de salud (se pausa el acceso).
   * account: solo se retira eliminando la cuenta (términos y privacidad).
   */
  revocable: "yes" | "pauses_app" | "account";
};

export const CONSENT_INFO: Record<ConsentType, ConsentInfo> = {
  terms: {
    title: "Términos y condiciones",
    description: "Las reglas de uso del servicio.",
    required: true,
    revocable: "account",
  },
  privacy: {
    title: "Política de privacidad",
    description: "Cómo tratamos y protegemos tus datos personales.",
    required: true,
    revocable: "account",
  },
  health_data: {
    title: "Tratamiento de datos de salud",
    description:
      "Tu peso, talla, condiciones de salud y lo que registras se usan solo para calcular y ajustar tus metas. Son datos sensibles según la Ley N.° 29733, Ley de Protección de Datos Personales.",
    required: true,
    revocable: "pauses_app",
  },
  ai_processing: {
    title: "Análisis con IA",
    description:
      "Permite enviar tus fotos, audios o textos de comidas a un proveedor de IA externo para que sugiera alimentos y porciones. Siempre confirmas antes de guardar.",
    required: false,
    revocable: "yes",
  },
  progress_photos: {
    title: "Fotos de progreso",
    description: "Permite guardar fotos de tu cuerpo en un espacio privado para comparar tu avance.",
    required: false,
    revocable: "yes",
  },
  marketing: {
    title: "Novedades y consejos",
    description: "Correos ocasionales con novedades de la app y consejos de alimentación.",
    required: false,
    revocable: "yes",
  },
};

/** Orden en que se muestran en Privacidad. */
export const CONSENT_ORDER: readonly ConsentType[] = [
  "terms",
  "privacy",
  "health_data",
  "ai_processing",
  "progress_photos",
  "marketing",
];

/**
 * Texto explícito y separado para el consentimiento de datos de salud: la Ley 29733 trata la salud
 * como dato sensible y exige un consentimiento expreso para tratarlo.
 */
export const HEALTH_DATA_CONSENT_TEXT =
  "Autorizo de forma expresa el tratamiento de mis datos de salud (peso, talla, fecha de nacimiento, condiciones de salud y registros de alimentación) para calcular y ajustar mis metas nutricionales, conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento. No se venden ni se comparten sin mi permiso, y puedo revocar esta autorización cuando quiera desde Privacidad.";

export type ConsentRow = Pick<Tables<"consents">, "consent_type" | "granted" | "granted_at" | "revoked_at" | "created_at" | "version">;

/** Fila vigente por tipo (la más reciente por created_at; desempate por granted_at). */
export function latestConsents(rows: readonly ConsentRow[]): Partial<Record<ConsentType, ConsentRow>> {
  const out: Partial<Record<ConsentType, ConsentRow>> = {};
  for (const row of rows) {
    const current = out[row.consent_type];
    if (!current) {
      out[row.consent_type] = row;
      continue;
    }
    const a = Date.parse(row.created_at);
    const b = Date.parse(current.created_at);
    if (a > b || (a === b && Date.parse(row.granted_at) > Date.parse(current.granted_at))) {
      out[row.consent_type] = row;
    }
  }
  return out;
}

export function isConsentActive(latest: Partial<Record<ConsentType, ConsentRow>>, type: ConsentType): boolean {
  const row = latest[type];
  return Boolean(row && row.granted && !row.revoked_at);
}

/**
 * Aceptación de términos guardada en `user_metadata` al registrarse (aún no hay sesión para
 * escribir en `consents`). Se pasa a la tabla al confirmar el correo.
 */
export const signupConsentsMetaSchema = z.object({
  version: z.string().min(1).max(40),
  terms: z.literal(true),
  privacy: z.literal(true),
  accepted_at: z.iso.datetime({ offset: true }),
});
export type SignupConsentsMeta = z.infer<typeof signupConsentsMetaSchema>;

export function parseSignupConsents(meta: unknown): SignupConsentsMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const parsed = signupConsentsMetaSchema.safeParse((meta as Record<string, unknown>).signup_consents);
  return parsed.success ? parsed.data : null;
}
