import { criarBuscarDemo } from './demo/buscar-demo.js';
import { criarAnswerLlmDemo, criarGradeLlmDemo } from './demo/llm-demo.js';
import { modoDemoAtivo } from './demo/modo-demo.js';
import { buildGraph } from './graph.js';
import { criarAnswerLlm, criarGradeLlm } from './llm/clientes.js';
import { criarSearchProvider } from './search/index.js';
import { criarEmbeddings } from './seed/embeddings.js';
import { criarBuscarPagina } from './web/index.js';

export type ResearchGraph = ReturnType<typeof buildGraph>;

/**
 * Guarda a Promise da primeira chamada e devolve-a às seguintes: o valor é construído uma vez por
 * processo, e chamadas que chegam ao mesmo tempo esperam a mesma construção em vez de começarem
 * outra. Se a construção falhar, a memória é apagada, para a chamada seguinte tentar de novo em vez
 * de receber o mesmo erro para sempre.
 */
export function memoizarPromessa<T>(construir: () => Promise<T>): () => Promise<T> {
  let emConstrucao: Promise<T> | undefined;

  return () => {
    emConstrucao ??= construir().catch((erro: unknown) => {
      emConstrucao = undefined;
      throw erro;
    });
    return emConstrucao;
  };
}

/**
 * O grafo do modo DEMO: o mesmo buildGraph, com fixtures no lugar de cada dependência externa.
 * Sem Postgres, sem Vertex AI e sem busca na web: não exige DATABASE_URL nem MODEL_*, e responde
 * sempre a RESPOSTA_DEMO sobre a Vale 3T25. O grade é sempre suficiente, por isso o caminho é
 * retrieve → grade → answer, e o webSearch nunca corre.
 */
function montarGrafoDemo(): ResearchGraph {
  return buildGraph({
    embeddings: criarEmbeddings(),
    buscar: criarBuscarDemo(),
    gradeLlm: criarGradeLlmDemo(),
    answerLlm: criarAnswerLlmDemo(),
    searchProvider: criarSearchProvider(),
    buscarPagina: criarBuscarPagina(),
    // Nada é gravado: no demo os vetores são zeros, e uma página gravada com eles na
    // documentos_web estragaria as buscas reais seguintes.
    gravarPagina: async () => undefined,
  });
}

/**
 * Monta o grafo com as dependências reais: Postgres, Vertex AI (embeddings, grade e answer) e a
 * busca na web (Serper). Cada cliente vem da sua fábrica, que lê a própria variável de ambiente e
 * falha com mensagem clara se ela faltar. Com DEMO=true, monta o grafo do demo.
 */
async function montarGrafoReal(): Promise<ResearchGraph> {
  if (modoDemoAtivo()) return montarGrafoDemo();

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida. Ver .env.example.');

  const embeddings = criarEmbeddings();
  const gradeLlm = criarGradeLlm();
  const answerLlm = criarAnswerLlm();
  const searchProvider = criarSearchProvider();
  const buscarPagina = criarBuscarPagina();

  // Import dinâmico: importar o client.ts cria o pool de conexões. Assim o pool só nasce aqui, na
  // primeira pergunta, e não quando um processo importa o @hero/agent.
  const [{ db }, { buscarDocumentosSimilares }, { substituirPaginaWeb }] = await Promise.all([
    import('./db/client.js'),
    import('./db/retrieve-similar.js'),
    import('./db/replace-web-page.js'),
  ]);

  return buildGraph({
    embeddings,
    buscar: (embedding, k) => buscarDocumentosSimilares(db, embedding, k),
    gradeLlm,
    answerLlm,
    searchProvider,
    buscarPagina,
    gravarPagina: (sourceUrl, linhas) => substituirPaginaWeb(db, sourceUrl, linhas),
  });
}

/**
 * O grafo real, construído na primeira chamada e reaproveitado depois. Nada é criado quando o
 * módulo é importado: um servidor sobe sem tocar a base nem a Vertex AI, e uma variável em falta só
 * aparece como erro na primeira pergunta. O mesmo grafo serve a todas as perguntas do processo,
 * com um só pool de conexões e um só circuit breaker da busca.
 */
export const obterGrafoReal = memoizarPromessa(montarGrafoReal);
