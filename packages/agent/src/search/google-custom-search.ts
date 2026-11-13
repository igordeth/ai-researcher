import { z } from 'zod';

import { pedirJson } from './pedir-json.js';
import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

// ATENÇÃO: a Google fechou a Custom Search JSON API a novos clientes e anunciou o seu fim para
// 2027-01-01. Fica como segunda implementação do SearchProvider para quem já tem chave; o padrão
// do projeto é o Serper (SEARCH_PROVIDER=serper).
const URL_GOOGLE = 'https://www.googleapis.com/customsearch/v1';

// Só os campos que usamos (https://developers.google.com/custom-search/v1/reference/rest/v1/Search).
// Sem resultados, a API omite `items`; alguns itens vêm sem snippet.
const respostaGoogleSchema = z.object({
  items: z
    .array(z.object({ title: z.string(), link: z.string(), snippet: z.string().default('') }))
    .default([]),
});

export function makeGoogleCustomSearchProvider(apiKey: string, cx: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      const url = new URL(URL_GOOGLE);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('cx', cx);
      url.searchParams.set('q', query);

      // A chave vai na URL: pedirJson nunca a põe numa mensagem de erro. Timeout de 10 s lá.
      const corpo = await pedirJson('Google Custom Search', url);

      const resultado = respostaGoogleSchema.safeParse(corpo);
      if (!resultado.success) {
        throw new SearchProviderError(
          'Google Custom Search',
          'formato',
          'resposta fora do formato esperado',
          { cause: resultado.error },
        );
      }

      return resultado.data.items.map((item) => ({
        title: item.title,
        snippet: item.snippet,
        url: item.link,
      }));
    },
  };
}
