import { Injectable } from '@angular/core';
import {
  chatEventSchema,
  problemDetailsSchema,
  type ChatEvent,
  type ChatRequest,
} from '@hero/contracts';

/** Os eventos que o ask entrega, um por nó do grafo concluído. O `error` não entra: vira exceção. */
export type GraphEvent = Exclude<ChatEvent, { type: 'error' }>;

/** Falha da conversa, com uma mensagem que já se pode mostrar ao utilizador. */
export class ChatError extends Error {
  override readonly name = 'ChatError';
}

const MENSAGEM_ERRO_GENERICA = 'Não foi possível concluir a resposta. Tente novamente.';
const MENSAGEM_FORMATO_INESPERADO = 'A API respondeu num formato inesperado. Tente novamente.';
const MENSAGEM_INTERROMPIDA = 'A resposta foi interrompida antes do fim. Tente novamente.';

/**
 * Cliente do POST /api/chat. Usa fetch, e não o HttpClient, porque precisa de ler o corpo aos
 * poucos, à medida que a API escreve cada evento: o HttpClient só entrega a resposta inteira.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  /**
   * Envia a pergunta e entrega os eventos do grafo à medida que chegam: retrieve, grade,
   * webSearch (e de novo retrieve e grade, se o grafo der mais uma volta) e por fim answer.
   *
   * Lança ChatError quando a API responde com erro (HTTP ou um evento `error` no stream) e quando o
   * stream acaba sem o answer. Para cancelar a meio (ao destruir o componente, via DestroyRef), passe
   * o signal de um AbortController: a conexão fecha e o fetch lança o AbortError do próprio browser.
   */
  async *ask(question: string, signal?: AbortSignal): AsyncGenerator<GraphEvent> {
    const pedido: ChatRequest = { question };
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(pedido),
      signal,
    });

    // Antes do stream começar, a API ainda responde erros normais, em problem+json (400 para uma
    // pergunta inválida, por exemplo).
    if (!response.ok) throw new ChatError(await mensagemDoProblema(response));
    if (!response.body) throw new ChatError(MENSAGEM_ERRO_GENERICA);

    let respondeu = false;
    for await (const evento of lerEventosSse(response.body)) {
      // Depois do 200, a API já não pode mudar o status: uma falha no grafo chega como evento.
      if (evento.type === 'error') throw new ChatError(evento.message);
      if (evento.type === 'answer') respondeu = true;
      yield evento;
    }

    // A API termina sempre com answer ou error. Sem nenhum dos dois, a conexão caiu a meio.
    if (!respondeu) throw new ChatError(MENSAGEM_INTERROMPIDA);
  }
}

/**
 * Lê o corpo SSE e entrega cada evento já validado. O formato é o que a API escreve: blocos
 * separados por uma linha em branco, cada um com uma linha `data: {json}`.
 */
async function* lerEventosSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  // O texto recebido que ainda não fechou um bloco: um pedaço da rede não coincide com um evento.
  let pendente = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      // Um resto em `pendente` aqui é um bloco cortado a meio, e é descartado: o ask percebe a
      // falta do answer.
      if (done) return;

      // stream: true porque um caractere acentuado pode chegar partido entre dois pedaços de bytes:
      // o decoder guarda a primeira metade até chegar a outra, em vez de a trocar por um �.
      pendente += decoder.decode(value, { stream: true });
      let fimDoBloco = pendente.indexOf('\n\n');
      while (fimDoBloco !== -1) {
        const evento = lerBloco(pendente.slice(0, fimDoBloco));
        pendente = pendente.slice(fimDoBloco + 2);
        if (evento) yield evento;
        fimDoBloco = pendente.indexOf('\n\n');
      }
    }
  } finally {
    // Corre também quando quem consome sai a meio (um break no for await, ou uma exceção): cancelar
    // o reader fecha a conexão, e a API deixa de correr o grafo para ninguém. Num stream que já
    // falhou (um abort, por exemplo), o cancel rejeita com o mesmo erro: ignorá-lo deixa sair o
    // erro original, e não esconde nada.
    await reader.cancel().catch(() => undefined);
  }
}

/** Um bloco SSE para evento. Um bloco sem linha `data:` (um comentário, por exemplo) é ignorado. */
function lerBloco(bloco: string): ChatEvent | null {
  const linhaData = bloco.split('\n').find((linha) => linha.startsWith('data:'));
  if (linhaData === undefined) return null;

  let json: unknown;
  try {
    json = JSON.parse(linhaData.slice('data:'.length));
  } catch {
    throw new ChatError(MENSAGEM_FORMATO_INESPERADO);
  }

  const evento = chatEventSchema.safeParse(json);
  if (!evento.success) throw new ChatError(MENSAGEM_FORMATO_INESPERADO);
  return evento.data;
}

/** A mensagem de uma resposta de erro HTTP: o `detail` do problem+json, se vier nesse formato. */
async function mensagemDoProblema(response: Response): Promise<string> {
  let corpo: unknown = null;
  try {
    corpo = await response.json();
  } catch {
    // Corpo vazio ou que não é JSON (um 502 do proxy, por exemplo): fica a mensagem genérica.
  }

  const problema = problemDetailsSchema.safeParse(corpo);
  return problema.success ? problema.data.detail : MENSAGEM_ERRO_GENERICA;
}
