import { describe, expect, it, vi } from 'vitest';

import { AVISO_GUARDRAIL } from '../answer/format-resposta.js';
import type { DocumentoCvm, DocumentoWeb } from '../db/retrieve-similar.js';
import { answerPrompt } from '../prompts/answer.js';
import { makeAnswerNode } from './answer.js';

const documentoCvm: DocumentoCvm = {
  origem: 'cvm',
  id: '1',
  ticker: 'VALE3',
  companyName: 'Vale S.A.',
  setor: 'Extração Mineral',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  fetchedAt: new Date('2026-08-08T00:00:00.000Z'),
  distance: 0.1,
};

const documentoWeb: DocumentoWeb = {
  origem: 'web',
  id: '2',
  title: 'Vale tem queda no minério',
  paragraph: 'O preço do minério de ferro caiu no trimestre.',
  sourceUrl: 'https://noticias.com/vale',
  fetchedAt: new Date('2026-11-12T00:00:00.000Z'),
  distance: 0.2,
};

/** LLM fake: devolve sempre o mesmo texto e guarda os prompts que recebeu. */
function fakeLlm(texto: string) {
  const invoke = vi.fn().mockResolvedValue({ text: texto });
  return { llm: { invoke }, invoke };
}

describe('makeAnswerNode', () => {
  it('devolve a resposta do modelo com a citação, seguida do bloco de fontes', async () => {
    const { llm } = fakeLlm(
      'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25].',
    );

    const { finalAnswer } = await makeAnswerNode(llm)({
      question: 'Qual a receita da Vale no 3T25?',
      documents: [documentoCvm, documentoWeb],
      sufficient: true,
    });

    expect(finalAnswer).toBe(
      [
        'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25].',
        '',
        'Fontes:',
        '- [VALE3 3T25] Vale S.A., data-base 30/09/2025 (CVM)',
        '- [web: Vale tem queda no minério] https://noticias.com/vale',
      ].join('\n'),
    );
  });

  it('troca a resposta inteira pelo aviso quando o modelo tenta recomendar, e mantém as fontes', async () => {
    const { llm } = fakeLlm(
      'A receita foi de R$ 56,7 bilhões [VALE3 3T25]. Com esse resultado, recomendo a compra de VALE3.',
    );

    const { finalAnswer } = await makeAnswerNode(llm)({
      question: 'Devo comprar VALE3?',
      documents: [documentoCvm],
      sufficient: true,
    });

    expect(finalAnswer).toBe(
      `${AVISO_GUARDRAIL}\n\nFontes:\n- [VALE3 3T25] Vale S.A., data-base 30/09/2025 (CVM)`,
    );
    expect(finalAnswer).not.toContain('recomendo');
  });

  it('manda ao modelo o prompt montado com a pergunta e o contexto', async () => {
    const { llm, invoke } = fakeLlm('ok');

    await makeAnswerNode(llm)({
      question: 'Qual a receita da Vale?',
      documents: [documentoCvm],
      sufficient: true,
    });

    const prompt = invoke.mock.calls[0][0] as string;
    expect(prompt).toContain('Pergunta: Qual a receita da Vale?');
    expect(prompt).toContain(`- [VALE3 3T25] ${documentoCvm.paragraph}`);
  });

  it('lança erro quando o modelo devolve texto vazio', async () => {
    const { llm } = fakeLlm('   ');

    await expect(
      makeAnswerNode(llm)({ question: 'q', documents: [documentoCvm], sufficient: true }),
    ).rejects.toThrow('resposta vazia');
  });
});

describe('answerPrompt', () => {
  const base = { question: 'Devo comprar VALE3?', documents: [documentoCvm] };

  it('instrui a nunca recomendar, mesmo quando a pergunta pede diretamente', () => {
    const prompt = answerPrompt({ ...base, sufficient: true });

    expect(prompt).toContain('Nunca recomende comprar, vender ou manter um ativo');
    expect(prompt).toContain('mesmo que a\n  pergunta peça isso diretamente');
  });

  it('instrui a responder só com o contexto, sem inventar números, citando o rótulo', () => {
    const prompt = answerPrompt({ ...base, sufficient: true });

    expect(prompt).toContain('Responda só com base no contexto. Não invente números');
    expect(prompt).toContain('[VALE3 3T25]');
  });

  it('pede o aviso de contexto incompleto só quando o grade considerou insuficiente', () => {
    expect(answerPrompt({ ...base, sufficient: false })).toContain(
      'O contexto foi considerado incompleto',
    );
    expect(answerPrompt({ ...base, sufficient: true })).not.toContain('incompleto');
  });
});
