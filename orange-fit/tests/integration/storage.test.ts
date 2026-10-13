import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

// JPEG mínimo (cabecera SOI/EOI): basta para probar permisos, no es una foto real.
const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

describe("storage: fotos privadas por carpeta {user_id}/", () => {
  const admin = serviceClient();
  let a: TestUser;
  let b: TestUser;
  let staff: TestUser;
  let pathA: string;
  const cleanup: Array<{ bucket: string; path: string }> = [];

  beforeAll(async () => {
    a = await createTestUser("storage-a");
    b = await createTestUser("storage-b");
    staff = await createTestUser("storage-staff", ["editor"]);
    pathA = `${a.id}/x.jpg`;
  });

  afterAll(async () => {
    for (const { bucket, path } of cleanup) {
      await admin.storage.from(bucket).remove([path]);
    }
    await deleteTestUsers([a, b, staff]);
  });

  it("A sube a progress-photos/{A}/x.jpg y puede leerla", async () => {
    const up = await a.client.storage.from("progress-photos").upload(pathA, tinyJpeg, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    cleanup.push({ bucket: "progress-photos", path: pathA });

    const down = await a.client.storage.from("progress-photos").download(pathA);
    expect(down.error).toBeNull();
    expect(down.data?.size).toBe(tinyJpeg.byteLength);

    const signed = await a.client.storage.from("progress-photos").createSignedUrl(pathA, 60);
    expect(signed.error).toBeNull();
  });

  it("B no puede leer la foto de A ni listar su carpeta", async () => {
    const down = await b.client.storage.from("progress-photos").download(pathA);
    expect(down.data).toBeNull();
    expect(down.error).not.toBeNull();

    const signed = await b.client.storage.from("progress-photos").createSignedUrl(pathA, 60);
    expect(signed.data).toBeNull();
    expect(signed.error).not.toBeNull();

    const list = await b.client.storage.from("progress-photos").list(a.id);
    expect(list.data ?? []).toEqual([]);
  });

  it("anon no puede leer fotos privadas", async () => {
    const down = await anonClient().storage.from("progress-photos").download(pathA);
    expect(down.error).not.toBeNull();
  });

  it("B no puede subir ni sobrescribir en la carpeta de A", async () => {
    const intrude = await b.client.storage
      .from("progress-photos")
      .upload(`${a.id}/y.jpg`, tinyJpeg, { contentType: "image/jpeg" });
    expect(intrude.error?.message).toMatch(/row-level security/i);

    const overwrite = await b.client.storage
      .from("progress-photos")
      .upload(pathA, tinyJpeg, { contentType: "image/jpeg", upsert: true });
    expect(overwrite.error?.message).toMatch(/row-level security/i);

    const remove = await b.client.storage.from("progress-photos").remove([pathA]);
    expect(remove.data ?? []).toEqual([]);
    const still = await a.client.storage.from("progress-photos").download(pathA);
    expect(still.error).toBeNull();
  });

  it("B sí puede subir a su propia carpeta de meal-photos", async () => {
    const path = `${b.id}/almuerzo.jpg`;
    const up = await b.client.storage.from("meal-photos").upload(path, tinyJpeg, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    cleanup.push({ bucket: "meal-photos", path });
  });

  it("los buckets de fotos solo aceptan imágenes", async () => {
    const up = await a.client.storage
      .from("progress-photos")
      .upload(`${a.id}/nota.txt`, new TextEncoder().encode("hola"), { contentType: "text/plain" });
    expect(up.error?.message).toMatch(/mime type/i);
  });

  it("recipe-images: el staff escribe en cualquier carpeta; un usuario solo en la suya", async () => {
    const staffPath = `oficiales/${staff.id}-portada.jpg`;
    const staffUp = await staff.client.storage
      .from("recipe-images")
      .upload(staffPath, tinyJpeg, { contentType: "image/jpeg" });
    expect(staffUp.error).toBeNull();
    cleanup.push({ bucket: "recipe-images", path: staffPath });

    const userOther = await a.client.storage
      .from("recipe-images")
      .upload(`oficiales/${a.id}-intruso.jpg`, tinyJpeg, { contentType: "image/jpeg" });
    expect(userOther.error?.message).toMatch(/row-level security/i);

    const userOwnPath = `${a.id}/mi-receta.jpg`;
    const userOwn = await a.client.storage
      .from("recipe-images")
      .upload(userOwnPath, tinyJpeg, { contentType: "image/jpeg" });
    expect(userOwn.error).toBeNull();
    cleanup.push({ bucket: "recipe-images", path: userOwnPath });

    // Bucket público: anon lo descarga.
    const publicDown = await anonClient().storage.from("recipe-images").download(staffPath);
    expect(publicDown.error).toBeNull();
  });
});
