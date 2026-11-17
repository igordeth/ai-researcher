import { ORIGEM_CVM, parseAnswer } from './citation';

// Uma resposta no formato que o formatarResposta do @hero/agent escreve: corpo, linha em branco,
// bloco Fontes com uma linha da CVM e uma da web.
const RESPOSTA = [
  'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25]. A queda veio do preço',
  'do minério [web: Vale tem queda no minério].',
  '',
  'Fontes:',
  '- [VALE3 3T25] Vale S.A., data-base 30/09/2025 (CVM)',
  '- [web: Vale tem queda no minério] https://noticias.com/vale',
].join('\n');

describe('parseAnswer', () => {
  it('separa o corpo do bloco Fontes', () => {
    expect(parseAnswer(RESPOSTA).body).toBe(
      'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25]. A queda veio do preço\n' +
        'do minério [web: Vale tem queda no minério].',
    );
  });

  it('extrai a citação da CVM com período, data-base e a origem Base local (CVM)', () => {
    expect(parseAnswer(RESPOSTA).citations[0]).toEqual({
      label: 'VALE3 3T25',
      url: null,
      origin: ORIGEM_CVM,
      period: '3T25',
      dataBase: '30/09/2025',
    });
  });

  it('extrai a citação da web com o URL e o hostname como origem', () => {
    expect(parseAnswer(RESPOSTA).citations[1]).toEqual({
      label: 'web: Vale tem queda no minério',
      url: 'https://noticias.com/vale',
      origin: 'noticias.com',
      period: null,
      dataBase: null,
    });
  });

  it('aceita colchetes no título da web', () => {
    const resposta = 'Corpo.\n\nFontes:\n- [web: Vale [VALE3] sobe] https://www.infomoney.com.br/a';

    expect(parseAnswer(resposta).citations).toEqual([
      {
        label: 'web: Vale [VALE3] sobe',
        url: 'https://www.infomoney.com.br/a',
        origin: 'www.infomoney.com.br',
        period: null,
        dataBase: null,
      },
    ]);
  });

  it('sem documentos recuperados, devolve o corpo e nenhuma citação', () => {
    const resposta =
      'Não encontrei dados sobre essa empresa.\n\nFontes: nenhum documento recuperado.';

    expect(parseAnswer(resposta)).toEqual({
      body: 'Não encontrei dados sobre essa empresa.',
      citations: [],
    });
  });

  it('sem bloco Fontes, o texto todo é o corpo', () => {
    expect(parseAnswer('  Só o corpo.  ')).toEqual({ body: 'Só o corpo.', citations: [] });
  });

  it('usa o último bloco Fontes quando o corpo também menciona "Fontes:"', () => {
    const resposta =
      'Resumo.\n\nFontes: as da CVM.\n\nFontes:\n- [web: Notícia] https://noticias.com/a';
    const { body, citations } = parseAnswer(resposta);

    expect(body).toBe('Resumo.\n\nFontes: as da CVM.');
    expect(citations.map((c) => c.url)).toEqual(['https://noticias.com/a']);
  });

  it('ignora linhas fora dos dois formatos e URLs que não são http(s)', () => {
    const resposta = [
      'Corpo.',
      '',
      'Fontes:',
      '- uma linha qualquer',
      '- [web: Malicioso] javascript:alert(1)',
      '- [web: Inválido] não-é-url',
      '- [web: Válida] https://noticias.com/b',
    ].join('\n');

    expect(parseAnswer(resposta).citations.map((c) => c.label)).toEqual(['web: Válida']);
  });
});
