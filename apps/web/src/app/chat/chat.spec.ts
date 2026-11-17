import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chat } from './chat';

describe('Chat', () => {
  let fixture: ComponentFixture<Chat>;
  let elemento: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chat],
    }).compileComponents();

    fixture = TestBed.createComponent(Chat);
    elemento = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function digitar(texto: string): void {
    const input = elemento.querySelector<HTMLInputElement>('#pergunta');
    if (!input) throw new Error('input da pergunta não encontrado');
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function botaoEnviar(): HTMLButtonElement {
    const botao = elemento.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!botao) throw new Error('botão Enviar não encontrado');
    return botao;
  }

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

  it('o input da pergunta tem label para leitores de tela', () => {
    const label = elemento.querySelector('label[for="pergunta"]');

    expect(label?.textContent?.trim()).toBe('Pergunta');
  });

  it('o botão Enviar fica desativado de verdade com a pergunta vazia ou só espaços', () => {
    expect(botaoEnviar().disabled).toBe(true);

    digitar('   ');
    expect(botaoEnviar().disabled).toBe(true);

    digitar('Qual a receita da Vale?');
    expect(botaoEnviar().disabled).toBe(false);
  });
});
