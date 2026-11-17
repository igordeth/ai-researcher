import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatStore, MENSAGEM_ERRO, type ChatMessage } from '../state/chat-store';
import { Chat } from './chat';

// Uma resposta no formato do formatarResposta do @hero/agent: corpo e bloco Fontes.
const RESPOSTA = [
  'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25].',
  '',
  'Fontes:',
  '- [VALE3 3T25] Vale S.A., data-base 30/09/2025 (CVM)',
  '- [web: Vale tem queda no minério] https://noticias.com/vale',
].join('\n');

describe('Chat', () => {
  let fixture: ComponentFixture<Chat>;
  let elemento: HTMLElement;
  // Um store falso com a mesma forma pública: o teste decide as mensagens e o busy.
  let messages: ReturnType<typeof signal<ChatMessage[]>>;
  let busy: ReturnType<typeof signal<boolean>>;
  let send: ReturnType<typeof vi.fn<ChatStore['send']>>;

  beforeEach(async () => {
    messages = signal<ChatMessage[]>([]);
    busy = signal(false);
    send = vi.fn<ChatStore['send']>(async () => undefined);

    await TestBed.configureTestingModule({
      imports: [Chat],
      providers: [{ provide: ChatStore, useValue: { messages, busy, send } }],
    }).compileComponents();

    fixture = TestBed.createComponent(Chat);
    elemento = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function textarea(): HTMLTextAreaElement {
    const campo = elemento.querySelector<HTMLTextAreaElement>('textarea#pergunta');
    if (!campo) throw new Error('textarea da pergunta não encontrada');
    return campo;
  }

  function digitar(texto: string): void {
    textarea().value = texto;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function teclar(init: KeyboardEventInit): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { cancelable: true, ...init });
    textarea().dispatchEvent(evento);
    fixture.detectChanges();
    return evento;
  }

  function botaoEnviar(): HTMLButtonElement {
    const botao = elemento.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!botao) throw new Error('botão Enviar não encontrado');
    return botao;
  }

  async function mostrar(lista: ChatMessage[]): Promise<void> {
    messages.set(lista);
    await fixture.whenStable();
  }

  describe('layout', () => {
    it('mostra o wordmark no cabeçalho', () => {
      expect(elemento.querySelector('header .wordmark')?.textContent?.trim()).toBe('AI RESEARCHER');
    });

    it('mostra o disclaimer de que não é recomendação de investimento', () => {
      const disclaimer = elemento.querySelector('.disclaimer');

      expect(disclaimer?.getAttribute('role')).toBe('note');
      expect(disclaimer?.textContent).toContain('não recomendação de investimento');
    });

    it('começa com a área de mensagens vazia, anunciada a leitores de tela', () => {
      const mensagens = elemento.querySelector('section.mensagens');

      expect(mensagens?.getAttribute('aria-label')).toBe('Conversa');
      expect(mensagens?.getAttribute('aria-live')).toBe('polite');
      expect(mensagens?.children.length).toBe(0);
    });

    it('a textarea da pergunta tem label para leitores de tela', () => {
      const label = elemento.querySelector('label[for="pergunta"]');

      expect(label?.textContent?.trim()).toBe('Pergunta');
    });
  });

  describe('envio', () => {
    it('o botão Enviar fica desativado de verdade com a pergunta vazia ou só espaços', () => {
      expect(botaoEnviar().disabled).toBe(true);

      digitar('   ');
      expect(botaoEnviar().disabled).toBe(true);

      digitar('Qual a receita da Vale?');
      expect(botaoEnviar().disabled).toBe(false);
    });

    it('o botão Enviar fica desativado enquanto a resposta anterior não terminou', async () => {
      digitar('Qual a receita da Vale?');
      busy.set(true);
      await fixture.whenStable();

      expect(botaoEnviar().disabled).toBe(true);
    });

    it('Enter envia a pergunta ao store e limpa a textarea', () => {
      digitar('Qual a receita da Vale?');

      const evento = teclar({ key: 'Enter' });

      expect(evento.defaultPrevented).toBe(true);
      expect(send).toHaveBeenCalledWith('Qual a receita da Vale?');
      expect(textarea().value).toBe('');
    });

    it('Shift+Enter não envia: deixa a textarea quebrar a linha', () => {
      digitar('Qual a receita');

      const evento = teclar({ key: 'Enter', shiftKey: true });

      expect(evento.defaultPrevented).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });

    it('clicar em Enviar envia a pergunta', () => {
      digitar('Qual a receita da Vale?');

      botaoEnviar().click();

      expect(send).toHaveBeenCalledWith('Qual a receita da Vale?');
    });

    it('Enter não envia enquanto a resposta anterior não terminou', async () => {
      digitar('Outra pergunta');
      busy.set(true);
      await fixture.whenStable();

      teclar({ key: 'Enter' });

      expect(send).not.toHaveBeenCalled();
      expect(textarea().value).toBe('Outra pergunta');
    });
  });

  describe('mensagens', () => {
    it('mostra a pergunta do usuário numa bolha', async () => {
      await mostrar([{ id: 1, role: 'user', text: 'Qual a receita da Vale?' }]);

      expect(elemento.querySelector('.mensagem-usuario')?.textContent?.trim()).toBe(
        'Qual a receita da Vale?',
      );
    });

    it('mostra o corpo da resposta sem o bloco Fontes', async () => {
      await mostrar([{ id: 2, role: 'assistant', status: 'done', text: RESPOSTA }]);
      const texto = elemento.querySelector('.mensagem-assistente__texto')?.textContent ?? '';

      expect(texto.trim()).toBe(
        'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25].',
      );
      expect(texto).not.toContain('Fontes:');
    });

    it('lista a citação da CVM com a data-base, e a da web como link que abre noutra aba', async () => {
      await mostrar([{ id: 2, role: 'assistant', status: 'done', text: RESPOSTA }]);
      const [cvm, web] = Array.from(elemento.querySelectorAll('.fonte'));

      expect(cvm.querySelector('a')).toBeNull();
      expect(cvm.querySelector('.fonte__rotulo')?.textContent?.trim()).toBe('VALE3 3T25');
      expect(cvm.querySelector('.fonte__data-base')?.textContent).toContain('30/09/2025');
      expect(cvm.querySelector('.fonte__origem')?.textContent?.trim()).toBe('Base local (CVM)');

      const link = web.querySelector('a');
      expect(link?.textContent?.trim()).toBe('web: Vale tem queda no minério');
      expect(link?.getAttribute('href')).toBe('https://noticias.com/vale');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(web.querySelector('.fonte__origem')?.textContent?.trim()).toBe('noticias.com');
    });

    it('sem citações, não mostra a lista de fontes', async () => {
      await mostrar([{ id: 2, role: 'assistant', status: 'done', text: 'Só o corpo.' }]);

      expect(elemento.querySelector('.fontes')).toBeNull();
    });

    it('enquanto espera o answer, marca a mensagem como ocupada e mostra o cursor', async () => {
      await mostrar([{ id: 2, role: 'assistant', status: 'waiting', text: '' }]);
      const mensagem = elemento.querySelector('.mensagem-assistente');

      expect(mensagem?.getAttribute('aria-busy')).toBe('true');
      expect(mensagem?.querySelector('.cursor')).not.toBeNull();
    });

    it('com a resposta concluída, tira o cursor e o aria-busy', async () => {
      await mostrar([{ id: 2, role: 'assistant', status: 'done', text: 'Só o corpo.' }]);
      const mensagem = elemento.querySelector('.mensagem-assistente');

      expect(mensagem?.getAttribute('aria-busy')).toBe('false');
      expect(mensagem?.querySelector('.cursor')).toBeNull();
    });

    it('mostra a mensagem de erro fixa, sem cursor nem fontes', async () => {
      await mostrar([{ id: 2, role: 'assistant', status: 'error', text: MENSAGEM_ERRO }]);
      const mensagem = elemento.querySelector('.mensagem-assistente');

      expect(mensagem?.querySelector('.mensagem-assistente__erro')?.textContent?.trim()).toBe(
        MENSAGEM_ERRO,
      );
      expect(mensagem?.querySelector('.cursor')).toBeNull();
      expect(mensagem?.querySelector('.fontes')).toBeNull();
    });
  });
});
