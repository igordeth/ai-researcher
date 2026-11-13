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
 * O que aconteceu, para quem decide o que fazer com a falha (o retry e o circuit breaker):
 * - sem-resposta: timeout ou falha de rede; não houve resposta HTTP completa;
 * - http: o serviço respondeu com status não-2xx (ver `status`);
 * - formato: o serviço respondeu 2xx, mas com um corpo que não é o esperado;
 * - circuito-aberto: a chamada nem saiu, porque o circuit breaker está aberto.
 */
export type MotivoFalhaBusca = 'sem-resposta' | 'http' | 'formato' | 'circuito-aberto';

/**
 * Qualquer falha de um provider de busca. Um único tipo para quem chama poder tratar "a busca
 * falhou" sem conhecer cada provider, com o `motivo` para quem precisa de distinguir.
 * A mensagem nunca inclui a chave da API nem a URL (no Google Custom Search a chave vai na URL).
 */
export class SearchProviderError extends Error {
  // Estado HTTP, quando motivo é 'http'. Ausente nos outros motivos.
  readonly status?: number;

  constructor(
    readonly provider: string,
    readonly motivo: MotivoFalhaBusca,
    mensagem: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(`${provider}: ${mensagem}`, { cause: options.cause });
    this.name = 'SearchProviderError';
    this.status = options.status;
  }
}
