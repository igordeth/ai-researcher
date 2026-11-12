import { describe, expect, it } from 'vitest';
import { chatRequestSchema, QUESTION_MAX_LENGTH } from './chat.js';

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
