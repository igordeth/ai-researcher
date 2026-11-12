// Sem timeout, uma página lenta penduraria o nó webSearch inteiro.
const TIMEOUT_MS = 10_000;
// Uma página de notícia tem dezenas de KB. Acima disto é um ficheiro, não uma página para ler.
const LIMITE_BYTES = 2_000_000;

export interface PaginaBuscada {
  html: string;
  // O URL depois dos redirecionamentos. Pesquisas devolvem às vezes links intermediários (ex.:
  // google.com/goto?url=...) que levam à mesma página; o URL final é o que identifica a página.
  urlFinal: string;
}

/**
 * Busca o HTML de uma página. Lança erro se a página não responder a tempo, responder com erro,
 * não for HTML (PDF, imagem) ou for grande demais. Quem chama decide o que fazer com a falha: o
 * nó webSearch ignora a página e segue para as outras.
 */
export async function buscarPagina(url: string): Promise<PaginaBuscada> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}`);
  }

  const tipo = response.headers.get('content-type') ?? '';
  if (!tipo.includes('text/html') && !tipo.includes('application/xhtml+xml')) {
    throw new Error(`${url} não é HTML (content-type: "${tipo}")`);
  }

  const tamanho = Number(response.headers.get('content-length') ?? 0);
  if (tamanho > LIMITE_BYTES) {
    throw new Error(`${url} tem ${tamanho} bytes, acima do limite de ${LIMITE_BYTES}`);
  }

  // Sem content-length (resposta em streaming), o limite aplica-se depois de ler.
  const html = (await response.text()).slice(0, LIMITE_BYTES);
  // response.url vem vazio quando o Response não veio de um fetch real (ex.: num teste).
  return { html, urlFinal: response.url || url };
}
