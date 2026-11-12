import { describe, expect, it } from 'vitest';

import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { gradePrompt } from './grade.js';

function documento(ticker: string, period: string, paragraph: string): RetrievedDoc {
  return {
    id: `${ticker}-${period}`,
    ticker,
    companyName: ticker,
    setor: 'x',
    period,
    periodEnd: '2025-09-30',
    paragraph,
    sourceUrl: 'https://dados.cvm.gov.br/',
    fetchedAt: new Date('2026-08-08T00:00:00.000Z'),
    distance: 0.1,
  };
}

describe('gradePrompt', () => {
  it('lista cada documento com ticker e período, na ordem recebida', () => {
    const prompt = gradePrompt({
      question: 'Compare Vale e Petrobras no 1T26.',
      documents: [
        documento('VALE', '1T26', 'Texto da Vale.'),
        documento('PETR', '1T26', 'Texto da Petrobras.'),
      ],
    });

    expect(prompt).toContain('- [VALE 1T26] Texto da Vale.\n- [PETR 1T26] Texto da Petrobras.');
    expect(prompt).toContain('Pergunta: Compare Vale e Petrobras no 1T26.');
  });

  it('avisa quando não há nenhum documento, em vez de mandar um contexto vazio', () => {
    expect(gradePrompt({ question: 'x', documents: [] })).toContain(
      '(nenhum documento encontrado)',
    );
  });

  it('carrega a regra de que pergunta qualitativa é sempre insuficiente', () => {
    const prompt = gradePrompt({ question: 'x', documents: [] });

    expect(prompt).toContain('considere insuficiente nesses casos');
    expect(prompt).toContain('mesmo que o contexto tenha dados da empresa certa');
    for (const termo of ['motivo', 'notícia', 'fato relevante', 'guidance', 'previsão de preço']) {
      expect(prompt).toContain(termo);
    }
  });

  it('é determinístico: mesma entrada, mesmo prompt', () => {
    const entrada = { question: 'x', documents: [documento('VALE', '3T25', 'Texto.')] };

    expect(gradePrompt(entrada)).toBe(gradePrompt(entrada));
  });
});
