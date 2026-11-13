import { describe, expect, it } from 'vitest';
import { problemDetailsSchema } from './problem.js';

describe('problemDetailsSchema', () => {
  it('aceita um problema com type, title, status e detail', () => {
    const problema = {
      type: '/problemas/pedido-invalido',
      title: 'Pedido inválido',
      status: 400,
      detail: 'question: obrigatório',
    };

    expect(problemDetailsSchema.parse(problema)).toEqual(problema);
  });

  it('rejeita status fora da faixa de erro HTTP', () => {
    const base = { type: 't', title: 't', detail: 'd' };

    expect(problemDetailsSchema.safeParse({ ...base, status: 200 }).success).toBe(false);
    expect(problemDetailsSchema.safeParse({ ...base, status: 600 }).success).toBe(false);
  });

  it('rejeita problema sem detail', () => {
    expect(problemDetailsSchema.safeParse({ type: 't', title: 't', status: 500 }).success).toBe(
      false,
    );
  });
});
