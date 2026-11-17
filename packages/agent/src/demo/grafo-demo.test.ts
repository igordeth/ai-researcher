import { VertexAIEmbeddings } from '@langchain/google-vertexai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contemLinguagemRecomendatoria } from '../answer/format-resposta.js';
import { EMBEDDING_DIMENSIONS } from '../db/schema.js';
// Ficheiro à parte do grafo-real.test.ts: o obterGrafoReal é memoizado por módulo, e o grafo
// demo construído aqui ficaria em cache para os testes do grafo real.
import { obterGrafoReal } from '../grafo-real.js';
import { makeAnswerNode } from '../nodes/answer.js';
import { makeGradeNode } from '../nodes/grade.js';
import { criarEmbeddings, criarEmbeddingsReal } from '../seed/embeddings.js';
import { criarBuscarDemo } from './buscar-demo.js';
import { DOCUMENTO_VALE_3T25 } from './documento-vale-3t25.js';
import { criarAnswerLlmDemo, criarGradeLlmDemo, RESPOSTA_DEMO } from './llm-demo.js';

const FONTE_VALE_3T25 = '- [VALE 3T25] Vale S.A., data-base 30/09/2025 (CVM)';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('criarEmbeddings', () => {
  it('com DEMO=true devolve vetores de zeros, sem exigir MODEL_EMBEDDING', async () => {
    vi.stubEnv('DEMO', 'true');
    vi.stubEnv('MODEL_EMBEDDING', undefined);
    const embeddings = criarEmbeddings();

    const vetor = await embeddings.embedQuery('Qual a receita da Vale?');
    expect(vetor).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vetor.every((valor) => valor === 0)).toBe(true);

    const vetores = await embeddings.embedDocuments(['um', 'dois']);
    expect(vetores).toHaveLength(2);
    expect(vetores[1]).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('sem DEMO, devolve o cliente real e exige MODEL_EMBEDDING', () => {
    vi.stubEnv('DEMO', undefined);
    vi.stubEnv('MODEL_EMBEDDING', undefined);

    expect(() => criarEmbeddings()).toThrow('MODEL_EMBEDDING não definida');
  });
});

describe('criarEmbeddingsReal', () => {
  // É o cliente do seed: nunca pode virar o fake de zeros, nem com DEMO=true.
  it('ignora o DEMO: continua a exigir MODEL_EMBEDDING e devolve o cliente da Vertex AI', () => {
    vi.stubEnv('DEMO', 'true');
    vi.stubEnv('MODEL_EMBEDDING', undefined);
    expect(() => criarEmbeddingsReal()).toThrow('MODEL_EMBEDDING não definida');

    vi.stubEnv('MODEL_EMBEDDING', 'gemini-embedding-001');
    expect(criarEmbeddingsReal()).toBeInstanceOf(VertexAIEmbeddings);
  });
});

describe('criarBuscarDemo', () => {
  it('devolve sempre o documento da Vale 3T25, seja qual for o vetor', async () => {
    const buscar = criarBuscarDemo();

    expect(await buscar([0, 0, 0], 5)).toEqual([DOCUMENTO_VALE_3T25]);
    expect(await buscar([0.3, -0.1], 1)).toEqual([DOCUMENTO_VALE_3T25]);
  });
});

describe('criarGradeLlmDemo', () => {
  it('passa pela validação do nó grade e considera o contexto suficiente', async () => {
    const grade = makeGradeNode(criarGradeLlmDemo());

    const resultado = await grade({ question: 'q', documents: [] });

    expect(resultado).toEqual({ sufficient: true, missingAspects: [], iterations: 1 });
  });
});

describe('criarAnswerLlmDemo', () => {
  it('responde o texto fixo, e o nó answer acrescenta a fonte do documento', async () => {
    const answer = makeAnswerNode(criarAnswerLlmDemo());

    const { finalAnswer } = await answer({
      question: 'q',
      documents: [DOCUMENTO_VALE_3T25],
      sufficient: true,
    });

    expect(finalAnswer).toBe(`${RESPOSTA_DEMO}\n\nFontes:\n${FONTE_VALE_3T25}`);
  });

  it('a resposta fixa cita só números do documento da Vale 3T25', () => {
    for (const numero of ['R$ 56,7 bilhões', '7,0%', 'R$ 14,7 bilhões', '25,9%']) {
      expect(DOCUMENTO_VALE_3T25.paragraph).toContain(numero);
      expect(RESPOSTA_DEMO).toContain(numero);
    }
  });
});

describe('o grafo inteiro com DEMO=true', () => {
  it('responde sem Postgres nem Vertex AI, pelo caminho retrieve → grade → answer', async () => {
    vi.stubEnv('DEMO', 'true');
    // Nada disto existe no CI: o demo não pode depender de nenhuma.
    for (const variavel of ['DATABASE_URL', 'MODEL_EMBEDDING', 'MODEL_GRADE', 'MODEL_ANSWER']) {
      vi.stubEnv(variavel, undefined);
    }
    const grafo = await obterGrafoReal();

    const nos: string[] = [];
    let finalAnswer = '';
    const chunks = await grafo.stream(
      { question: 'Qual a receita da Vale?' },
      { streamMode: 'updates' },
    );
    for await (const chunk of chunks) {
      const [no] = Object.keys(chunk);
      nos.push(no);
      if (chunk.answer) finalAnswer = chunk.answer.finalAnswer;
    }

    expect(nos).toEqual(['retrieve', 'grade', 'answer']);
    expect(finalAnswer).toContain(RESPOSTA_DEMO);
    expect(finalAnswer).toContain(FONTE_VALE_3T25);
  });

  it('a pergunta de recomendação recebe a mesma resposta fixa, sem linguagem recomendatória', async () => {
    vi.stubEnv('DEMO', 'true');
    vi.stubEnv('DATABASE_URL', undefined);
    const grafo = await obterGrafoReal();

    const { finalAnswer } = await grafo.invoke({ question: 'Devo comprar ações da Vale?' });

    expect(finalAnswer).toContain(RESPOSTA_DEMO);
    expect(contemLinguagemRecomendatoria(finalAnswer)).toBe(false);
  });
});
