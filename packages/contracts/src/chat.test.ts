import { describe, expect, it } from 'vitest';
import { chatEventSchema, chatRequestSchema, QUESTION_MAX_LENGTH } from './chat.js';

describe('chatRequestSchema', () => {
  it('aceita uma pergunta e tira os espaços das pontas', () => {
    expect(chatRequestSchema.parse({ question: '  Qual a receita da Vale?  ' })).toEqual({
      question: 'Qual a receita da Vale?',
    });
  });

  it('rejeita pergunta vazia ou só com espaços', () => {
    expect(chatRequestSchema.safeParse({ question: '   ' }).success).toBe(false);
  });

  it('rejeita pergunta ausente ou de outro tipo', () => {
    expect(chatRequestSchema.safeParse({}).success).toBe(false);
    expect(chatRequestSchema.safeParse({ question: 42 }).success).toBe(false);
  });

  it('rejeita pergunta acima do limite de tamanho', () => {
    const longa = 'a'.repeat(QUESTION_MAX_LENGTH + 1);
    expect(chatRequestSchema.safeParse({ question: longa }).success).toBe(false);
  });
});

describe('chatEventSchema', () => {
  it('aceita cada evento que a API escreve', () => {
    const eventos = [
      {
        type: 'retrieve',
        documents: [
          {
            origem: 'cvm',
            ticker: 'VALE3',
            companyName: 'Vale S.A.',
            period: '3T25',
            distance: 0.1,
          },
          {
            origem: 'web',
            title: 'Notícia',
            sourceUrl: 'https://noticias.com/vale',
            distance: 0.2,
          },
        ],
      },
      { type: 'grade', sufficient: false, missingAspects: ['motivo da queda'], iterations: 1 },
      { type: 'webSearch' },
      { type: 'answer', answer: 'A receita foi de R$ 56,7 bilhões.' },
      { type: 'error', message: 'Não foi possível concluir a resposta. Tente novamente.' },
    ];

    for (const evento of eventos) {
      expect(chatEventSchema.parse(evento)).toEqual(evento);
    }
  });

  it('rejeita um type desconhecido', () => {
    expect(chatEventSchema.safeParse({ type: 'plan' }).success).toBe(false);
  });

  it('rejeita um evento sem os campos do seu type', () => {
    expect(chatEventSchema.safeParse({ type: 'answer' }).success).toBe(false);
    expect(chatEventSchema.safeParse({ type: 'grade', sufficient: true }).success).toBe(false);
  });

  it('rejeita um documento de origem desconhecida', () => {
    const evento = { type: 'retrieve', documents: [{ origem: 'pdf', distance: 0.1 }] };
    expect(chatEventSchema.safeParse(evento).success).toBe(false);
  });
});
