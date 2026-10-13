/**
 * Moderación previa del asistente con reglas simples (sin IA). Si un mensaje muestra señales de
 * autolesión o de trastorno de la conducta alimentaria, NO se llama al modelo: se responde con un
 * texto seguro y recursos (Perú) y el mensaje queda marcado (`flagged`). Desde ese momento la
 * conversación pasa a "modo cuidado" (sin metas de restricción). Puro y probado.
 *
 * Las reglas buscan expresiones concretas para evitar falsos positivos ("vómitos por una
 * infección" no es lo mismo que "me provoco el vómito").
 */

export type ModerationCategory = "self_harm" | "eating_disorder" | "extreme_restriction";

export type ModerationResult = { flagged: false } | { flagged: true; category: ModerationCategory; reply: string };

/** Minúsculas, sin tildes ni signos, espacios simples. */
export function normalizeForModeration(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SELF_HARM: RegExp[] = [
  /\bsuicid/,
  /\b(quitarme la vida|acabar con mi vida|terminar con mi vida)\b/,
  // "Me mato entrenando" es una expresión común: no cuenta.
  /\b(matarme|me voy a matar|me quiero matar)\b(?! (entrenando|en el (gym|gimnasio)|haciendo|trabajando|estudiando|de (risa|hambre)))/,
  /\b(no quiero (seguir )?vivir|quiero morir(me)?|me quiero morir|ganas de morir(me)?|mejor estaria muerta?)\b/,
  // "Hacerme daño" a secas suele ser una lesión deportiva: se exige la intención.
  /\b((?<!\bno )(quiero|ganas de|necesito) (hacerme dano|lastimarme)|me hago dano a proposito|lastimarme a proposito|hacerme dano a proposito)\b/,
  /\b(autolesion\w*|hacerme cortes|cortarme (los brazos|las munecas|la piel|las piernas))\b/,
];

const DAYS = "(\\d+|dos|tres|cuatro|cinco|varios|unos)";

const EATING_DISORDER: RegExp[] = [
  /\b(me|te|se) (hago|haces|hace|provoco|provocas|provoca|induzco) (el )?vomit/,
  /\b(provocar(me)?|inducir(me)?) (el )?vomit/,
  /\bvomit(ar|o|e) (despues de comer|lo que (como|comi|comere))\b/,
  /\b(meterme los dedos|purgarme|purgarse|me purgo)\b/,
  /\b(laxantes?|diureticos?) (para|y asi|asi) (bajar|adelgazar|no engordar|compensar|quemar)/,
  // "Dejar de comer pan" es un hábito; "dejar de comer" a secas o para bajar, una señal.
  new RegExp(`\\b(dejar|dejo|deje|deja) de comer(?=$| (por completo|del todo|para (bajar|adelgazar|no engordar)|${DAYS} dias|todo el dia|un tiempo|y (bajar|adelgazar)))`),
  new RegExp(`\\bno comer nada(?=$| (en todo el dia|todo el dia|durante ${DAYS} dias|${DAYS} dias|para (bajar|adelgazar)))`),
  new RegExp(`\\bno he comido( nada)? (en|desde hace) ${DAYS} dias\\b`),
  /\b(matarme de hambre|morirme de hambre para)\b/,
  /\b(me castigo|castigarme) (sin comer|con hambre|con ejercicio|dejando de comer)\b/,
  /\b(atracon(es)?|me doy atracones|me atraco)\b/,
  /\b(me da miedo comer|miedo (a|de) comer|odio comer(?=$| (porque|y|cuando)))/,
];

const EXTREME_RESTRICTION: RegExp[] = [
  new RegExp(`\\b(pasar(me)?|estar) ${DAYS} dias sin comer\\b`),
  new RegExp(`\\b(ayunar|ayuno de|ayuno por) ${DAYS} dias\\b`),
];

/**
 * Metas diarias de menos de 800 kcal ("dieta de 500 calorías", "comer 600 kcal al día"). Una
 * comida de 300 kcal no cuenta: hace falta que sea por día o que sea la meta/dieta.
 */
function mentionsVeryLowCalories(normalized: string): boolean {
  const re = /\b(\d{2,4}) ?(kcal|calorias|cal)\b/g;
  const daily = /\b(al dia|diarias?|diarios?|por dia|cada dia|a diario|todo el dia)\b/;
  const planBefore = /\b(dieta|meta|objetivo|limite|bajar a|bajarme a|reducir a|quedarme en|solo comer|comer solo)\b[^\d]{0,12}$/;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const value = Number(match[1]);
    if (value < 100 || value >= 800) continue;
    const after = normalized.slice(match.index, match.index + match[0].length + 25);
    const before = normalized.slice(Math.max(0, match.index - 30), match.index);
    if (daily.test(after) || planBefore.test(before)) return true;
  }
  return false;
}

export const SAFE_REPLIES: Record<ModerationCategory, string> = {
  self_harm: [
    "Siento mucho que estés pasando por algo tan difícil. Lo que sientes importa y no tienes que enfrentarlo sin apoyo.",
    "",
    "- Si estás en peligro ahora, llama al 106 (SAMU) o ve a la emergencia más cercana.",
    "- Puedes hablar gratis con la Línea 113, opción 5 (salud mental del MINSA).",
    "- Si puedes, cuéntale a alguien de confianza cómo te sientes.",
    "",
    "En este momento no voy a darte metas ni consejos de alimentación: lo primero es que estés bien.",
  ].join("\n"),
  eating_disorder: [
    "Gracias por contármelo. Lo que describes puede ser señal de una relación difícil con la comida, y mereces apoyo de verdad, sin culpa ni juicios.",
    "",
    "- Te recomiendo conversar con un profesional de salud (médico, psicólogo o nutricionista).",
    "- Puedes llamar gratis a la Línea 113, opción 5 (salud mental del MINSA).",
    "- Si te sientes en peligro, llama al 106 (SAMU) o acude a emergencias.",
    "",
    "No voy a darte metas de restricción ni consejos para comer menos. Si quieres, puedo ayudarte con ideas para comidas regulares y tranquilas.",
  ].join("\n"),
  extreme_restriction: [
    "No puedo ayudarte con metas de calorías tan bajas ni con ayunos de varios días: no son seguros sin supervisión médica. Tu meta diaria en la app ya respeta un mínimo seguro.",
    "",
    "Si sientes presión por bajar de peso rápido o te está costando comer, conversar con un profesional ayuda. También puedes llamar gratis a la Línea 113, opción 5 (salud mental del MINSA).",
    "",
    "Si quieres, te ayudo a armar comidas que te mantengan con energía dentro de tu meta.",
  ].join("\n"),
};

export function moderateUserMessage(text: string): ModerationResult {
  const normalized = normalizeForModeration(text);
  if (!normalized) return { flagged: false };
  if (SELF_HARM.some((re) => re.test(normalized))) return { flagged: true, category: "self_harm", reply: SAFE_REPLIES.self_harm };
  if (EATING_DISORDER.some((re) => re.test(normalized))) {
    return { flagged: true, category: "eating_disorder", reply: SAFE_REPLIES.eating_disorder };
  }
  if (EXTREME_RESTRICTION.some((re) => re.test(normalized)) || mentionsVeryLowCalories(normalized)) {
    return { flagged: true, category: "extreme_restriction", reply: SAFE_REPLIES.extreme_restriction };
  }
  return { flagged: false };
}
