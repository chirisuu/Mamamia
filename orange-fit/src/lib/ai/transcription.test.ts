/** Adaptador opcional de transcripción (OpenAI por REST) con `fetch` simulado: nunca sale a la red. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ current: { TRANSCRIPTION_PROVIDER: "none", OPENAI_API_KEY: undefined } as Record<string, string | undefined> }));
vi.mock("@/lib/server-env", () => ({ serverEnv: () => env.current }));

import { baseAudioType, isAcceptedAudioType, transcribeAudio, transcriptionConfigured } from "./transcription";

const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" });

describe("transcripción de voz", () => {
  beforeEach(() => {
    env.current = { TRANSCRIPTION_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" };
  });

  it("sin TRANSCRIPTION_PROVIDER=openai u OPENAI_API_KEY → TRANSCRIPTION_NOT_CONFIGURED (503), sin llamar a la red", async () => {
    const fetchImpl = vi.fn();
    env.current = { TRANSCRIPTION_PROVIDER: "none", OPENAI_API_KEY: "sk-test" };
    expect(transcriptionConfigured()).toBe(false);
    await expect(transcribeAudio(audio, { fetchImpl })).rejects.toMatchObject({ code: "TRANSCRIPTION_NOT_CONFIGURED", status: 503 });
    env.current = { TRANSCRIPTION_PROVIDER: "openai", OPENAI_API_KEY: undefined };
    await expect(transcribeAudio(audio, { fetchImpl })).rejects.toMatchObject({ code: "TRANSCRIPTION_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envía multipart a /v1/audio/transcriptions en español y devuelve el texto limpio", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ text: "  Comí   arroz con pollo  " }), { status: 200 }));
    const res = await transcribeAudio(audio, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.text).toBe("Comí arroz con pollo");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const form = init.body as FormData;
    expect(form.get("language")).toBe("es");
    expect((form.get("file") as File).name).toBe("dictado.webm");
  });

  it("errores del proveedor con su código", async () => {
    const respond = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(transcribeAudio(audio, { fetchImpl: respond(401) })).rejects.toMatchObject({ code: "TRANSCRIPTION_NOT_CONFIGURED", status: 503 });
    await expect(transcribeAudio(audio, { fetchImpl: respond(429) })).rejects.toMatchObject({ code: "TRANSCRIPTION_RATE_LIMITED", status: 429 });
    await expect(transcribeAudio(audio, { fetchImpl: respond(500) })).rejects.toMatchObject({ code: "TRANSCRIPTION_FAILED", status: 502 });
    await expect(transcribeAudio(audio, { fetchImpl: respond(200, { text: "  " }) })).rejects.toMatchObject({ code: "TRANSCRIPTION_EMPTY", status: 422 });
    const offline = vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    await expect(transcribeAudio(audio, { fetchImpl: offline })).rejects.toMatchObject({ code: "TRANSCRIPTION_UNAVAILABLE", status: 503 });
  });

  it("tipos de audio aceptados", () => {
    expect(baseAudioType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(isAcceptedAudioType("audio/mp4")).toBe(true);
    expect(isAcceptedAudioType("video/mp4")).toBe(false);
  });
});
