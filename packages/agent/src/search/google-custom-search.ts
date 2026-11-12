import { z } from 'zod';

import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

// ATENÇÃO: a Google fechou a Custom Search JSON API a novos clientes e anunciou o seu fim para
// 2027-01-01. Fica como segunda implementação do SearchProvider para quem já tem chave; o padrão
// do projeto é o Serper (SEARCH_PROVIDER=serper).
const URL_GOOGLE = 'https://www.googleapis.com/customsearch/v1';
// Sem timeout, um provider lento penduraria a pergunta inteira em vez de falhar.
const TIMEOUT_MS = 10_000;

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

      // A chave vai na URL: por isso nenhuma mensagem de erro abaixo inclui `url`.
      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (erro) {
        throw new SearchProviderError(
          'Google Custom Search',
          'sem resposta (timeout ou rede)',
          undefined,
          { cause: erro },
        );
      }

      if (!response.ok) {
        throw new SearchProviderError(
          'Google Custom Search',
          `respondeu ${response.status}`,
          response.status,
        );
      }

      const resultado = respostaGoogleSchema.safeParse(await response.json());
      if (!resultado.success) {
        throw new SearchProviderError(
          'Google Custom Search',
          'resposta fora do formato esperado',
          undefined,
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
