/**
 * Utilidades para las pruebas de integración contra el Supabase LOCAL.
 * Lee URL y claves de `.env.local` (no hay claves en el código) y se niega a correr
 * contra algo que no sea la instancia local.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export type Db = SupabaseClient<Database>;
export type AppRole = Database["public"]["Enums"]["app_role"];

function loadEnvLocal(): Record<string, string> {
  const file = fileURLToPath(new URL("../../.env.local", import.meta.url));
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const env = loadEnvLocal();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en .env.local");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(SUPABASE_URL)) {
  // Estas pruebas crean y borran usuarios: nunca contra un proyecto remoto.
  throw new Error(`Las pruebas de integración solo corren contra Supabase local (URL actual: ${SUPABASE_URL})`);
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Cliente con service role (se salta RLS): solo para preparar y limpiar datos. */
export function serviceClient(): Db {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, clientOptions);
}

/** Cliente anónimo nuevo (sin sesión). */
export function anonClient(): Db {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, clientOptions);
}

export type TestUser = { id: string; email: string; client: Db };

/** Etiqueta corta y única para los datos de una corrida. */
export function uniqueTag(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10);
}

/**
 * Crea un usuario confirmado con el service role (opcionalmente con roles) y devuelve un
 * cliente anónimo propio con la sesión iniciada por signInWithPassword.
 */
export async function createTestUser(label: string, roles: AppRole[] = []): Promise<TestUser> {
  const admin = serviceClient();
  const email = `it-${label}-${uniqueTag()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Prueba ${label}` },
  });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  const id = data.user.id;

  if (roles.length > 0) {
    const { error: roleError } = await admin.from("user_roles").insert(roles.map((role) => ({ user_id: id, role })));
    if (roleError) throw new Error(`No se pudo asignar el rol: ${roleError.message}`);
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`No se pudo iniciar sesión: ${signInError.message}`);
  return { id, email, client };
}

/** Borra usuarios de prueba (sus datos caen en cascada). */
export async function deleteTestUsers(users: Array<TestUser | undefined>): Promise<void> {
  const admin = serviceClient();
  for (const user of users) {
    if (!user) continue;
    await user.client.auth.signOut().catch(() => undefined);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`No se pudo borrar el usuario ${user.id}: ${error.message}`);
  }
}

/** Datos mínimos válidos para un alimento (por 100 g). */
export function foodFixture(name: string) {
  return {
    name,
    energy_kcal: 120,
    protein_g: 4,
    carbs_g: 22,
    fat_g: 1.5,
    fiber_g: 2,
  };
}
