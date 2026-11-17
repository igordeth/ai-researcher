import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { awaitAllCallbacks } from '@langchain/core/callbacks/promises';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, type UsageMetadata } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { Counter } from 'prom-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { consumoDiarioDeTokens } from './consumo-diario.js';
import { criarMetricsCallback } from './metrics-callback.js';
import { llmCostUsdTotal, llmTokensTotal, registroMetricas } from './registro.js';

/**
 * Um chat model fake que devolve sempre "ok" com o usage_metadata dado, como a Vertex AI devolve o
 * dela. Põe o modelo em ls_model_name, como o ChatVertexAI.
 */
class ChatFake extends BaseChatModel {
  private readonly modelo: string;
  private readonly uso: UsageMetadata | undefined;

  constructor(modelo: string, uso?: UsageMetadata) {
    super({});
    this.modelo = modelo;
    this.uso = uso;
  }

  _llmType(): string {
    return 'chat-fake';
  }

  override getLsParams(options: this['ParsedCallOptions']) {
    return { ...super.getLsParams(options), ls_model_name: this.modelo };
  }

  async _generate(): Promise<ChatResult> {
    const message = new AIMessage({ content: 'ok', usage_metadata: this.uso });
    return { generations: [{ text: 'ok', message }] };
  }
}

/**
 * Um grafo com os nós grade e answer, cada um a chamar o seu LLM sem passar config nenhuma, como os
 * nós reais: o callback só chega ao LLM pelo AsyncLocalStorage do LangGraph.
 */
function grafoDeDoisNos(gradeLlm: ChatFake, answerLlm: ChatFake) {
  const Estado = Annotation.Root({ pergunta: Annotation<string> });
  return new StateGraph(Estado)
    .addNode('grade', async ({ pergunta }) => {
      await gradeLlm.invoke(pergunta);
      return {};
    })
    .addNode('answer', async ({ pergunta }) => {
      await answerLlm.invoke(pergunta);
      return {};
    })
    .addEdge(START, 'grade')
    .addEdge('grade', 'answer')
    .addEdge('answer', END)
    .compile();
}

/** O valor do contador na série com estes labels, ou undefined se a série não existe. */
async function valorDe<Label extends string>(
  contador: Counter<Label>,
  labels: Record<Label, string>,
): Promise<number | undefined> {
  const { values } = await contador.get();
  const serie = values.find((valor) =>
    Object.entries(labels).every(([chave, esperado]) => valor.labels[chave as Label] === esperado),
  );
  return serie?.value;
}

// O grade sem cache nem raciocínio; o answer com os dois, para conferir a separação por tipo.
const USO_GRADE: UsageMetadata = { input_tokens: 1000, output_tokens: 50, total_tokens: 1050 };
const USO_ANSWER: UsageMetadata = {
  input_tokens: 3000,
  output_tokens: 600,
  total_tokens: 3600,
  input_token_details: { cache_read: 1000 },
  output_token_details: { reasoning: 200 },
};

beforeEach(() => {
  registroMetricas.resetMetrics();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('criarMetricsCallback', () => {
  it('conta os tokens por nó, modelo e tipo, e o custo pela tabela de preços', async () => {
    const grafo = grafoDeDoisNos(
      new ChatFake('gemini-3.5-flash-lite', USO_GRADE),
      new ChatFake('gemini-3.6-flash', USO_ANSWER),
    );
    const consumoAntes = consumoDiarioDeTokens.tokensHoje();

    await grafo.invoke({ pergunta: 'Receita da Vale?' }, { callbacks: [criarMetricsCallback()] });
    // O LangChain corre os callbacks em segundo plano: esperar por eles antes de ler os contadores.
    await awaitAllCallbacks();

    const grade = { node: 'grade', model: 'gemini-3.5-flash-lite' };
    expect(await valorDe(llmTokensTotal, { ...grade, kind: 'input' })).toBe(1000);
    expect(await valorDe(llmTokensTotal, { ...grade, kind: 'output' })).toBe(50);
    expect(await valorDe(llmTokensTotal, { ...grade, kind: 'reasoning' })).toBeUndefined();
    // 1000 × 0,30 + 50 × 2,50, por milhão.
    expect(await valorDe(llmCostUsdTotal, grade)).toBeCloseTo(0.000425, 12);

    // O cache_read sai do input e o reasoning sai do output: os quatro somam o total, 3600.
    const answer = { node: 'answer', model: 'gemini-3.6-flash' };
    expect(await valorDe(llmTokensTotal, { ...answer, kind: 'input' })).toBe(2000);
    expect(await valorDe(llmTokensTotal, { ...answer, kind: 'cache_read' })).toBe(1000);
    expect(await valorDe(llmTokensTotal, { ...answer, kind: 'output' })).toBe(400);
    expect(await valorDe(llmTokensTotal, { ...answer, kind: 'reasoning' })).toBe(200);
    // 2000 × 0,75 + 1000 × 0,075 + (400 + 200) × 3,75, por milhão.
    expect(await valorDe(llmCostUsdTotal, answer)).toBeCloseTo(0.003825, 12);

    // O orçamento diário recebe os mesmos tokens que o contador: 1050 do grade e 3600 do answer.
    expect(consumoDiarioDeTokens.tokensHoje() - consumoAntes).toBe(4650);
  });

  it('soma-se aos outros callbacks da chamada, sem tirar o lugar a nenhum', async () => {
    // No lugar do CallbackHandler da Langfuse, um que só regista onde foi chamado.
    const nosVistos: unknown[] = [];
    const outro = BaseCallbackHandler.fromMethods({
      handleChatModelStart(llm, messages, runId, parentRunId, extraParams, tags, metadata) {
        nosVistos.push(metadata?.langgraph_node);
      },
    });
    const grafo = grafoDeDoisNos(
      new ChatFake('gemini-3.5-flash-lite', USO_GRADE),
      new ChatFake('gemini-3.6-flash', USO_ANSWER),
    );

    await grafo.invoke({ pergunta: 'q' }, { callbacks: [outro, criarMetricsCallback()] });
    await awaitAllCallbacks();

    expect(nosVistos).toEqual(['grade', 'answer']);
    expect(await valorDe(llmCostUsdTotal, { node: 'answer', model: 'gemini-3.6-flash' })).toBe(
      0.003825,
    );
  });

  // A razão de o callback ir no call site do grafo, e nunca no cliente do LLM: um `callbacks`
  // explícito dentro de um nó substitui os que o LangGraph propagou, em vez de somar a eles.
  it('um callbacks explícito dentro do nó tira o do call site, e a chamada não é contada', async () => {
    const llm = new ChatFake('gemini-3.6-flash', USO_GRADE);
    const Estado = Annotation.Root({ pergunta: Annotation<string> });
    const grafo = new StateGraph(Estado)
      .addNode('answer', async ({ pergunta }) => {
        await llm.invoke(pergunta, { callbacks: [] });
        return {};
      })
      .addEdge(START, 'answer')
      .addEdge('answer', END)
      .compile();

    await grafo.invoke({ pergunta: 'q' }, { callbacks: [criarMetricsCallback()] });
    await awaitAllCallbacks();

    expect((await llmTokensTotal.get()).values).toEqual([]);
  });

  it('modelo fora da tabela: conta os tokens, custo zero, um aviso, e a resposta segue', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grafo = grafoDeDoisNos(
      new ChatFake('modelo-sem-preco', USO_GRADE),
      new ChatFake('modelo-sem-preco', USO_GRADE),
    );

    await expect(
      grafo.invoke({ pergunta: 'q' }, { callbacks: [criarMetricsCallback()] }),
    ).resolves.toEqual({ pergunta: 'q' });
    await awaitAllCallbacks();

    const semPreco = { node: 'answer', model: 'modelo-sem-preco' };
    expect(await valorDe(llmTokensTotal, { ...semPreco, kind: 'input' })).toBe(1000);
    expect(await valorDe(llmCostUsdTotal, semPreco)).toBe(0);
    // Duas chamadas com o mesmo modelo, um aviso só.
    expect(aviso).toHaveBeenCalledOnce();
    expect(aviso.mock.calls[0][0]).toContain('modelo-sem-preco');
  });

  it('sem usage_metadata na resposta, não conta nada: nunca estima', async () => {
    const grafo = grafoDeDoisNos(
      new ChatFake('gemini-3.5-flash-lite'),
      new ChatFake('gemini-3.6-flash'),
    );

    await grafo.invoke({ pergunta: 'q' }, { callbacks: [criarMetricsCallback()] });
    await awaitAllCallbacks();

    expect((await llmTokensTotal.get()).values).toEqual([]);
    expect((await llmCostUsdTotal.get()).values).toEqual([]);
  });

  it('um LLM chamado fora de um nó do grafo fica com node "unknown"', async () => {
    await new ChatFake('gemini-3.6-flash', USO_GRADE).invoke('q', {
      callbacks: [criarMetricsCallback()],
    });
    await awaitAllCallbacks();

    expect(
      await valorDe(llmTokensTotal, { node: 'unknown', model: 'gemini-3.6-flash', kind: 'input' }),
    ).toBe(1000);
  });
});
