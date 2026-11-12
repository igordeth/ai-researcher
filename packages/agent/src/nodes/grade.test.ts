import { describe, expect, it, vi } from 'vitest';

import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { makeGradeNode } from './grade.js';

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

/** LLM fake: devolve sempre a mesma resposta e guarda os prompts que recebeu. */
function fakeLlm(resposta: unknown) {
  const invoke = vi.fn().mockResolvedValue(resposta);
  const withStructuredOutput = vi.fn().mockReturnValue({ invoke });
  return { llm: { withStructuredOutput }, invoke, withStructuredOutput };
}

describe('makeGradeNode', () => {
  it('devolve sufficient true e lista vazia quando o LLM considera o contexto suficiente', async () => {
    const { llm } = fakeLlm({ sufficient: true, missingAspects: [] });
    const grade = makeGradeNode(llm);

    const resultado = await grade({
      question: 'Qual a receita da Vale no 3T25?',
      documents: [documentoFake],
    });

    expect(resultado).toEqual({ sufficient: true, missingAspects: [], iterations: 1 });
  });

  it('devolve sufficient false e os aspectos faltantes quando o contexto é insuficiente', async () => {
    const { llm } = fakeLlm({
      sufficient: false,
      missingAspects: ['motivo da queda da receita da Vale no 1T26'],
    });
    const grade = makeGradeNode(llm);

    const resultado = await grade({
      question: 'Por que a receita da Vale caiu no 1T26?',
      documents: [documentoFake],
    });

    expect(resultado.sufficient).toBe(false);
    expect(resultado.missingAspects).toEqual(['motivo da queda da receita da Vale no 1T26']);
  });

  it('manda ao LLM um prompt com a pergunta e o parágrafo de cada documento', async () => {
    const { llm, invoke } = fakeLlm({ sufficient: true, missingAspects: [] });
    const grade = makeGradeNode(llm);

    await grade({ question: 'Qual a receita da Vale no 3T25?', documents: [documentoFake] });

    const prompt: string = invoke.mock.calls[0][0];
    expect(prompt).toContain('Pergunta: Qual a receita da Vale no 3T25?');
    expect(prompt).toContain(`- [VALE 3T25] ${documentoFake.paragraph}`);
  });

  it('configura a saída estruturada uma vez, na factory, e não a cada pergunta', async () => {
    const { llm, withStructuredOutput } = fakeLlm({ sufficient: true, missingAspects: [] });
    const grade = makeGradeNode(llm);

    await grade({ question: 'a', documents: [] });
    await grade({ question: 'b', documents: [] });

    expect(withStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it('recusa saída do LLM fora do schema, em vez de deixar uma rota errada passar', async () => {
    const { llm } = fakeLlm({ sufficient: 'sim' });
    const grade = makeGradeNode(llm);

    await expect(grade({ question: 'x', documents: [] })).rejects.toThrow();
  });
});
