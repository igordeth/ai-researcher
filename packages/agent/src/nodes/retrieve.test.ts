import { describe, expect, it, vi } from 'vitest';

import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { makeRetrieveNode } from './retrieve.js';

const documentoFake: RetrievedDoc = {
  id: '1',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  setor: 'Extração Mineral',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
  distance: 0.11,
};

describe('makeRetrieveNode', () => {
  it('gera o embedding da pergunta e devolve o que a busca encontrou, com top-k 5 por padrão', async () => {
    const embeddings = { embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]) };
    const buscar = vi.fn().mockResolvedValue([documentoFake]);

    const retrieve = makeRetrieveNode({ embeddings, buscar });
    const resultado = await retrieve({ question: 'Qual a receita da Vale no 3T25?' });

    expect(embeddings.embedQuery).toHaveBeenCalledWith('Qual a receita da Vale no 3T25?');
    expect(buscar).toHaveBeenCalledWith([0.1, 0.2], 5);
    expect(resultado).toEqual({ documents: [documentoFake] });
  });

  it('respeita o top-k configurado na factory', async () => {
    const embeddings = { embedQuery: vi.fn().mockResolvedValue([0.1]) };
    const buscar = vi.fn().mockResolvedValue([]);

    const retrieve = makeRetrieveNode({ embeddings, buscar, topK: 10 });
    await retrieve({ question: 'x' });

    expect(buscar).toHaveBeenCalledWith([0.1], 10);
  });

  it('devolve lista vazia quando a busca não encontra nada, sem lançar erro', async () => {
    const retrieve = makeRetrieveNode({
      embeddings: { embedQuery: async () => [0.1] },
      buscar: async () => [],
    });

    expect(await retrieve({ question: 'x' })).toEqual({ documents: [] });
  });
});
