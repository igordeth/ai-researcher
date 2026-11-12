import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LinhaDocumentoWeb } from '../db/replace-web-page.js';
import { makeWebSearchNode } from '../nodes/web-search.js';
import { extrairTexto } from '../web/extract.js';
import { buscarPaginaDemo } from './buscar-pagina-demo.js';
import { FIXTURE_GENERICA, FIXTURES_BUSCA, PAGINA_GENERICA, PAGINAS } from './fixtures.js';
import { modoDemoAtivo } from './modo-demo.js';
import { encontrarFixture, makeDemoSearchProvider } from './search-provider-demo.js';

// As perguntas vêm do dataset de avaliação, e não copiadas: se o texto mudar lá, o teste acompanha.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(
  readFileSync(path.join(HERE, '../../../../evals/dataset.json'), 'utf8'),
) as { id: string; pergunta: string }[];
function pergunta(id: string): string {
  const item = dataset.find((p) => p.id === id);
  if (!item) throw new Error(`${id} não está no evals/dataset.json`);
  return item.pergunta;
}

const [VALE, PETROBRAS, KLABIN] = FIXTURES_BUSCA;

describe('modoDemoAtivo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
  ])('DEMO=%s → %s', (valor, esperado) => {
    vi.stubEnv('DEMO', valor);
    expect(modoDemoAtivo()).toBe(esperado);
  });

  it.each(['1', 'TRUE', 'sim'])('recusa DEMO=%s em vez de o ignorar', (valor) => {
    vi.stubEnv('DEMO', valor);
    expect(() => modoDemoAtivo()).toThrow(`DEMO inválido: "${valor}"`);
  });
});

describe('encontrarFixture com as perguntas do grupo B', () => {
  it.each([
    ['B01', VALE],
    ['B02', VALE],
    ['B03', PETROBRAS],
    ['B05', KLABIN],
  ])('%s cai na fixture da empresa certa', (id, fixture) => {
    expect(encontrarFixture(pergunta(id))).toBe(fixture);
  });

  it('casa também a query que o webSearch monta, pergunta + aspecto em falta', () => {
    expect(encontrarFixture(`${pergunta('B05')} motivo do prejuízo`)).toBe(KLABIN);
  });

  it('casa pelo ticker, sem distinguir maiúsculas nem acentos', () => {
    expect(encontrarFixture('Resultado de VALE3 no trimestre')).toBe(VALE);
    expect(encontrarFixture('notícias da PETROBRÁS')).toBe(PETROBRAS);
    expect(encontrarFixture('klbn11 prejuízo')).toBe(KLABIN);
  });

  it('casa só a palavra inteira: "valeu" e "equivale" não são a Vale', () => {
    expect(encontrarFixture('Isso valeu a pena?')).toBe(FIXTURE_GENERICA);
    expect(encontrarFixture('O lucro equivale a quanto?')).toBe(FIXTURE_GENERICA);
  });

  it('limitação conhecida: "vale a pena" casa com a Vale, porque é a mesma palavra', () => {
    expect(encontrarFixture('Vale a pena olhar o caixa?')).toBe(VALE);
  });

  it('pergunta sem fixture cadastrada cai na genérica (B04, Totvs)', () => {
    expect(encontrarFixture(pergunta('B04'))).toBe(FIXTURE_GENERICA);
  });

  it('o provider nunca lança erro, nem com query vazia', async () => {
    await expect(makeDemoSearchProvider().search('')).resolves.toEqual(FIXTURE_GENERICA.resultados);
  });
});

describe('buscarPaginaDemo', () => {
  it('tem uma página para cada resultado de cada fixture', () => {
    const urls = [...FIXTURES_BUSCA, FIXTURE_GENERICA].flatMap((f) =>
      f.resultados.map((r) => r.url),
    );

    expect(urls.filter((url) => !(url in PAGINAS))).toEqual([]);
  });

  it('devolve o HTML da fixture, com o URL pedido como URL final', async () => {
    const url = KLABIN.resultados[0].url;

    expect(await buscarPaginaDemo(url)).toEqual({ html: PAGINAS[url], urlFinal: url });
  });

  it('devolve a página genérica para um URL desconhecido, sem lançar erro', async () => {
    const { html } = await buscarPaginaDemo('https://outro.example/qualquer');

    expect(html).toBe(PAGINA_GENERICA);
  });

  it('toda página tem texto legível e diz que é conteúdo de demonstração', () => {
    for (const html of Object.values(PAGINAS)) {
      const texto = extrairTexto(html);
      expect(texto).toContain('Conteúdo de demonstração do AI Researcher');
      expect(texto.length).toBeGreaterThan(100);
    }
  });

  it('só usa domínios .example, que nunca apontam para um site real', () => {
    for (const url of Object.keys(PAGINAS)) {
      expect(new URL(url).hostname.endsWith('.example')).toBe(true);
    }
  });
});

describe('o nó webSearch com as fixtures do modo demo', () => {
  it('grava as páginas da Klabin para a pergunta B05, sem rede', async () => {
    const gravadas = new Map<string, LinhaDocumentoWeb[]>();
    const webSearch = makeWebSearchNode({
      searchProvider: makeDemoSearchProvider(),
      buscarPagina: buscarPaginaDemo,
      // Os embeddings reais continuam na Vertex AI; aqui um fake, porque o teste não usa rede.
      embeddings: { embedDocuments: async (textos) => textos.map(() => [0.1, 0.2]) },
      gravarPagina: async (url, linhas) => {
        gravadas.set(url, linhas);
      },
    });
    const fetchReal = vi.fn();
    vi.stubGlobal('fetch', fetchReal);

    await webSearch({ question: pergunta('B05'), missingAspects: ['motivo do prejuízo'] });

    expect([...gravadas.keys()]).toEqual([
      'https://noticias.demo.example/klabin-prejuizo-trimestre',
    ]);
    expect(
      gravadas.get('https://noticias.demo.example/klabin-prejuizo-trimestre')?.[0].content,
    ).toContain('variação cambial');
    expect(fetchReal).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
