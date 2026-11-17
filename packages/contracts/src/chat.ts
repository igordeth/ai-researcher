import { z } from 'zod';

// Limite de tamanho: a pergunta vai para o embedding, para a busca na web e para dois prompts. Um
// texto enorme só aumenta o custo, e nenhuma pergunta sobre indicadores precisa de tanto.
export const QUESTION_MAX_LENGTH = 1000;

export const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(QUESTION_MAX_LENGTH),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Um documento recuperado como o cliente o vê: quem é e quão perto ficou, sem o texto inteiro. */
export const documentoResumidoSchema = z.discriminatedUnion('origem', [
  z.object({
    origem: z.literal('cvm'),
    ticker: z.string(),
    companyName: z.string(),
    period: z.string(),
    distance: z.number(),
  }),
  z.object({
    origem: z.literal('web'),
    title: z.string(),
    sourceUrl: z.string(),
    distance: z.number(),
  }),
]);

export type DocumentoResumido = z.infer<typeof documentoResumidoSchema>;

/**
 * Os eventos SSE de /api/chat, um por nó do grafo concluído, mais o erro. O campo `type` diz qual
 * é, para o cliente fazer um switch. A API escreve-os e o frontend valida cada um ao lê-lo.
 */
export const chatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('retrieve'), documents: z.array(documentoResumidoSchema) }),
  z.object({
    type: z.literal('grade'),
    sufficient: z.boolean(),
    missingAspects: z.array(z.string()),
    // O total de rodadas até aqui, e não o incremento do nó: é o que o cliente mostra.
    iterations: z.number().int().min(1),
  }),
  z.object({ type: z.literal('webSearch') }),
  z.object({ type: z.literal('answer'), answer: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;
