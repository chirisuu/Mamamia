/**
 * Cámara y detectores de códigos de barras en el navegador: clasificación de errores con mensajes
 * en español y elección del detector nativo (BarcodeDetector). Puro y probado.
 */

export type CameraProblem = "denied" | "no_camera" | "in_use" | "unsupported" | "decoder" | "unknown";

export const CAMERA_PROBLEMS: Record<CameraProblem, { title: string; body: string; canRetry: boolean }> = {
  denied: {
    title: "No tenemos permiso para usar la cámara",
    body: "Actívalo en tu navegador (ícono del candado junto a la dirección → Cámara → Permitir) y vuelve a intentarlo. También puedes escribir los números del código.",
    canRetry: true,
  },
  no_camera: {
    title: "No encontramos una cámara",
    body: "Este dispositivo no tiene una cámara disponible. Escribe los números que aparecen debajo de las barras.",
    canRetry: false,
  },
  in_use: {
    title: "La cámara está ocupada",
    body: "Otra app o pestaña la está usando. Ciérrala y vuelve a intentarlo, o escribe el código.",
    canRetry: true,
  },
  unsupported: {
    title: "Tu navegador no permite usar la cámara aquí",
    body: "Necesitas un navegador actualizado y una conexión segura (https). Mientras tanto, escribe el código.",
    canRetry: false,
  },
  decoder: {
    title: "No pudimos iniciar el lector de códigos",
    body: "Vuelve a intentarlo o escribe los números del código.",
    canRetry: true,
  },
  unknown: {
    title: "No pudimos abrir la cámara",
    body: "Vuelve a intentarlo o escribe los números del código.",
    canRetry: true,
  },
};

/** Traduce el error de getUserMedia (DOMException por nombre) a un problema conocido. */
export function classifyCameraError(error: unknown): CameraProblem {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "no_camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in_use";
    case "TypeError":
      return "unsupported";
    default:
      return "unknown";
  }
}

/** Formatos de producto que buscamos (nombres de la API BarcodeDetector). */
export const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/** Formatos que el detector nativo soporta de los que necesitamos (vacío = usar ZXing). */
export function pickNativeFormats(supported: readonly string[]): string[] {
  return NATIVE_FORMATS.filter((f) => supported.includes(f));
}

/** Restricciones de video: cámara trasera, resolución suficiente para leer barras finas. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};
