import { describe, expect, it } from 'vitest';

import { mascararDadosPessoais } from './mascarar-dados.js';

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
