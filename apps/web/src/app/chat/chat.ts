import { Component, computed, signal } from '@angular/core';

/**
 * Casca do chat: cabeçalho, disclaimer, área de mensagens e composer. Ainda sem envio nem
 * streaming: isso chega com o store de chat e o serviço de SSE (ver a skill angular-component).
 */
@Component({
  selector: 'app-chat',
  imports: [],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  protected readonly pergunta = signal('');

  // O botão fica desativado de verdade (atributo disabled) com a pergunta vazia ou só espaços.
  protected readonly podeEnviar = computed(() => this.pergunta().trim().length > 0);

  protected aoDigitar(evento: Event): void {
    this.pergunta.set((evento.target as HTMLInputElement).value);
  }

  protected aoEnviar(evento: SubmitEvent): void {
    // Sem envio nesta casca: impede só o recarregamento da página pelo submit nativo do form.
    evento.preventDefault();
  }
}
