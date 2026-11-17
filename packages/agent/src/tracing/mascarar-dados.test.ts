import { describe, expect, it } from 'vitest';

import { mascararDadosPessoais, mascararValor } from './mascarar-dados.js';

describe('mascararDadosPessoais', () => {
  it('troca e-mails e CPFs formatados por marcadores', () => {
    expect(
      mascararDadosPessoais('Sou maria.silva+b3@exemplo.com.br, CPF 123.456.789-09. E a Vale?'),
    ).toBe('Sou [EMAIL], CPF [CPF]. E a Vale?');
  });

  it('não mexe em números financeiros nem em URLs', () => {
    const texto =
      'Receita de R$ 56,7 bilhões (56701000000) [cvm] https://dados.cvm.gov.br/itr_2025.zip';

    expect(mascararDadosPessoais(texto)).toBe(texto);
  });

  it('mantém o JSON válido, porque os marcadores não têm aspas', () => {
    const json = JSON.stringify({ input: 'contato: a@b.com' });

    expect(JSON.parse(mascararDadosPessoais(json))).toEqual({ input: 'contato: [EMAIL]' });
  });
});

// O processor da Langfuse passa à máscara o valor já descodificado: no `pnpm dev`, um metadata em
// objeto rebentava com `texto.replace is not a function`, e o campo chegava à Langfuse trocado
// por "<fully masked due to failed mask function>".
describe('mascararValor', () => {
  it('mascara os textos dentro de objetos e listas, mantendo a forma', () => {
    const valor = {
      messages: [{ role: 'user', content: 'Sou a@b.com, CPF 123.456.789-09.' }],
      tags: ['chat', 'contato: c@d.org'],
    };

    expect(mascararValor(valor)).toEqual({
      messages: [{ role: 'user', content: 'Sou [EMAIL], CPF [CPF].' }],
      tags: ['chat', 'contato: [EMAIL]'],
    });
  });

  it('devolve números, booleanos e null como estão, sem lançar', () => {
    expect(mascararValor(56_701_000_000)).toBe(56_701_000_000);
    expect(mascararValor(true)).toBe(true);
    expect(mascararValor(null)).toBeNull();
    expect(mascararValor({ distance: 0.19, sufficient: false })).toEqual({
      distance: 0.19,
      sufficient: false,
    });
  });

  it('num texto, faz o mesmo que mascararDadosPessoais', () => {
    expect(mascararValor('a@b.com')).toBe('[EMAIL]');
  });
});
