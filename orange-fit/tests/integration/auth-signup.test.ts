import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { authErrorMessage } from "@/features/auth/errors";
import { CONSENT_VERSION } from "@/features/auth/consents";
import { recordSignupConsents } from "@/features/auth/server/signup-consents";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { nextFromRedirectTo, safeNext } from "@/features/auth/redirect";
import { anonClient, serviceClient, SUPABASE_URL, uniqueTag } from "./helpers";

const MAILPIT = "http://127.0.0.1:54324";

function readAnonKey(): string {
  const file = fileURLToPath(new URL("../../.env.local", import.meta.url));
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY="));
  return (line ?? "").slice("NEXT_PUBLIC_SUPABASE_ANON_KEY=".length).trim().replace(/^["']|["']$/g, "");
}

/** Espera el correo de confirmación en Mailpit (Supabase local) y devuelve su texto. */
async function waitForEmail(to: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: Array<{ ID: string }> };
      const id = body.messages?.[0]?.ID;
      if (id) {
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
        return `${msg.Text ?? ""}\n${msg.HTML ?? ""}`;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No llegó el correo para ${to}`);
}

/** Enlace a /auth/confirm del correo (plantillas de supabase/templates). */
function confirmLink(mail: string): URL {
  const raw = /https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/.exec(mail)?.[0]?.replace(/&amp;/g, "&");
  if (!raw) throw new Error("El correo no trae un enlace a /auth/confirm");
  return new URL(raw);
}

describe("registro con correo y confirmación (GoTrue + Mailpit locales)", () => {
  const admin = serviceClient();
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it("signUp guarda nombre y aceptación; sin confirmar no ingresa; al confirmar se registran los consentimientos", async () => {
    const email = `it-signup-${uniqueTag()}@example.com`;
    const password = `Pw-${randomUUID()}`;
    const anon = anonClient();
    const acceptedAt = new Date().toISOString();
    const { data, error } = await anon.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Fonboarding",
        data: {
          display_name: "Ana Registro",
          signup_consents: { version: CONSENT_VERSION, terms: true, privacy: true, accepted_at: acceptedAt },
        },
      },
    });
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
    created.push(data.user!.id);
    // Confirmación de correo activada: no hay sesión todavía.
    expect(data.session).toBeNull();

    const profile = await admin.from("profiles").select("display_name, onboarding_completed_at").eq("id", data.user!.id).single();
    expect(profile.data).toEqual({ display_name: "Ana Registro", onboarding_completed_at: null });

    const early = await anon.auth.signInWithPassword({ email, password });
    expect(early.error?.code).toBe("email_not_confirmed");
    expect(authErrorMessage(early.error, "login")).toMatch(/confirmaste/);

    const mail = await waitForEmail(email);
    const link = confirmLink(mail);
    // Plantilla de supabase/templates/confirmation.html: va directo a /auth/confirm con token_hash
    // y el destino posterior (onboarding) dentro de redirect_to.
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("type")).toBe("email");
    expect(safeNext(nextFromRedirectTo(link.searchParams.get("redirect_to")))).toBe("/onboarding");
    // Lo mismo que hace /auth/confirm en el servidor.
    const confirmed = await anonClient().auth.verifyOtp({ type: "email", token_hash: link.searchParams.get("token_hash")! });
    expect(confirmed.error).toBeNull();
    expect(confirmed.data.session).not.toBeNull();

    const signed = await anon.auth.signInWithPassword({ email, password });
    expect(signed.error).toBeNull();
    await recordSignupConsents(anon, signed.data.user!);
    await recordSignupConsents(anon, signed.data.user!); // idempotente
    const rows = await anon.from("consents").select("consent_type, granted, version, granted_at").eq("user_id", signed.data.user!.id);
    expect(rows.data?.map((r) => r.consent_type).sort()).toEqual(["privacy", "terms"]);
    for (const row of rows.data ?? []) {
      expect(row.granted).toBe(true);
      expect(row.version).toBe(CONSENT_VERSION);
      expect(Date.parse(row.granted_at)).toBe(Date.parse(acceptedAt));
    }
  });

  it("recuperación con token_hash: el enlace funciona aunque se abra en otro navegador", async () => {
    const email = `it-reset-${uniqueTag()}@example.com`;
    const oldPassword = `Pw-${randomUUID()}`;
    const createdUser = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
    created.push(createdUser.data.user!.id);

    // Navegador A pide el correo (cliente PKCE, como @supabase/ssr).
    const memory = new Map<string, string>();
    const browserA = createClient<Database>(SUPABASE_URL, readAnonKey(), {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (k) => memory.get(k) ?? null,
          setItem: (k, v) => void memory.set(k, v),
          removeItem: (k) => void memory.delete(k),
        },
      },
    });
    const reset = await browserA.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/auth/confirm?next=%2Fnueva-clave",
    });
    expect(reset.error).toBeNull();

    const link = confirmLink(await waitForEmail(email));
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("type")).toBe("recovery");

    // Navegador B (sin el verificador PKCE de A) abre el enlace: /auth/confirm hace verifyOtp.
    const browserB = anonClient();
    const verified = await browserB.auth.verifyOtp({ type: "recovery", token_hash: link.searchParams.get("token_hash")! });
    expect(verified.error).toBeNull();
    const newPassword = `Pw-${randomUUID()}`;
    const updated = await browserB.auth.updateUser({ password: newPassword });
    expect(updated.error).toBeNull();
    const again = await anonClient().auth.signInWithPassword({ email, password: newPassword });
    expect(again.error).toBeNull();
  });

  it("credenciales inválidas se traducen sin revelar si la cuenta existe", async () => {
    const anon = anonClient();
    const res = await anon.auth.signInWithPassword({ email: `no-existe-${uniqueTag()}@example.com`, password: "incorrecta-123" });
    expect(res.error?.code).toBe("invalid_credentials");
    expect(authErrorMessage(res.error, "login")).toBe("El correo o la contraseña no coinciden. Revisa e inténtalo otra vez.");
  });
});
