import { Component, computed, inject, signal } from '@angular/core';

import { GraphPanel } from '../graph/graph-panel/graph-panel';
import { ChatStore, type AssistantMessage, type UserMessage } from '../state/chat-store';
import { parseAnswer, type ParsedAnswer } from '../state/citation';

/** A mensagem do assistente como a tela a mostra: o texto já separado em corpo e citações. */
type AssistantNaTela = AssistantMessage & { readonly parsed: ParsedAnswer };
type MensagemNaTela = UserMessage | AssistantNaTela;

/**
 * A conversa: lê as mensagens do ChatStore e envia as perguntas por ele. Não conhece HTTP nem SSE
 * (ver a skill angular-component).
 */
@Component({
  selector: 'app-chat',
  imports: [GraphPanel],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  private readonly store = inject(ChatStore);

  protected readonly pergunta = signal('');

  // O botão fica desativado de verdade (atributo disabled) com a pergunta vazia ou só espaços, e
  // enquanto a resposta anterior não terminou: o store não aceitaria a pergunta nesse momento.
  protected readonly podeEnviar = computed(
    () => this.pergunta().trim().length > 0 && !this.store.busy(),
  );

  // O parseAnswer corre também durante a revelação: o bloco Fontes nunca aparece como texto, e
  // cada citação entra na lista quando a sua linha fica completa.
  protected readonly mensagens = computed<MensagemNaTela[]>(() =>
    this.store
      .messages()
      .map((mensagem) =>
        mensagem.role === 'assistant'
          ? { ...mensagem, parsed: parseAnswer(mensagem.text) }
          : mensagem,
      ),
  );

  protected aoDigitar(evento: Event): void {
    this.pergunta.set((evento.target as HTMLTextAreaElement).value);
  }

  /** Enter envia; Shift+Enter deixa a textarea quebrar a linha. */
  protected aoTeclar(evento: KeyboardEvent): void {
    // isComposing: o Enter que confirma um acento ou um caractere num teclado IME não é envio.
    if (evento.key !== 'Enter' || evento.shiftKey || evento.isComposing) return;
    evento.preventDefault();
    this.enviar();
  }

  protected aoSubmeter(evento: SubmitEvent): void {
    // Impede o recarregamento da página pelo submit nativo do form.
    evento.preventDefault();
    this.enviar();
  }

  protected emAndamento(mensagem: AssistantNaTela): boolean {
    return mensagem.status === 'waiting' || mensagem.status === 'revealing';
  }

  private enviar(): void {
    if (!this.podeEnviar()) return;
    const pergunta = this.pergunta();
    this.pergunta.set('');
    // A Promise não rejeita: o store trata a falha e mostra a mensagem de erro na conversa.
    void this.store.send(pergunta);
  }
}
