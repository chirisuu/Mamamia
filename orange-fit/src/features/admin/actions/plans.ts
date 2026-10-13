"use server";

import type { ActionResult } from "@/lib/action-result";
import { planPriceSchema, planSchema, type PlanInput, type PlanPriceInput } from "../schemas";
import { runAdminAction } from "../server/action";
import { savePlanPrice, updatePlan } from "../server/plans";

const REVALIDATE = ["/admin/planes", "/precios", "/app/premium"];

export async function updatePlanAction(input: PlanInput): Promise<ActionResult<null>> {
  return runAdminAction(
    "admin",
    planSchema,
    input,
    async ({ supabase, data }) => {
      await updatePlan(supabase, data);
      return null;
    },
    REVALIDATE,
  );
}

export async function savePlanPriceAction(input: PlanPriceInput): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAdminAction("admin", planPriceSchema, input, ({ supabase, data }) => savePlanPrice(supabase, data), REVALIDATE);
}
