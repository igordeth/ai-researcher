import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import { AIMessage, type BaseMessage, type UsageMetadata } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';

import { PRECOS_USD_POR_MILHAO } from './precos.js';
import { llmCostUsdTotal, llmTokensTotal } from './registro.js';

/** Rótulo de quando o metadata não diz o nó ou o modelo: o LLM chamado fora de um nó do grafo. */
const DESCONHECIDO = 'unknown';

/** De onde veio uma chamada ao LLM: o que se sabe no início dela e só se usa no fim. */
interface ChamadaLlm {
  node: string;
  model: string;
}

function textoOuDesconhecido(valor: unknown): string {
  return typeof valor === 'string' && valor !== '' ? valor : DESCONHECIDO;
}

/**
 * O usage_metadata que o modelo devolveu na resposta, ou undefined se não devolveu. Uma chamada
 * ao chat model tem uma geração só: a Vertex AI junta as partes da resposta numa mensagem.
 */
function usoDaResposta(resposta: LLMResult): UsageMetadata | undefined {
  const geracao = resposta.generations[0]?.[0];
  const mensagem = geracao && 'message' in geracao ? geracao.message : undefined;
  return AIMessage.isInstance(mensagem) ? mensagem.usage_metadata : undefined;
}

// Os modelos sem preço já avisados neste processo: um aviso por modelo, e não um por chamada.
const modelosSemPrecoAvisados = new Set<string>();

function avisarModeloSemPreco(modelo: string): void {
  if (modelosSemPrecoAvisados.has(modelo)) return;
  modelosSemPrecoAvisados.add(modelo);
  console.warn(
    `Modelo ${modelo} sem preço em metricas/precos.ts: os tokens são contados, o custo conta como zero.`,
  );
}

/** Soma os tokens e o custo de uma chamada aos contadores. */
function registrarUso({ node, model }: ChamadaLlm, uso: UsageMetadata): void {
  // Na convenção do LangChain, input_tokens já inclui o cache_read e output_tokens já inclui o
  // reasoning (a Vertex AI soma o thoughtsTokenCount à saída). Tirar as partes do todo dá quatro
  // tipos que não se sobrepõem, e a soma deles volta a ser o total da chamada.
  const cacheRead = uso.input_token_details?.cache_read ?? 0;
  const reasoning = uso.output_token_details?.reasoning ?? 0;
  const tokens = {
    input: uso.input_tokens - cacheRead,
    cache_read: cacheRead,
    output: uso.output_tokens - reasoning,
    reasoning,
  };
  for (const [kind, quantidade] of Object.entries(tokens)) {
    if (quantidade > 0) llmTokensTotal.inc({ node, model, kind }, quantidade);
  }

  const preco = PRECOS_USD_POR_MILHAO[model];
  if (!preco) {
    // Sem preço, a resposta segue igual: a métrica é para quem acompanha o custo, e nunca uma
    // razão para falhar uma pergunta. O incremento de zero faz a série aparecer no /metrics.
    avisarModeloSemPreco(model);
    llmCostUsdTotal.inc({ node, model }, 0);
    return;
  }
  const custo =
    (tokens.input * preco.input +
      tokens.cache_read * preco.cacheRead +
      (tokens.output + tokens.reasoning) * preco.output) /
    1_000_000;
  llmCostUsdTotal.inc({ node, model }, custo);
}

/**
 * Conta os tokens e o custo de cada chamada a um chat model nos contadores do Prometheus. Genérico:
 * não conhece nenhum nó nem modelo. Lê-os do metadata que o LangChain passa no início da chamada,
 * o langgraph_node (posto pelo LangGraph em cada nó) e o ls_model_name (posto pelo chat model).
 *
 * O início (handleChatModelStart) sabe o nó e o modelo, e o fim (handleLLMEnd) sabe os tokens. Os
 * dois correlacionam-se pelo runId, que o LangChain repete nos dois.
 */
class MetricsCallbackHandler extends BaseCallbackHandler {
  name = 'metrics-callback';

  // As chamadas que começaram e ainda não acabaram. Só desta pergunta: o handler é novo a cada uma.
  private readonly chamadasAbertas = new Map<string, ChamadaLlm>();

  override handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
  ): void {
    this.chamadasAbertas.set(runId, {
      node: textoOuDesconhecido(metadata?.langgraph_node),
      model: textoOuDesconhecido(metadata?.ls_model_name),
    });
  }

  override handleLLMEnd(resposta: LLMResult, runId: string): void {
    const chamada = this.chamadasAbertas.get(runId);
    this.chamadasAbertas.delete(runId);
    const uso = usoDaResposta(resposta);
    // Sem o usage_metadata do modelo, não conta nada: o número das métricas é o que a Vertex AI
    // diz que cobrou, nunca uma estimativa a partir do tamanho do texto.
    if (!chamada || !uso) return;
    registrarUso(chamada, uso);
  }

  override handleLLMError(erro: Error, runId: string): void {
    // Uma chamada que falhou não chega ao handleLLMEnd: sai das abertas aqui.
    this.chamadasAbertas.delete(runId);
  }
}

/**
 * O callback de métricas de uma pergunta, a passar ao graph.stream() ou ao graph.invoke() junto com
 * os da Langfuse: `callbacks: [...callbacks, criarMetricsCallback()]`.
 *
 * Sempre no call site do grafo, e nunca dentro de um nó ou do cliente do LLM: o LangGraph propaga o
 * callback manager da chamada até cada nó por AsyncLocalStorage. Um `callbacks` explícito dentro de
 * um nó substituiria esse ambiente, em vez de somar a ele, e a chamada sairia do trace da Langfuse.
 */
export function criarMetricsCallback(): BaseCallbackHandler {
  return new MetricsCallbackHandler();
}
