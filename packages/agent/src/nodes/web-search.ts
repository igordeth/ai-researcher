import type { LinhaDocumentoWeb } from '../db/replace-web-page.js';
import { SearchProviderError, type SearchProvider, type SearchResult } from '../search/types.js';
import { dividirEmChunks } from '../web/chunk.js';
import { extrairTexto } from '../web/extract.js';
import type { PaginaBuscada } from '../web/fetch-page.js';

const RESULTADOS_POR_QUERY = 3;
const TTL_PADRAO_DIAS = 7;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** A parte do estado do grafo que este nó lê. */
export interface WebSearchState {
  question: string;
  missingAspects: string[];
}

// Só a operação de que o nó precisa: todos os chunks de uma página num lote. O VertexAIEmbeddings
// real tem este método e se encaixa sem adaptação.
export interface EmbeddingsEmLote {
  embedDocuments(textos: string[]): Promise<number[][]>;
}

export type BuscarPagina = (url: string) => Promise<PaginaBuscada>;
export type GravarPagina = (sourceUrl: string, linhas: LinhaDocumentoWeb[]) => Promise<void>;

export interface WebSearchDeps {
  searchProvider: SearchProvider;
  embeddings: EmbeddingsEmLote;
  buscarPagina: BuscarPagina;
  gravarPagina: GravarPagina;
  ttlDias?: number;
  // Injetável para o teste conferir fetchedAt e expiresAt sem depender do relógio real.
  agora?: () => Date;
}

/** Uma query por aspecto em falta; sem aspectos, a própria pergunta. */
export function montarQueries({ question, missingAspects }: WebSearchState): string[] {
  if (missingAspects.length === 0) return [question];
  return missingAspects.map((aspecto) => `${question} ${aspecto}`);
}

/**
 * Nó `webSearch`: procura na web o que faltou, e grava as páginas como chunks com embedding na
 * tabela documentos_web. Não devolve nada para o estado: o efeito é a escrita na base, e o
 * `retrieve`, na volta seguinte do laço, encontra os chunks pela mesma busca por similaridade.
 *
 * Página que falhe (fora do ar, timeout, não-HTML, sem texto) fica de fora, e as outras seguem.
 * Query cuja busca falhe (provider fora do ar, circuito aberto) também fica de fora. Se nenhuma
 * render nada, o nó não grava nada: o retrieve volta com o que já havia, o guard de iteração corta
 * o laço, e o answer responde com o corpus, avisando que o contexto pode estar incompleto.
 */
export function makeWebSearchNode({
  searchProvider,
  embeddings,
  buscarPagina,
  gravarPagina,
  ttlDias = TTL_PADRAO_DIAS,
  agora = () => new Date(),
}: WebSearchDeps) {
  async function processarPagina(
    query: string,
    resultado: SearchResult,
    urlsVistos: Set<string>,
  ): Promise<void> {
    const { html, urlFinal } = await buscarPagina(resultado.url);

    // A página é identificada pelo URL final, depois dos redirecionamentos. Dois resultados com
    // URLs diferentes que levam à mesma página só são gravados uma vez. A verificação e o add
    // acontecem sem await no meio, por isso duas páginas em paralelo não passam as duas.
    if (urlFinal !== resultado.url && urlsVistos.has(urlFinal)) return;
    urlsVistos.add(urlFinal);

    const chunks = dividirEmChunks(extrairTexto(html));
    if (chunks.length === 0) return;

    const vetores = await embeddings.embedDocuments(chunks);
    const fetchedAt = agora();
    const expiresAt = new Date(fetchedAt.getTime() + ttlDias * MS_POR_DIA);

    await gravarPagina(
      urlFinal,
      chunks.map((content, chunkIndex) => ({
        query,
        title: resultado.title,
        content,
        sourceUrl: urlFinal,
        chunkIndex,
        fetchedAt,
        expiresAt,
        embedding: vetores[chunkIndex],
      })),
    );
  }

  return async function webSearch(state: WebSearchState): Promise<Record<string, never>> {
    // Queries diferentes trazem muitas vezes a mesma página: cada URL é processado uma vez.
    const urlsVistos = new Set<string>();

    for (const query of montarQueries(state)) {
      let encontrados: SearchResult[];
      try {
        encontrados = await searchProvider.search(query);
      } catch (erro) {
        // A busca na web é enriquecimento: sem ela, a resposta sai só do corpus da CVM. Só a falha
        // da busca é absorvida (SearchProviderError); outro erro é bug e continua a propagar.
        if (erro instanceof SearchProviderError) continue;
        throw erro;
      }

      const resultados = encontrados
        .slice(0, RESULTADOS_POR_QUERY)
        .filter((resultado) => !urlsVistos.has(resultado.url));
      for (const resultado of resultados) urlsVistos.add(resultado.url);

      // allSettled, e não all: uma página que falhe não cancela as outras nem derruba o nó.
      await Promise.allSettled(
        resultados.map((resultado) => processarPagina(query, resultado, urlsVistos)),
      );
    }

    return {};
  };
}
