import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { authErrorMessage } from "@/features/auth/errors";
import { CONSENT_VERSION } from "@/features/auth/consents";
import { recordSignupConsents } from "@/features/auth/server/signup-consents";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { safeNext } from "@/features/auth/redirect";
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
    const link = /https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/.exec(mail)?.[0]?.replace(/&amp;/g, "&");
    expect(link).toBeTruthy();
    // El enlace del correo vuelve a /auth/confirm con el destino posterior (onboarding).
    const redirectTo = new URL(link!).searchParams.get("redirect_to")!;
    expect(redirectTo.startsWith("http://localhost:3000/auth/confirm")).toBe(true);
    expect(new URL(redirectTo).searchParams.get("next")).toBe("/onboarding");
    const verify = await fetch(link!, { redirect: "manual" });
    expect([302, 303]).toContain(verify.status);
    expect(verify.headers.get("location")).toMatch(/^http:\/\/localhost:3000\/auth\/confirm/);

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

  it("recuperación con PKCE (como el navegador): el enlace vuelve a /auth/confirm?next=/nueva-clave con un código canjeable", async () => {
    const email = `it-reset-${uniqueTag()}@example.com`;
    const oldPassword = `Pw-${randomUUID()}`;
    const createdUser = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
    created.push(createdUser.data.user!.id);

    // Cliente PKCE con almacenamiento en memoria (equivale a las cookies del navegador).
    const memory = new Map<string, string>();
    const anonKey = readAnonKey();
    const browserLike = createClient<Database>(SUPABASE_URL, anonKey, {
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
    const reset = await browserLike.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/auth/confirm?next=%2Fnueva-clave",
    });
    expect(reset.error).toBeNull();

    const mail = await waitForEmail(email);
    const link = /https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/.exec(mail)?.[0]?.replace(/&amp;/g, "&");
    const verify = await fetch(link!, { redirect: "manual" });
    const location = new URL(verify.headers.get("location")!);
    expect(location.pathname).toBe("/auth/confirm");
    expect(safeNext(location.searchParams.get("next"), "/nueva-clave")).toBe("/nueva-clave");
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    const exchanged = await browserLike.auth.exchangeCodeForSession(code!);
    expect(exchanged.error).toBeNull();
    const newPassword = `Pw-${randomUUID()}`;
    const updated = await browserLike.auth.updateUser({ password: newPassword });
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
