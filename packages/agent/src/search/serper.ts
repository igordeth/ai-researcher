import { z } from 'zod';

import { pedirJson } from './pedir-json.js';
import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

const URL_SERPER = 'https://google.serper.dev/search';

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
      // Com timeout de 10 s: ver pedir-json.ts.
      const corpo = await pedirJson('Serper', URL_SERPER, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });

      const resultado = respostaSerperSchema.safeParse(corpo);
      if (!resultado.success) {
        throw new SearchProviderError('Serper', 'formato', 'resposta fora do formato esperado', {
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
