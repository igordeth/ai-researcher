import { describe, expect, it, vi } from 'vitest';

import { comResiliencia, falhaTransitoria, type OpcoesResiliencia } from './resiliencia.js';
import { SearchProviderError, type SearchResult } from './types.js';

const RESULTADOS: SearchResult[] = [{ title: 't', snippet: 's', url: 'https://exemplo.com' }];

const semResposta = () => new SearchProviderError('Fake', 'sem-resposta', 'timeout');
const http = (status: number) =>
  new SearchProviderError('Fake', 'http', `respondeu ${status}`, { status });
const formato = () => new SearchProviderError('Fake', 'formato', 'fora do formato');

/**
 * Monta o decorador com relógio e espera falsos: `esperas` guarda cada backoff pedido, sem esperar
 * de verdade, e `avancar` move o relógio. `respostas` é a sequência do provider envolvido: um
 * erro é lançado, um array é devolvido; a última repete-se.
 */
function montar(respostas: (SearchResult[] | Error)[], opcoes: Partial<OpcoesResiliencia> = {}) {
  let relogio = 0;
  const esperas: number[] = [];
  const search = vi.fn(async () => {
    const resposta = respostas.length > 1 ? respostas.shift() : respostas[0];
    if (resposta instanceof Error) throw resposta;
    return resposta as SearchResult[];
  });

  const provider = comResiliencia(
    { search },
    {
      nome: 'Fake',
      esperar: async (ms) => {
        esperas.push(ms);
      },
      agora: () => relogio,
      ...opcoes,
    },
  );

  return {
    provider,
    search,
    esperas,
    avancar: (ms: number) => {
      relogio += ms;
    },
  };
}

async function motivoDaFalha(promessa: Promise<unknown>): Promise<string | undefined> {
  const erro = await promessa.catch((e: unknown) => e);
  return erro instanceof SearchProviderError ? erro.motivo : undefined;
}

describe('falhaTransitoria', () => {
  it.each([
    ['timeout ou rede', semResposta(), true],
    ['429', http(429), true],
    ['500', http(500), true],
    ['503', http(503), true],
    ['400', http(400), false],
    ['401', http(401), false],
    ['403', http(403), false],
    ['formato', formato(), false],
    ['erro que não é do provider', new TypeError('bug'), false],
  ])('%s → %s', (_caso, erro, esperado) => {
    expect(falhaTransitoria(erro)).toBe(esperado);
  });
});

describe('comResiliencia: retry com backoff', () => {
  it('devolve na primeira tentativa, sem esperar', async () => {
    const { provider, search, esperas } = montar([RESULTADOS]);

    expect(await provider.search('q')).toBe(RESULTADOS);
    expect(search).toHaveBeenCalledTimes(1);
    expect(esperas).toEqual([]);
  });

  it('tenta de novo após falha transitória, com espera que dobra: 500 e 1000 ms', async () => {
    const { provider, search, esperas } = montar([semResposta(), http(503), RESULTADOS]);

    expect(await provider.search('q')).toBe(RESULTADOS);
    expect(search).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([500, 1000]);
  });

  it('desiste em maxTentativas e lança a última falha', async () => {
    const { provider, search, esperas } = montar([semResposta(), semResposta(), http(502)]);

    const erro = await provider.search('q').catch((e: unknown) => e);

    expect((erro as SearchProviderError).status).toBe(502);
    expect(search).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([500, 1000]);
  });

  it('respeita maxTentativas e esperaInicialMs configurados', async () => {
    const { provider, search, esperas } = montar([semResposta()], {
      maxTentativas: 4,
      esperaInicialMs: 100,
      falhasParaAbrir: 10,
    });

    await provider.search('q').catch(() => undefined);

    expect(search).toHaveBeenCalledTimes(4);
    expect(esperas).toEqual([100, 200, 400]);
  });

  it.each([
    ['401, chave errada', http(401)],
    ['resposta fora do formato', formato()],
    ['erro que não é do provider', new TypeError('bug')],
  ])('não tenta de novo com %s', async (_caso, erro) => {
    const { provider, search, esperas } = montar([erro]);

    await expect(provider.search('q')).rejects.toBe(erro);
    expect(search).toHaveBeenCalledTimes(1);
    expect(esperas).toEqual([]);
  });
});

describe('comResiliencia: circuit breaker', () => {
  // Uma tentativa por chamada: cada chamada que falha é uma falha, e a conta fica fácil de ler.
  const UMA_TENTATIVA = { maxTentativas: 1, falhasParaAbrir: 3, resfriamentoMs: 30_000 };

  it('abre depois de falhasParaAbrir falhas seguidas, e falha na hora sem chamar o provider', async () => {
    const { provider, search } = montar([semResposta()], UMA_TENTATIVA);

    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);
    expect(search).toHaveBeenCalledTimes(3);

    expect(await motivoDaFalha(provider.search('q'))).toBe('circuito-aberto');
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('a mensagem do circuito aberto diz qual provider', async () => {
    const { provider } = montar([semResposta()], UMA_TENTATIVA);
    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);

    await expect(provider.search('q')).rejects.toThrow('Fake: circuito aberto');
  });

  it('conta falhas por tentativa: abre a meio dos retries e não espera o backoff à toa', async () => {
    const { provider, search, esperas } = montar([semResposta()], {
      maxTentativas: 3,
      falhasParaAbrir: 2,
    });

    const erro = await provider.search('q').catch((e: unknown) => e);

    // A 2ª tentativa abre o circuito: lança a falha real, sem a 3ª tentativa nem a 2ª espera.
    expect((erro as SearchProviderError).motivo).toBe('sem-resposta');
    expect(search).toHaveBeenCalledTimes(2);
    expect(esperas).toEqual([500]);
  });

  it('um sucesso zera a contagem: as falhas têm de ser seguidas', async () => {
    const { provider, search } = montar(
      [semResposta(), semResposta(), RESULTADOS, semResposta(), semResposta(), RESULTADOS],
      UMA_TENTATIVA,
    );

    for (let i = 0; i < 6; i += 1) await provider.search('q').catch(() => undefined);

    expect(search).toHaveBeenCalledTimes(6);
  });

  it('erro que mostra o serviço de pé (401, formato) também zera a contagem', async () => {
    const { provider, search } = montar(
      [semResposta(), semResposta(), http(401), semResposta(), semResposta(), RESULTADOS],
      UMA_TENTATIVA,
    );

    for (let i = 0; i < 6; i += 1) await provider.search('q').catch(() => undefined);

    expect(search).toHaveBeenCalledTimes(6);
  });

  it('continua aberto até o resfriamento passar inteiro', async () => {
    const { provider, search, avancar } = montar([semResposta()], UMA_TENTATIVA);
    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);

    avancar(29_999);

    expect(await motivoDaFalha(provider.search('q'))).toBe('circuito-aberto');
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('passado o resfriamento, deixa passar uma tentativa de teste e fecha se ela der certo', async () => {
    const { provider, search, avancar } = montar(
      [semResposta(), semResposta(), semResposta(), RESULTADOS],
      UMA_TENTATIVA,
    );
    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);

    avancar(30_000);

    expect(await provider.search('q')).toBe(RESULTADOS);
    expect(await provider.search('q')).toBe(RESULTADOS);
    expect(search).toHaveBeenCalledTimes(5);
  });

  it('se a tentativa de teste falhar, abre de novo por mais um resfriamento', async () => {
    const { provider, search, avancar } = montar([semResposta()], UMA_TENTATIVA);
    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);

    avancar(30_000);
    await provider.search('q').catch(() => undefined); // a tentativa de teste, que falha
    expect(search).toHaveBeenCalledTimes(4);

    // Uma só falha basta para reabrir: não espera mais três.
    avancar(29_999);
    expect(await motivoDaFalha(provider.search('q'))).toBe('circuito-aberto');
    expect(search).toHaveBeenCalledTimes(4);
  });

  it('durante a tentativa de teste, as outras chamadas falham na hora', async () => {
    let liberarTeste: (r: SearchResult[]) => void = () => undefined;
    const { provider, search, avancar } = montar([semResposta()], UMA_TENTATIVA);
    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);
    search.mockImplementationOnce(
      () => new Promise<SearchResult[]>((resolve) => (liberarTeste = resolve)),
    );

    avancar(30_000);
    const teste = provider.search('q');
    const concorrente = provider.search('q');

    expect(await motivoDaFalha(concorrente)).toBe('circuito-aberto');
    liberarTeste(RESULTADOS);
    expect(await teste).toBe(RESULTADOS);
    expect(search).toHaveBeenCalledTimes(4);
  });

  it('a tentativa de teste que recebe 401 fecha o circuito: o serviço respondeu', async () => {
    const { provider, search, avancar } = montar(
      [semResposta(), semResposta(), semResposta(), http(401), RESULTADOS],
      UMA_TENTATIVA,
    );
    for (let i = 0; i < 3; i += 1) await provider.search('q').catch(() => undefined);

    avancar(30_000);
    await provider.search('q').catch(() => undefined);

    expect(await provider.search('q')).toBe(RESULTADOS);
    expect(search).toHaveBeenCalledTimes(5);
  });
});
