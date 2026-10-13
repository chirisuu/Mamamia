import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { hasRole } from "./session";

describe("hasRole", () => {
  it("respeta la jerarquía superadmin ⊃ admin ⊃ editor", () => {
    expect(hasRole(["superadmin"], "admin")).toBe(true);
    expect(hasRole(["admin"], "editor")).toBe(true);
    expect(hasRole(["editor"], "admin")).toBe(false);
    expect(hasRole([], "editor")).toBe(false);
  });
  it("professional no hereda permisos de staff ni al revés", () => {
    expect(hasRole(["professional"], "editor")).toBe(false);
    expect(hasRole(["superadmin"], "professional")).toBe(false);
    expect(hasRole(["professional"], "professional")).toBe(true);
  });
});
