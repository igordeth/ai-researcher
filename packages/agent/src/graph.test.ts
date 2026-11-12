import { describe, expect, it, vi } from 'vitest';

import type { LinhaDocumentoWeb } from './db/replace-web-page.js';
import type { DocumentoCvm, DocumentoWeb, RetrievedDoc } from './db/retrieve-similar.js';
import { buildGraph, MAX_ITERATIONS, type GraphDeps } from './graph.js';

const documentoCvm: DocumentoCvm = {
  origem: 'cvm',
  id: '1',
  ticker: 'VALE3',
  companyName: 'Vale S.A.',
  setor: 'Extração Mineral',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/exemplo.zip',
  fetchedAt: new Date('2026-08-08T00:00:00.000Z'),
  distance: 0.1,
};

const SUFICIENTE = { sufficient: true, missingAspects: [] };
const INSUFICIENTE = { sufficient: false, missingAspects: ['motivo da queda'] };

/**
 * Dependências fake do grafo inteiro. A base é um array em memória: o webSearch grava nele e o
 * retrieve lê dele, como as duas tabelas reais. `respostasDoGrade` é a sequência que o LLM fake
 * devolve, uma por chamada; a última repete-se se o grafo pedir mais.
 */
function depsFake(respostasDoGrade: { sufficient: boolean; missingAspects: string[] }[]) {
  const gravados: DocumentoWeb[] = [];

  const gradeInvoke = vi.fn();
  for (const resposta of respostasDoGrade) gradeInvoke.mockResolvedValueOnce(resposta);
  gradeInvoke.mockResolvedValue(respostasDoGrade.at(-1));

  const deps: GraphDeps = {
    embeddings: {
      embedQuery: async () => [0.1, 0.2],
      embedDocuments: async (textos) => textos.map(() => [0.1, 0.2]),
    },
    buscar: async (): Promise<RetrievedDoc[]> => [documentoCvm, ...gravados],
    gradeLlm: { withStructuredOutput: () => ({ invoke: gradeInvoke }) },
    searchProvider: {
      search: vi.fn(async () => [
        { title: 'Notícia', snippet: '', url: 'https://noticias.com/vale' },
      ]),
    },
    buscarPagina: async (url) => ({ html: '<p>A receita caiu pelo minério.</p>', urlFinal: url }),
    gravarPagina: async (_url: string, linhas: LinhaDocumentoWeb[]) => {
      for (const linha of linhas) {
        gravados.push({
          origem: 'web',
          id: `${linha.sourceUrl}#${linha.chunkIndex}`,
          title: linha.title,
          paragraph: linha.content,
          sourceUrl: linha.sourceUrl,
          fetchedAt: linha.fetchedAt,
          distance: 0.2,
        });
      }
    },
  };

  return { deps, gradeInvoke };
}

/**
 * Corre o grafo com `stream` e devolve os nós pela ordem em que correram. Em streamMode
 * 'updates', cada evento é `{ nomeDoNó: o que o nó devolveu }`.
 */
async function nosVisitados(deps: GraphDeps): Promise<string[]> {
  const app = buildGraph(deps);
  const nos: string[] = [];

  const eventos = await app.stream(
    { question: 'Por que a receita da Vale caiu no 3T25?' },
    { streamMode: 'updates' },
  );
  for await (const evento of eventos) {
    nos.push(...Object.keys(evento));
  }

  return nos;
}

describe('buildGraph', () => {
  it('vai direto ao fim quando o grade considera suficiente na primeira rodada', async () => {
    const { deps, gradeInvoke } = depsFake([SUFICIENTE]);

    expect(await nosVisitados(deps)).toEqual(['retrieve', 'grade']);
    expect(gradeInvoke).toHaveBeenCalledTimes(1);
    expect(deps.searchProvider.search).not.toHaveBeenCalled();
  });

  it('faz o laço completo quando insuficiente, e o retrieve da volta encontra o que veio da web', async () => {
    const { deps, gradeInvoke } = depsFake([INSUFICIENTE, SUFICIENTE]);

    expect(await nosVisitados(deps)).toEqual([
      'retrieve',
      'grade',
      'webSearch',
      'retrieve',
      'grade',
    ]);
    // O webSearch pesquisou o aspecto que o grade apontou em falta.
    expect(deps.searchProvider.search).toHaveBeenCalledWith(
      'Por que a receita da Vale caiu no 3T25? motivo da queda',
    );
    // O segundo grade já viu o chunk gravado pelo webSearch: o laço passa pela base, não pelo estado.
    const promptDaSegundaRodada = gradeInvoke.mock.calls[1][0] as string;
    expect(promptDaSegundaRodada).toContain('[web: Notícia]');
  });

  it('o guard corta em MAX_ITERATIONS rodadas de grade mesmo com o LLM sempre insuficiente', async () => {
    const { deps, gradeInvoke } = depsFake([INSUFICIENTE]);

    const nos = await nosVisitados(deps);

    expect(nos.filter((no) => no === 'grade')).toHaveLength(MAX_ITERATIONS);
    expect(gradeInvoke).toHaveBeenCalledTimes(MAX_ITERATIONS);
    // Termina no grade, sem uma ida à web a mais depois da última avaliação.
    expect(nos.at(-1)).toBe('grade');
    expect(nos.filter((no) => no === 'webSearch')).toHaveLength(MAX_ITERATIONS - 1);
  });

  it('soma iterations pelo reducer: o estado final conta as rodadas de grade', async () => {
    const { deps } = depsFake([INSUFICIENTE]);

    const estadoFinal = await buildGraph(deps).invoke({ question: 'Por que a receita caiu?' });

    expect(estadoFinal.iterations).toBe(MAX_ITERATIONS);
    expect(estadoFinal.sufficient).toBe(false);
    expect(estadoFinal.missingAspects).toEqual(['motivo da queda']);
  });
});
