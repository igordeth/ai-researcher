import { afterEach, describe, expect, it, vi } from 'vitest';

import { memoizarPromessa, obterGrafoReal } from './grafo-real.js';

describe('memoizarPromessa', () => {
  it('constrói só na primeira chamada e devolve o mesmo valor depois', async () => {
    const construir = vi.fn(async () => ({ id: 1 }));
    const obter = memoizarPromessa(construir);

    expect(construir).not.toHaveBeenCalled();
    const primeiro = await obter();
    const segundo = await obter();

    expect(primeiro).toBe(segundo);
    expect(construir).toHaveBeenCalledTimes(1);
  });

  it('chamadas ao mesmo tempo esperam a mesma construção', async () => {
    const construir = vi.fn(async () => ({ id: 1 }));
    const obter = memoizarPromessa(construir);

    const [a, b] = await Promise.all([obter(), obter()]);

    expect(a).toBe(b);
    expect(construir).toHaveBeenCalledTimes(1);
  });

  it('depois de uma falha, a chamada seguinte tenta de novo', async () => {
    const construir = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('sem rede'))
      .mockResolvedValueOnce('ok');
    const obter = memoizarPromessa(construir);

    await expect(obter()).rejects.toThrow('sem rede');
    expect(await obter()).toBe('ok');
    expect(construir).toHaveBeenCalledTimes(2);
  });
});

describe('obterGrafoReal', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Só os caminhos de configuração em falta: o caminho feliz abriria Postgres e Vertex AI.
  it('falha com mensagem clara sem DATABASE_URL, sem tocar a base', async () => {
    vi.stubEnv('DATABASE_URL', undefined);

    await expect(obterGrafoReal()).rejects.toThrow('DATABASE_URL não definida');
  });

  it('falha com mensagem clara sem o modelo de um nó, e tenta de novo na chamada seguinte', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://ninguem@localhost:1/nada');
    vi.stubEnv('MODEL_EMBEDDING', 'modelo-de-embedding');
    vi.stubEnv('MODEL_GRADE', undefined);

    await expect(obterGrafoReal()).rejects.toThrow('MODEL_GRADE não definida');

    vi.stubEnv('MODEL_GRADE', 'gemini-3.5-flash-lite');
    vi.stubEnv('MODEL_ANSWER', undefined);
    await expect(obterGrafoReal()).rejects.toThrow('MODEL_ANSWER não definida');
  });
});
