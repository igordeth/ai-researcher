export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// O contrato que o nó webSearch conhece. Serper e Google Custom Search são duas implementações
// trocáveis por variável de ambiente (SEARCH_PROVIDER), sem o nó saber qual está ativa.
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

/**
 * Qualquer falha de um provider de busca: HTTP não-2xx, timeout, falha de rede ou resposta fora do
 * formato. Um único tipo para quem chama poder tratar "a busca falhou" sem conhecer cada provider.
 * A mensagem nunca inclui a chave da API nem a URL (no Google Custom Search a chave vai na URL).
 */
export class SearchProviderError extends Error {
  constructor(
    readonly provider: string,
    mensagem: string,
    // Estado HTTP, quando a falha veio de uma resposta. Ausente em timeout e falha de rede.
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(`${provider}: ${mensagem}`, options);
    this.name = 'SearchProviderError';
  }
}
