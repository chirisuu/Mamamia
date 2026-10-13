import { describe, expect, it, vi } from "vitest";
import { AiError } from "@/lib/ai/errors";
import { ImageInputError } from "@/lib/ai/image";
import { AiQuotaDeniedError } from "@/lib/ai/quota";
import { TranscriptionError } from "@/lib/ai/transcription";
import { aiErrorResponse } from "./http";

async function body(res: Response) {
  return { status: res.status, json: (await res.json()) as { error: { code: string; message: string; quota?: unknown } } };
}

describe("aiErrorResponse: errores → JSON { error: { code, message } } con el status correcto", () => {
  it("sin cupo → 429 AI_QUOTA_EXCEEDED con el uso; plan sin cupo → 403 PREMIUM_REQUIRED", async () => {
    const quota = await body(aiErrorResponse(new AiQuotaDeniedError({ allowed: false, used: 120, limit: 120, plan: "premium", requestId: null })));
    expect(quota).toMatchObject({ status: 429, json: { error: { code: "AI_QUOTA_EXCEEDED", quota: { used: 120, limit: 120 } } } });
    const free = await body(aiErrorResponse(new AiQuotaDeniedError({ allowed: false, used: 0, limit: 0, plan: "free", requestId: null })));
    expect(free).toMatchObject({ status: 403, json: { error: { code: "PREMIUM_REQUIRED" } } });
  });

  it("errores de IA con su status (503, 422, 502, 429)", async () => {
    expect((await body(aiErrorResponse(new AiError("AI_NOT_CONFIGURED")))).status).toBe(503);
    expect((await body(aiErrorResponse(new AiError("AI_REFUSED")))).json.error.code).toBe("AI_REFUSED");
    expect((await body(aiErrorResponse(new AiError("AI_REFUSED")))).status).toBe(422);
    expect((await body(aiErrorResponse(new AiError("AI_INVALID_OUTPUT")))).status).toBe(502);
    expect((await body(aiErrorResponse(new AiError("AI_RATE_LIMITED")))).status).toBe(429);
  });

  it("imagen y transcripción", async () => {
    expect((await body(aiErrorResponse(new ImageInputError("IMAGE_TOO_LARGE", "x")))).status).toBe(413);
    expect((await body(aiErrorResponse(new ImageInputError("IMAGE_TYPE", "x")))).status).toBe(415);
    expect((await body(aiErrorResponse(new TranscriptionError("TRANSCRIPTION_NOT_CONFIGURED", 503, "x")))).status).toBe(503);
  });

  it("inesperado → 500 sin detalles internos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await body(aiErrorResponse(new Error("detalle interno con datos")));
    expect(res.status).toBe(500);
    expect(res.json.error.message).not.toMatch(/detalle interno/);
  });

  it("nunca se cachea", () => {
    expect(aiErrorResponse(new AiError("AI_REFUSED")).headers.get("cache-control")).toBe("private, no-store");
  });
});
