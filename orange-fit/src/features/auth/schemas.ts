import { z } from "zod";

/** Supabase usa bcrypt: más de 72 bytes se ignoran, así que lo limitamos para no engañar. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Escribe tu correo.")
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Ese correo no parece válido."))
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Usa al menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `Usa como máximo ${PASSWORD_MAX} caracteres.`);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Escribe tu nombre.")
  .max(80, "Usa como máximo 80 caracteres.");

export const loginSchema = z.object({
  email: emailSchema,
  // Al ingresar no se valida la longitud: una cuenta antigua podría tener otra regla.
  password: z.string().min(1, "Escribe tu contraseña."),
});
export type LoginValues = z.input<typeof loginSchema>;

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.boolean().refine((v) => v, "Debes aceptar los términos y la política de privacidad para crear tu cuenta."),
});
export type RegisterValues = z.input<typeof registerSchema>;

export const recoverSchema = z.object({ email: emailSchema });
export type RecoverValues = z.input<typeof recoverSchema>;

export const resendSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, "Repite tu nueva contraseña."),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden." });
export type NewPasswordValues = z.input<typeof newPasswordSchema>;
