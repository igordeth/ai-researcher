import type { SearchResult } from '../search/types.js';

/**
 * Fixtures da busca na web para o modo DEMO: o que o provider "encontra" e o HTML de cada página.
 *
 * O texto é escrito para a demonstração e diz isso na própria página. Não é notícia real nem
 * captura de site: fala do que costuma explicar cada tipo de variação, sem números nem fatos
 * inventados sobre as empresas. Os domínios terminam em .example, reservado pela RFC 2606 para
 * exemplos, e por isso nunca apontam para um site de verdade. Também servem para apagar o que a
 * demo gravou: `DELETE FROM documentos_web WHERE source_url LIKE 'https://%.example/%'`.
 */
export interface FixtureBusca {
  // Termos procurados na query, em minúsculas e sem acento: o ticker e o nome da empresa.
  termos: string[];
  resultados: SearchResult[];
}

const AVISO = 'Conteúdo de demonstração do AI Researcher, sem valor informativo real.';

function pagina(titulo: string, paragrafos: string[]): string {
  const corpo = paragrafos.map((p) => `<p>${p}</p>`).join('\n');
  return `<!doctype html>
<html lang="pt-BR">
<head><title>${titulo}</title></head>
<body>
<article>
<h1>${titulo}</h1>
<p><em>${AVISO}</em></p>
${corpo}
</article>
</body>
</html>`;
}

export const FIXTURES_BUSCA: FixtureBusca[] = [
  {
    // B01 (queda de receita do 4T25 para o 1T26) e B02 (guidance de produção de minério).
    termos: ['vale3', 'vale'],
    resultados: [
      {
        title: 'Vale: o que move a receita de uma mineradora entre trimestres (demo)',
        snippet:
          'Preço do minério de ferro, volume embarcado e sazonalidade do primeiro trimestre.',
        url: 'https://noticias.demo.example/vale-receita-trimestre',
      },
      {
        title: 'Vale: como ler o guidance de produção de minério de ferro (demo)',
        snippet: 'O guidance anual de produção é divulgado pela empresa em relatório próprio.',
        url: 'https://noticias.demo.example/vale-guidance-producao',
      },
    ],
  },
  {
    // B03 (fato relevante recente).
    termos: ['petr3', 'petr4', 'petrobras'],
    resultados: [
      {
        title: 'Petrobras: onde consultar fatos relevantes (demo)',
        snippet: 'Fatos relevantes são publicados no sistema da CVM e no site de RI da empresa.',
        url: 'https://noticias.demo.example/petrobras-fatos-relevantes',
      },
    ],
  },
  {
    // B05 (motivo do prejuízo do 1T26).
    termos: ['klbn11', 'klbn3', 'klbn4', 'klabin'],
    resultados: [
      {
        title: 'Klabin: o que explica prejuízo em empresas de papel e celulose (demo)',
        snippet: 'Câmbio sobre a dívida em dólar, preço da celulose e paradas de manutenção.',
        url: 'https://noticias.demo.example/klabin-prejuizo-trimestre',
      },
    ],
  },
];

/** Para pergunta sem fixture cadastrada: a demo segue, e a resposta diz que o contexto é parcial. */
export const FIXTURE_GENERICA: FixtureBusca = {
  termos: [],
  resultados: [
    {
      title: 'Resultado genérico do modo demonstração',
      snippet: 'Nenhuma fixture cadastrada para esta pergunta.',
      url: 'https://noticias.demo.example/generico',
    },
  ],
};

export const PAGINAS: Record<string, string> = {
  'https://noticias.demo.example/vale-receita-trimestre': pagina(
    'Vale: o que move a receita de uma mineradora entre trimestres',
    [
      'A receita de uma mineradora de minério de ferro depende sobretudo de dois fatores: o preço de referência do minério no mercado internacional e o volume embarcado no período.',
      'O primeiro trimestre costuma ter volume menor que o quarto, por causa do período de chuvas no Brasil, que afeta a operação das minas e o transporte até os portos.',
      'Como o minério é vendido em dólar, a variação do câmbio também altera a receita reportada em reais.',
    ],
  ),
  'https://noticias.demo.example/vale-guidance-producao': pagina(
    'Vale: como ler o guidance de produção de minério de ferro',
    [
      'O guidance de produção é a faixa de volume que a empresa espera produzir no ano, divulgada no seu relatório de produção e vendas, e não nos demonstrativos financeiros enviados à CVM.',
      'Por isso, um corpus feito só de indicadores financeiros trimestrais não traz o guidance: é preciso consultar o relatório operacional da própria empresa.',
    ],
  ),
  'https://noticias.demo.example/petrobras-fatos-relevantes': pagina(
    'Petrobras: onde consultar fatos relevantes',
    [
      'Fato relevante é a comunicação obrigatória de qualquer acontecimento que possa influenciar a cotação das ações. As companhias abertas o publicam no sistema Empresas.NET da CVM e no seu site de relações com investidores.',
      'Os demonstrativos trimestrais (ITR) e anuais (DFP) não trazem fatos relevantes: para saber se houve um recente, a fonte é a lista de comunicados da própria Petrobras.',
    ],
  ),
  'https://noticias.demo.example/klabin-prejuizo-trimestre': pagina(
    'Klabin: o que explica prejuízo em empresas de papel e celulose',
    [
      'Em empresas exportadoras de papel e celulose com dívida em dólar, a variação cambial costuma ter grande peso no resultado financeiro: a alta do dólar aumenta a dívida em reais e pode levar a prejuízo contábil mesmo com a operação gerando caixa.',
      'O preço internacional da celulose e as paradas programadas de manutenção das fábricas são outros fatores que mudam o resultado de um trimestre para o outro.',
      'O motivo de um prejuízo específico é explicado pela própria empresa no seu release de resultados.',
    ],
  ),
  'https://noticias.demo.example/generico': pagina('Resultado genérico do modo demonstração', [
    'O modo demonstração não tem uma fixture cadastrada para esta pergunta. Em uso real, a busca na web traria páginas sobre o assunto pesquisado.',
  ]),
};

/** A página para um URL que nenhuma fixture conhece. */
export const PAGINA_GENERICA = PAGINAS['https://noticias.demo.example/generico'];
