import { z } from 'zod';

import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

const URL_SERPER = 'https://google.serper.dev/search';
// Sem timeout, um provider lento penduraria a pergunta inteira em vez de falhar.
const TIMEOUT_MS = 10_000;

// Só os campos que usamos (https://serper.dev). A resposta de uma API externa é fronteira, por isso
// é validada em vez de confiada com `as`. Alguns resultados vêm sem snippet; nesse caso, vira ''.
const respostaSerperSchema = z.object({
  organic: z
    .array(z.object({ title: z.string(), link: z.string(), snippet: z.string().default('') }))
    .default([]),
});

export function makeSerperProvider(apiKey: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      let response: Response;
      try {
        response = await fetch(URL_SERPER, {
          method: 'POST',
          headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (erro) {
        // Timeout (AbortSignal) ou falha de rede: não houve resposta HTTP.
        throw new SearchProviderError('Serper', 'sem resposta (timeout ou rede)', undefined, {
          cause: erro,
        });
      }

      if (!response.ok) {
        throw new SearchProviderError('Serper', `respondeu ${response.status}`, response.status);
      }

      const resultado = respostaSerperSchema.safeParse(await response.json());
      if (!resultado.success) {
        throw new SearchProviderError('Serper', 'resposta fora do formato esperado', undefined, {
          cause: resultado.error,
        });
      }

      return resultado.data.organic.map((item) => ({
        title: item.title,
        snippet: item.snippet,
        url: item.link,
      }));
    },
  };
}
