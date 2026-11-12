import { describe, expect, it } from 'vitest';

import { dividirEmChunks } from './chunk.js';

/** Texto de N palavras numeradas, para ser fácil ver onde cada chunk começa e acaba. */
function palavras(n: number): string {
  return Array.from({ length: n }, (_, i) => `palavra${i}`).join(' ');
}

describe('dividirEmChunks', () => {
  it('devolve o texto inteiro num só chunk quando cabe', () => {
    expect(dividirEmChunks('texto curto')).toEqual(['texto curto']);
  });

  it('devolve lista vazia para texto vazio', () => {
    expect(dividirEmChunks('')).toEqual([]);
  });

  it('nunca passa do tamanho e nunca parte uma palavra', () => {
    const texto = palavras(600);
    const chunks = dividirEmChunks(texto);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000);
      for (const palavra of chunk.split(' ')) expect(palavra).toMatch(/^palavra\d+$/);
    }
  });

  it('repete o fim de cada chunk no início do seguinte (sobreposição de ~100 caracteres)', () => {
    const chunks = dividirEmChunks(palavras(600));

    for (let i = 0; i < chunks.length - 1; i++) {
      const inicioDoSeguinte = chunks[i + 1].split(' ')[0];
      const fimDoAtual = chunks[i].slice(-120);
      expect(fimDoAtual).toContain(inicioDoSeguinte);
    }
  });

  it('não perde texto: todas as palavras aparecem em algum chunk', () => {
    const texto = palavras(600);
    const juntos = new Set(dividirEmChunks(texto).flatMap((chunk) => chunk.split(' ')));

    expect(juntos.size).toBe(600);
  });

  it('corta no limite exato quando não há espaço (uma "palavra" gigante)', () => {
    const chunks = dividirEmChunks('x'.repeat(2500));

    expect(chunks[0]).toHaveLength(1000);
    expect(chunks.join('').length).toBeGreaterThanOrEqual(2500);
  });

  it('recusa sobreposição maior ou igual ao tamanho, que faria o ciclo não terminar', () => {
    expect(() => dividirEmChunks('abc', 100, 100)).toThrow('sobreposição');
  });
});
