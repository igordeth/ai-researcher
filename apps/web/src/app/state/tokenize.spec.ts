import { tokenize } from './tokenize';

describe('tokenize', () => {
  it('parte em palavras, cada uma com o espaço que vem a seguir', () => {
    expect(tokenize('A receita foi de R$ 56,7 bilhões.')).toEqual([
      'A ',
      'receita ',
      'foi ',
      'de ',
      'R$ ',
      '56,7 ',
      'bilhões.',
    ]);
  });

  it('não perde nada: juntar os tokens devolve o texto original', () => {
    const texto =
      '  Receita líquida:\n\n- 3T25: R$ 56,7 bi [cvm: VALE3, 3T25]\n- 2T25: R$ 50,1 bi  ';

    expect(tokenize(texto).join('')).toBe(texto);
  });

  it('guarda as quebras de linha e os espaços do início no token da palavra', () => {
    expect(tokenize('\nUm\n\ndois')).toEqual(['\nUm\n\n', 'dois']);
  });

  it('devolve [] para texto vazio ou só com espaços', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('  \n ')).toEqual([]);
  });
});
