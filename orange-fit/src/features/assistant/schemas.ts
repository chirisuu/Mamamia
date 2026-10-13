import { z } from "zod";

export const MAX_CHAT_MESSAGE_CHARS = 2000;

export const chatRequestSchema = z.object({
  conversationId: z.uuid().nullish(),
  message: z
    .string()
    .trim()
    .min(1, "Escribe tu pregunta.")
    .max(MAX_CHAT_MESSAGE_CHARS, `Máximo ${MAX_CHAT_MESSAGE_CHARS} caracteres por mensaje.`),
});
export type ChatRequestInput = z.input<typeof chatRequestSchema>;

export const conversationIdSchema = z.object({ conversationId: z.uuid() });

export type AssistantMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  flagged: boolean;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
