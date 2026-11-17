import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import { ChatService } from '../api/chat.service';
import { GraphStore } from './graph-store';
import { tokenize } from './tokenize';

/** Intervalo entre duas palavras na revelação da resposta. */
export const REVEAL_INTERVAL_MS = 70;

// Fixa, seja qual for a falha: o detalhe vai para a consola, e não para a conversa.
export const MENSAGEM_ERRO = 'Não foi possível concluir a resposta. Tente novamente.';

/**
 * Em que ponto está a resposta do assistente:
 * - waiting: a pergunta foi enviada e o grafo ainda corre (retrieve, grade, webSearch);
 * - revealing: o texto do answer já chegou e aparece palavra por palavra;
 * - done: o texto está todo na tela;
 * - error: a chamada falhou, e o texto é a MENSAGEM_ERRO.
 */
export type AssistantStatus = 'waiting' | 'revealing' | 'done' | 'error';

export interface UserMessage {
  readonly id: number;
  readonly role: 'user';
  readonly text: string;
}

export interface AssistantMessage {
  readonly id: number;
  readonly role: 'assistant';
  readonly status: AssistantStatus;
  // O que está visível agora: durante a revelação, só as palavras já mostradas.
  readonly text: string;
}

export type ChatMessage = UserMessage | AssistantMessage;

/** O estado da conversa. O componente lê os signals e chama send; não conhece HTTP nem SSE. */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly chatService = inject(ChatService);
  // As etapas do grafo da pergunta em curso: o ChatStore lê o stream, e cada evento vai também
  // para o painel do grafo.
  private readonly graphStore = inject(GraphStore);

  private readonly _messages = signal<ChatMessage[]>([]);
  readonly messages = this._messages.asReadonly();

  /** Há uma resposta a caminho ou a ser revelada: até ela terminar, não entra outra pergunta. */
  readonly busy = computed(() => {
    const last = this._messages().at(-1);
    return last?.role === 'assistant' && (last.status === 'waiting' || last.status === 'revealing');
  });

  private nextId = 1;
  private revealTimer: ReturnType<typeof setInterval> | undefined;
  // O da pergunta em curso: ao destruir o store, fecha a conexão com a API.
  private abortController: AbortController | undefined;

  constructor() {
    // Sem isto, um timer ou uma conexão SSE sobrevivem ao store: o timer continua a escrever num
    // signal que ninguém lê, e a conexão mantém o grafo (e a instância do Cloud Run) a trabalhar.
    inject(DestroyRef).onDestroy(() => {
      this.stopReveal();
      this.abortController?.abort();
    });
  }

  /**
   * Acrescenta a pergunta e um placeholder do assistente, e acompanha a resposta até ao fim. A
   * Promise resolve quando o stream acaba; a revelação do texto pode continuar depois disso.
   */
  async send(question: string): Promise<void> {
    const text = question.trim();
    if (text.length === 0 || this.busy()) return;

    const assistantId = this.nextId + 1;
    this._messages.update((messages) => [
      ...messages,
      { id: this.nextId, role: 'user', text },
      { id: assistantId, role: 'assistant', status: 'waiting', text: '' },
    ]);
    this.nextId += 2;

    const abortController = new AbortController();
    this.abortController = abortController;
    this.graphStore.start();

    try {
      for await (const event of this.chatService.ask(text, abortController.signal)) {
        this.graphStore.apply(event);
        // retrieve, grade e webSearch só mexem no painel do grafo; a conversa espera a resposta.
        if (event.type === 'answer') this.reveal(assistantId, event.answer);
      }
    } catch (error) {
      // Abortado só acontece ao destruir o store: não há conversa onde mostrar o erro.
      if (abortController.signal.aborted) return;
      console.error('Falha na conversa com /api/chat', error);
      this.graphStore.interrupt();
      this.stopReveal();
      this.updateAssistant(assistantId, 'error', MENSAGEM_ERRO);
    } finally {
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }

  /** Mostra o texto do answer uma palavra a cada REVEAL_INTERVAL_MS. */
  private reveal(assistantId: number, answer: string): void {
    this.stopReveal();
    const tokens = tokenize(answer);

    if (tokens.length === 0) {
      this.updateAssistant(assistantId, 'done', '');
      return;
    }

    this.updateAssistant(assistantId, 'revealing', '');
    let shown = 0;
    this.revealTimer = setInterval(() => {
      shown += 1;
      const finished = shown === tokens.length;
      this.updateAssistant(
        assistantId,
        finished ? 'done' : 'revealing',
        tokens.slice(0, shown).join(''),
      );
      if (finished) this.stopReveal();
    }, REVEAL_INTERVAL_MS);
  }

  private stopReveal(): void {
    if (this.revealTimer === undefined) return;
    clearInterval(this.revealTimer);
    this.revealTimer = undefined;
  }

  private updateAssistant(id: number, status: AssistantStatus, text: string): void {
    this._messages.update((messages) =>
      messages.map((message) =>
        message.id === id && message.role === 'assistant' ? { ...message, status, text } : message,
      ),
    );
  }
}
