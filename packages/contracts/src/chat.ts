import { z } from 'zod';

// Limite de tamanho: a pergunta vai para o embedding, para a busca na web e para dois prompts. Um
// texto enorme só aumenta o custo, e nenhuma pergunta sobre indicadores precisa de tanto.
export const QUESTION_MAX_LENGTH = 1000;

export const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(QUESTION_MAX_LENGTH),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
