import "server-only";
import { z } from "zod";

/** Variables solo de servidor. Nunca importar desde componentes de cliente. */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL_VISION: z.string().min(1).default("claude-opus-5-5"),
  AI_MODEL_TEXT: z.string().min(1).default("claude-opus-5-5"),
  AI_MODEL_CHAT: z.string().min(1).default("claude-opus-5-5"),
  TRANSCRIPTION_PROVIDER: z.enum(["none", "openai"]).default("none"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1).optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1).optional(),
  FDC_API_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(serverSchema.shape)) {
    const value = process.env[key];
    raw[key] = value === "" ? undefined : value;
  }
  raw.SUPABASE_SERVICE_ROLE_KEY ??= process.env.SUPABASE_SECRET_KEY || undefined;
  cached = serverSchema.parse(raw);
  return cached;
}

/** Estado de cada integración externa, para mostrarlo con honestidad en la UI y en /admin. */
export function integrationStatus() {
  const env = serverEnv();
  return {
    supabaseAdmin: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    ai: Boolean(env.ANTHROPIC_API_KEY),
    transcription: env.TRANSCRIPTION_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY),
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    mercadopago: Boolean(env.MERCADOPAGO_ACCESS_TOKEN && env.MERCADOPAGO_WEBHOOK_SECRET),
    usda: Boolean(env.FDC_API_KEY),
    push: Boolean(env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    cron: Boolean(env.CRON_SECRET),
  } as const;
}
