import { describe, expect, it } from "vitest";
import { buildPhotoPath, fitWithin, isOwnPhotoPath, parsePhotoPath } from "./photo-path";

const uid = "0b6f2a5e-3c1d-4f8e-9a7b-1c2d3e4f5a6b";
const other = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("rutas de fotos de progreso", () => {
  it("arma {uid}/{fecha}-{pose}-{random}.webp y la vuelve a leer", () => {
    const path = buildPhotoPath(uid, "2026-10-13", "front", "abc123def456ghij", "webp");
    expect(path).toBe(`${uid}/2026-10-13-front-abc123def456ghij.webp`);
    expect(parsePhotoPath(path)).toEqual({
      userId: uid,
      localDate: "2026-10-13",
      pose: "front",
      ext: "webp",
      fileName: "2026-10-13-front-abc123def456ghij.webp",
    });
  });

  it("rechaza rutas ajenas, con otra fecha/pose, con ../ o formato raro", () => {
    const path = buildPhotoPath(uid, "2026-10-13", "side", "abcdefgh12345678", "webp");
    expect(isOwnPhotoPath(path, uid)).toBe(true);
    expect(isOwnPhotoPath(path, uid, "2026-10-13", "side")).toBe(true);
    expect(isOwnPhotoPath(path, other)).toBe(false);
    expect(isOwnPhotoPath(path, uid, "2026-10-12")).toBe(false);
    expect(isOwnPhotoPath(path, uid, undefined, "front")).toBe(false);
    expect(isOwnPhotoPath(`${uid}/../${other}/2026-10-13-side-abcdefgh12345678.webp`, uid)).toBe(false);
    expect(isOwnPhotoPath(`${uid}/2026-02-30-front-abcdefgh12345678.webp`, uid)).toBe(false);
    expect(isOwnPhotoPath(`${uid}/2026-10-13-front-abcdefgh12345678.png`, uid)).toBe(false);
  });

  it("fitWithin no agranda y limita el lado mayor a 1600 px", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1200, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(() => fitWithin(0, 100)).toThrow();
  });
});
