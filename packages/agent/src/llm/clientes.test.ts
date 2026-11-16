import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarAnswerLlm, criarGradeLlm } from './clientes.js';

describe('clientes de LLM', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exige MODEL_GRADE e MODEL_ANSWER, sem modelo fixo no código', () => {
    vi.stubEnv('MODEL_GRADE', undefined);
    vi.stubEnv('MODEL_ANSWER', '');

    expect(() => criarGradeLlm()).toThrow('MODEL_GRADE não definida');
    expect(() => criarAnswerLlm()).toThrow('MODEL_ANSWER não definida');
  });

  it('cada nó usa o modelo da sua variável, com temperatura 0', () => {
    vi.stubEnv('MODEL_GRADE', 'gemini-3.5-flash-lite');
    vi.stubEnv('MODEL_ANSWER', 'gemini-3.6-flash');

    expect(criarGradeLlm().model).toBe('gemini-3.5-flash-lite');
    expect(criarAnswerLlm().model).toBe('gemini-3.6-flash');
    expect(criarGradeLlm().temperature).toBe(0);
  });

  it('usa a região "global" por padrão, e GOOGLE_CLOUD_LOCATION_LLM quando definida', () => {
    // O ChatVertexAI não expõe a região como campo público: ela vive na conexão interna, que é de
    // onde o LangChain monta o URL do endpoint. É o valor que de facto vai para a rede.
    const regiao = (llm: unknown) =>
      (llm as { connection: { location: string } }).connection.location;
    vi.stubEnv('MODEL_GRADE', 'gemini-3.5-flash-lite');

    vi.stubEnv('GOOGLE_CLOUD_LOCATION_LLM', undefined);
    expect(regiao(criarGradeLlm())).toBe('global');

    vi.stubEnv('GOOGLE_CLOUD_LOCATION_LLM', 'us-central1');
    expect(regiao(criarGradeLlm())).toBe('us-central1');
  });
});
