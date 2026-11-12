import { describe, expect, it } from 'vitest';
import type { LinhaCvm } from '../types.js';
import {
  buscarConta,
  buscarContaPorDescricao,
  candidatosTrimestres,
  CONTAS,
  DESCRICOES_LUCRO_LIQUIDO,
  DESCRICOES_PATRIMONIO_LIQUIDO,
  demonstrativosDaEmpresa,
  inicioTrimestreIso,
  periodEndIso,
  periodoLabel,
  subtrairValorConta,
  valorConta,
  type DemonstrativosAno,
} from './select-quarters.js';

/**
 * Uma linha da CVM já parseada. O padrão é a DRE do 3T25 (ÚLTIMO, trimestre de julho a setembro);
 * cada teste muda só o que importa. Os códigos, descrições e valores vêm dos CSVs reais do ITR e da
 * DFP 2025, salvo quando o teste diz que o caso é sintético.
 */
function linha(campos: Partial<LinhaCvm>): LinhaCvm {
  return {
    CD_CVM: '004170',
    DT_REFER: '2025-09-30',
    VERSAO: '1',
    ESCALA_MOEDA: 'MIL',
    ORDEM_EXERC: 'ÚLTIMO',
    DT_INI_EXERC: '2025-07-01',
    CD_CONTA: '3.01',
    DS_CONTA: 'Receita de Venda de Bens e/ou Serviços',
    VL_CONTA: '0.0000000000',
    ST_CONTA_FIXA: 'S',
    ...campos,
  };
}

const DT_3T25 = '2025-09-30';
const INICIO_3T25 = '2025-07-01';

describe('buscarContaPorDescricao: a posição da conta muda com o setor', () => {
  it('acha o lucro líquido da Vale (industrial) em 3.11, ignorando as linhas vizinhas', () => {
    const dre = [
      linha({
        CD_CONTA: '3.07',
        DS_CONTA: 'Resultado Antes dos Tributos sobre o Lucro',
        VL_CONTA: '14227000.0000000000',
      }),
      linha({
        CD_CONTA: '3.10.01',
        DS_CONTA: 'Lucro/Prejuízo Líquido das Operações Descontinuadas',
      }),
      linha({
        CD_CONTA: '3.11',
        DS_CONTA: 'Lucro/Prejuízo Consolidado do Período',
        VL_CONTA: '14671000.0000000000',
      }),
    ];

    const lucro = buscarContaPorDescricao(
      dre,
      DESCRICOES_LUCRO_LIQUIDO,
      DT_3T25,
      'ÚLTIMO',
      INICIO_3T25,
    );

    expect(lucro?.CD_CONTA).toBe('3.11');
    expect(lucro?.VL_CONTA).toBe('14671000.0000000000');
  });

  it('acha o lucro líquido do Itaú (banco) em 3.09, onde o código 3.11 não é o lucro', () => {
    const dre = [
      linha({
        CD_CVM: '019348',
        CD_CONTA: '3.05',
        DS_CONTA: 'Resultado Antes dos Tributos sobre o Lucro',
        VL_CONTA: '13719000.0000000000',
      }),
      linha({
        CD_CVM: '019348',
        CD_CONTA: '3.09',
        DS_CONTA: 'Lucro/Prejuízo Consolidado do Período',
        VL_CONTA: '11600000.0000000000',
      }),
    ];

    const lucro = buscarContaPorDescricao(
      dre,
      DESCRICOES_LUCRO_LIQUIDO,
      DT_3T25,
      'ÚLTIMO',
      INICIO_3T25,
    );

    expect(lucro?.CD_CONTA).toBe('3.09');
    expect(buscarConta(dre, '3.11', DT_3T25, 'ÚLTIMO', INICIO_3T25)).toBeUndefined();
  });

  it('acha o lucro líquido do Bradesco (banco) em 3.11, com outra descrição e outros "Lucro ou Prejuízo" antes', () => {
    const dre = [
      linha({
        CD_CVM: '000906',
        CD_CONTA: '3.07',
        DS_CONTA: 'Lucro ou Prejuízo das Operações Continuadas',
        VL_CONTA: '5568016.0000000000',
      }),
      linha({
        CD_CVM: '000906',
        CD_CONTA: '3.09',
        DS_CONTA: 'Lucro ou Prejuízo antes das Participações e Contribuições Estatutárias',
        VL_CONTA: '5568016.0000000000',
      }),
      linha({
        CD_CVM: '000906',
        CD_CONTA: '3.11',
        DS_CONTA: 'Lucro ou Prejuízo Líquido Consolidado do Período',
        VL_CONTA: '5568016.0000000000',
      }),
    ];

    const lucro = buscarContaPorDescricao(
      dre,
      DESCRICOES_LUCRO_LIQUIDO,
      DT_3T25,
      'ÚLTIMO',
      INICIO_3T25,
    );

    expect(lucro?.CD_CONTA).toBe('3.11');
  });

  it('acha o patrimônio líquido em 2.03, 2.08 ou 2.07 conforme a empresa, sem cair nas sub-linhas', () => {
    // Balanço não tem DT_INI_EXERC: a busca é chamada sem ele.
    const bpp = (cdCvm: string, cdConta: string) => [
      linha({
        CD_CVM: cdCvm,
        CD_CONTA: cdConta,
        DS_CONTA: 'Patrimônio Líquido Consolidado',
        DT_INI_EXERC: undefined,
      }),
      linha({
        CD_CVM: cdCvm,
        CD_CONTA: `${cdConta}.01`,
        DS_CONTA: 'Patrimônio Líquido Atribuído ao Controlador',
        DT_INI_EXERC: undefined,
      }),
    ];

    for (const [cdCvm, cdConta] of [
      ['004170', '2.03'],
      ['019348', '2.08'],
      ['000906', '2.07'],
    ]) {
      const pl = buscarContaPorDescricao(
        bpp(cdCvm, cdConta),
        DESCRICOES_PATRIMONIO_LIQUIDO,
        DT_3T25,
        'ÚLTIMO',
      );
      expect(pl?.CD_CONTA).toBe(cdConta);
    }
  });

  it('com a mesma descrição em dois níveis, fica com a linha-resumo, a de código mais raso (caso sintético)', () => {
    const dre = [
      linha({
        CD_CONTA: '3.11.01',
        DS_CONTA: 'Lucro/Prejuízo do Período',
        VL_CONTA: '1.0000000000',
      }),
      linha({ CD_CONTA: '3.11', DS_CONTA: 'Lucro/Prejuízo do Período', VL_CONTA: '2.0000000000' }),
    ];

    expect(
      buscarContaPorDescricao(dre, DESCRICOES_LUCRO_LIQUIDO, DT_3T25, 'ÚLTIMO', INICIO_3T25)
        ?.CD_CONTA,
    ).toBe('3.11');
  });

  it('ignora a linha com a descrição certa que não é conta fixa da CVM (ST_CONTA_FIXA=N)', () => {
    const dre = [
      linha({ CD_CONTA: '3.11', DS_CONTA: 'Lucro/Prejuízo do Período', ST_CONTA_FIXA: 'N' }),
    ];

    expect(
      buscarContaPorDescricao(dre, DESCRICOES_LUCRO_LIQUIDO, DT_3T25, 'ÚLTIMO', INICIO_3T25),
    ).toBeUndefined();
  });

  it('distingue o trimestre do acumulado do ano pelo DT_INI_EXERC', () => {
    const dre = [
      linha({
        CD_CONTA: '3.11',
        DS_CONTA: 'Lucro/Prejuízo Consolidado do Período',
        DT_INI_EXERC: '2025-01-01',
        VL_CONTA: '35031000.0000000000',
      }),
      linha({
        CD_CONTA: '3.11',
        DS_CONTA: 'Lucro/Prejuízo Consolidado do Período',
        DT_INI_EXERC: '2025-07-01',
        VL_CONTA: '14671000.0000000000',
      }),
    ];

    expect(
      buscarContaPorDescricao(dre, DESCRICOES_LUCRO_LIQUIDO, DT_3T25, 'ÚLTIMO', '2025-07-01')
        ?.VL_CONTA,
    ).toBe('14671000.0000000000');
    expect(
      buscarContaPorDescricao(dre, DESCRICOES_LUCRO_LIQUIDO, DT_3T25, 'ÚLTIMO', '2025-01-01')
        ?.VL_CONTA,
    ).toBe('35031000.0000000000');
  });
});

describe('buscarConta: filtros e versão retificada', () => {
  it('fica com a maior VERSAO quando a empresa retificou o formulário', () => {
    // Caso real: o 1T25 da Vale no DFC está na versão 2.
    const dfc = [
      linha({
        DT_REFER: '2025-03-31',
        DT_INI_EXERC: '2025-01-01',
        CD_CONTA: '6.01',
        VERSAO: '1',
        VL_CONTA: '1.0000000000',
      }),
      linha({
        DT_REFER: '2025-03-31',
        DT_INI_EXERC: '2025-01-01',
        CD_CONTA: '6.01',
        VERSAO: '2',
        VL_CONTA: '9726000.0000000000',
      }),
    ];

    expect(
      buscarConta(dfc, CONTAS.caixaOperacional, '2025-03-31', 'ÚLTIMO', '2025-01-01')?.VL_CONTA,
    ).toBe('9726000.0000000000');
  });

  it('compara VERSAO como número, não como texto: 10 vence 9', () => {
    const dre = [
      linha({ VERSAO: '9', VL_CONTA: '9.0000000000' }),
      linha({ VERSAO: '10', VL_CONTA: '10.0000000000' }),
    ];

    expect(buscarConta(dre, CONTAS.receitaLiquida, DT_3T25, 'ÚLTIMO', INICIO_3T25)?.VERSAO).toBe(
      '10',
    );
  });

  it('separa ÚLTIMO de PENÚLTIMO, que traz o mesmo trimestre do ano anterior', () => {
    // Na linha PENÚLTIMO, DT_REFER é o do formulário atual, mas DT_INI_EXERC é do ano anterior.
    const dre = [
      linha({
        ORDEM_EXERC: 'PENÚLTIMO',
        DT_INI_EXERC: '2024-07-01',
        VL_CONTA: '52978000.0000000000',
      }),
      linha({ ORDEM_EXERC: 'ÚLTIMO', DT_INI_EXERC: '2025-07-01', VL_CONTA: '56701000.0000000000' }),
    ];

    expect(buscarConta(dre, CONTAS.receitaLiquida, DT_3T25, 'ÚLTIMO', INICIO_3T25)?.VL_CONTA).toBe(
      '56701000.0000000000',
    );
    expect(
      buscarConta(dre, CONTAS.receitaLiquida, DT_3T25, 'PENÚLTIMO', inicioTrimestreIso(2024, 9))
        ?.VL_CONTA,
    ).toBe('52978000.0000000000');
  });

  it('sem DT_INI_EXERC na busca (balanço), não filtra por ele', () => {
    const bpa = [
      linha({
        CD_CONTA: '1',
        DS_CONTA: 'Ativo Total',
        DT_INI_EXERC: undefined,
        VL_CONTA: '484953000.0000000000',
      }),
    ];

    expect(buscarConta(bpa, CONTAS.ativoTotal, DT_3T25, 'ÚLTIMO')?.VL_CONTA).toBe(
      '484953000.0000000000',
    );
  });

  it('devolve undefined quando a conta não existe na data pedida', () => {
    const dre = [linha({ DT_REFER: '2025-06-30' })];

    expect(buscarConta(dre, CONTAS.receitaLiquida, DT_3T25, 'ÚLTIMO', INICIO_3T25)).toBeUndefined();
  });
});

describe('demonstrativosDaEmpresa: consolidado, ou individual quando não há', () => {
  function ano(campos: Partial<Record<keyof DemonstrativosAno, LinhaCvm[]>>): DemonstrativosAno {
    const mapa = (linhas?: LinhaCvm[]) => new Map(linhas ? [['004170', linhas]] : []);
    return {
      bpaCon: mapa(campos.bpaCon),
      bpaInd: mapa(campos.bpaInd),
      bppCon: mapa(campos.bppCon),
      bppInd: mapa(campos.bppInd),
      dreCon: mapa(campos.dreCon),
      dreInd: mapa(campos.dreInd),
      dfcCon: mapa(campos.dfcCon),
      dfcInd: mapa(campos.dfcInd),
    };
  }
  const con = [linha({ VL_CONTA: 'con' })];
  const ind = [linha({ VL_CONTA: 'ind' })];

  it('usa as quatro demonstrações consolidadas quando há DRE consolidada', () => {
    const demonstrativos = demonstrativosDaEmpresa(
      ano({
        bpaCon: con,
        bppCon: con,
        dreCon: con,
        dfcCon: con,
        bpaInd: ind,
        bppInd: ind,
        dreInd: ind,
        dfcInd: ind,
      }),
      '004170',
    );

    expect(demonstrativos).toEqual({ bpa: con, bpp: con, dre: con, dfc: con });
  });

  it('cai para as quatro individuais quando não há DRE consolidada (caso Sendas/Assaí)', () => {
    const demonstrativos = demonstrativosDaEmpresa(
      ano({ bpaInd: ind, bppInd: ind, dreInd: ind, dfcInd: ind }),
      '004170',
    );

    expect(demonstrativos).toEqual({ bpa: ind, bpp: ind, dre: ind, dfc: ind });
  });

  it('decide pela DRE e nunca mistura: sem DRE consolidada, ignora um balanço consolidado avulso', () => {
    const demonstrativos = demonstrativosDaEmpresa(
      ano({ bpaCon: con, bpaInd: ind, bppInd: ind, dreInd: ind, dfcInd: ind }),
      '004170',
    );

    expect(demonstrativos?.bpa).toBe(ind);
  });

  it('com DRE consolidada, devolve lista vazia para a demonstração consolidada que falta, sem buscar a individual', () => {
    const demonstrativos = demonstrativosDaEmpresa(ano({ dreCon: con, bpaInd: ind }), '004170');

    expect(demonstrativos?.bpa).toEqual([]);
  });

  it('trata DRE consolidada vazia como ausente', () => {
    const demonstrativos = demonstrativosDaEmpresa(ano({ dreCon: [], dreInd: ind }), '004170');

    expect(demonstrativos?.dre).toBe(ind);
  });

  it('devolve undefined quando a empresa não entregou nenhuma das duas', () => {
    expect(demonstrativosDaEmpresa(ano({}), '004170')).toBeUndefined();
  });
});

describe('trimestre isolado por subtração do acumulado', () => {
  it('4º trimestre = anual da DFP − acumulado de 9 meses do ITR (receita real da Vale em 2025)', () => {
    const dfpDre = [
      linha({
        DT_REFER: '2025-12-31',
        VERSAO: '2',
        DT_INI_EXERC: '2025-01-01',
        VL_CONTA: '213595000.0000000000',
      }),
    ];
    // O ITR do 3T traz duas linhas ÚLTIMO para a mesma conta: o trimestre e o acumulado do ano.
    const itrDre = [
      linha({ DT_INI_EXERC: '2025-07-01', VL_CONTA: '56701000.0000000000' }),
      linha({ DT_INI_EXERC: '2025-01-01', VL_CONTA: '153919000.0000000000' }),
    ];

    const anual = buscarConta(
      dfpDre,
      CONTAS.receitaLiquida,
      periodEndIso(2025, 12),
      'ÚLTIMO',
      '2025-01-01',
    );
    const noveMeses = buscarConta(
      itrDre,
      CONTAS.receitaLiquida,
      periodEndIso(2025, 9),
      'ÚLTIMO',
      '2025-01-01',
    );
    if (!anual || !noveMeses) throw new Error('fixture sem a linha esperada');

    // 59.676.000 mil: o mesmo valor do 4T25 no data/documentos/VALE.json versionado.
    expect(subtrairValorConta(valorConta(anual), valorConta(noveMeses))).toEqual({
      valor: 59676000,
      escalaMoeda: 'MIL',
    });
  });

  it('caixa do 2º trimestre = acumulado do semestre − acumulado do 1º trimestre (DFC só vem acumulado)', () => {
    const dfc = [
      linha({
        DT_REFER: '2025-03-31',
        VERSAO: '2',
        DT_INI_EXERC: '2025-01-01',
        CD_CONTA: '6.01',
        VL_CONTA: '9726000.0000000000',
      }),
      linha({
        DT_REFER: '2025-06-30',
        DT_INI_EXERC: '2025-01-01',
        CD_CONTA: '6.01',
        VL_CONTA: '20292000.0000000000',
      }),
    ];

    const semestre = buscarConta(
      dfc,
      CONTAS.caixaOperacional,
      periodEndIso(2025, 6),
      'ÚLTIMO',
      '2025-01-01',
    );
    const primeiro = buscarConta(
      dfc,
      CONTAS.caixaOperacional,
      periodEndIso(2025, 6 - 3),
      'ÚLTIMO',
      '2025-01-01',
    );
    if (!semestre || !primeiro) throw new Error('fixture sem a linha esperada');

    expect(subtrairValorConta(valorConta(semestre), valorConta(primeiro)).valor).toBe(10566000);
  });

  it('dá resultado negativo quando o trimestre teve prejuízo', () => {
    expect(
      subtrairValorConta(
        { valor: 10_000, escalaMoeda: 'MIL' },
        { valor: 30_000, escalaMoeda: 'MIL' },
      ),
    ).toEqual({ valor: -20_000, escalaMoeda: 'MIL' });
  });

  it('recusa subtrair valores com ESCALA_MOEDA diferente', () => {
    expect(() =>
      subtrairValorConta({ valor: 1, escalaMoeda: 'MIL' }, { valor: 1, escalaMoeda: 'UNIDADE' }),
    ).toThrow('ESCALA_MOEDA divergente');
  });
});

describe('valorConta', () => {
  it('converte VL_CONTA em número e mantém a escala em MIL, sem multiplicar', () => {
    expect(valorConta(linha({ VL_CONTA: '14671000.0000000000' }))).toEqual({
      valor: 14671000,
      escalaMoeda: 'MIL',
    });
  });

  it('reconhece ESCALA_MOEDA=UNIDADE, e trata qualquer outro valor como MIL', () => {
    expect(valorConta(linha({ ESCALA_MOEDA: 'UNIDADE', VL_CONTA: '5' })).escalaMoeda).toBe(
      'UNIDADE',
    );
    expect(valorConta(linha({ ESCALA_MOEDA: '', VL_CONTA: '5' })).escalaMoeda).toBe('MIL');
  });
});

describe('datas', () => {
  it('periodEndIso devolve o último dia de cada fim de trimestre', () => {
    expect([3, 6, 9, 12].map((mes) => periodEndIso(2025, mes))).toEqual([
      '2025-03-31',
      '2025-06-30',
      '2025-09-30',
      '2025-12-31',
    ]);
  });

  it('periodEndIso acerta fevereiro em ano bissexto e não bissexto, incluindo as regras de século', () => {
    // Nenhum fim de trimestre cai em fevereiro, por isso a coleta nunca passa por aqui. O teste
    // confere a técnica Date.UTC(ano, mes, 0), "dia 0 do mês seguinte", em que a função se apoia.
    expect(periodEndIso(2024, 2)).toBe('2024-02-29');
    expect(periodEndIso(2025, 2)).toBe('2025-02-28');
    expect(periodEndIso(2000, 2)).toBe('2000-02-29');
    expect(periodEndIso(1900, 2)).toBe('1900-02-28');
  });

  it('inicioTrimestreIso devolve o primeiro dia do trimestre', () => {
    expect(([3, 6, 9, 12] as const).map((mes) => inicioTrimestreIso(2025, mes))).toEqual([
      '2025-01-01',
      '2025-04-01',
      '2025-07-01',
      '2025-10-01',
    ]);
  });

  it('periodoLabel monta o rótulo do trimestre', () => {
    expect(periodoLabel(3, 2025)).toBe('1T25');
    expect(periodoLabel(9, 2025)).toBe('3T25');
    expect(periodoLabel(12, 2025)).toBe('4T25');
    expect(periodoLabel(6, 2030)).toBe('2T30');
  });

  it('candidatosTrimestres começa no trimestre de hoje e anda para trás, virando o ano', () => {
    expect(candidatosTrimestres(new Date('2026-11-12T12:00:00Z'), 5)).toEqual([
      { ano: 2026, mes: 12 },
      { ano: 2026, mes: 9 },
      { ano: 2026, mes: 6 },
      { ano: 2026, mes: 3 },
      { ano: 2025, mes: 12 },
    ]);
  });

  it('candidatosTrimestres em 1º de janeiro começa no 1º trimestre do ano novo', () => {
    expect(candidatosTrimestres(new Date('2026-01-01T00:00:00Z'), 2)).toEqual([
      { ano: 2026, mes: 3 },
      { ano: 2025, mes: 12 },
    ]);
  });

  it('candidatosTrimestres usa o mês em UTC, não o fuso local', () => {
    // 31/03 às 23h30 em Brasília já é 1º de abril em UTC: o trimestre de partida é o 2º.
    expect(candidatosTrimestres(new Date('2026-03-31T23:30:00-03:00'), 1)).toEqual([
      { ano: 2026, mes: 6 },
    ]);
  });
});
