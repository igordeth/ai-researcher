import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseCsvCvm } from './parse-csv.js';

/**
 * Linhas reais do CSV da CVM (itr_cia_aberta_DRE_con_2025.csv, Vale, 3T25), copiadas do arquivo
 * baixado. O arquivo real é ISO-8859-1 com quebra de linha CRLF, e a fixture é gravada igual:
 * `Buffer.from(texto, 'latin1')` grava "í" como o byte 0xED e "Ú" como 0xDA, um byte cada, e não
 * como os dois bytes do UTF-8 (0xC3 0xAD, 0xC3 0x9A).
 */
const LINHAS = [
  'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA',
  '33.592.510/0001-54;2025-09-30;1;VALE S.A.;004170;DF Consolidado - Demonstração do Resultado;REAL;MIL;PENÚLTIMO;2024-07-01;2024-09-30;3.01;Receita de Venda de Bens e/ou Serviços;52978000.0000000000;S',
  '33.592.510/0001-54;2025-09-30;1;VALE S.A.;004170;DF Consolidado - Demonstração do Resultado;REAL;MIL;ÚLTIMO;2025-07-01;2025-09-30;3.01;Receita de Venda de Bens e/ou Serviços;56701000.0000000000;S',
  '33.592.510/0001-54;2025-09-30;1;VALE S.A.;004170;DF Consolidado - Demonstração do Resultado;REAL;MIL;ÚLTIMO;2025-07-01;2025-09-30;3.11;Lucro/Prejuízo Consolidado do Período;14671000.0000000000;S',
];
const BYTES_LATIN1 = Buffer.from(`${LINHAS.join('\r\n')}\r\n`, 'latin1');

let dir: string;
let arquivo: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'parse-csv-'));
  arquivo = path.join(dir, 'itr_cia_aberta_DRE_con_2025.csv');
  writeFileSync(arquivo, BYTES_LATIN1);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('a fixture', () => {
  it('é latin1 de verdade: um byte por acento, e inválida como UTF-8', () => {
    expect(BYTES_LATIN1.includes(Buffer.from([0xed]))).toBe(true); // í
    expect(BYTES_LATIN1.includes(Buffer.from([0xda]))).toBe(true); // Ú
    expect(BYTES_LATIN1.includes(Buffer.from([0xc3]))).toBe(false); // nenhum byte inicial de UTF-8
    // Lidos como UTF-8, os bytes soltos viram o caractere de substituição.
    expect(BYTES_LATIN1.toString('utf8')).toContain('�');
  });
});

describe('parseCsvCvm', () => {
  it('decodifica os acentos de ISO-8859-1', () => {
    const [, , lucro] = parseCsvCvm(arquivo);

    expect(lucro.DS_CONTA).toBe('Lucro/Prejuízo Consolidado do Período');
    expect(lucro.GRUPO_DFP).toBe('DF Consolidado - Demonstração do Resultado');
  });

  it('decodifica ORDEM_EXERC igual ao literal que select-quarters compara', () => {
    // select-quarters filtra por `ORDEM_EXERC === 'ÚLTIMO'`. Com a decodificação errada, o valor
    // viria 'PEN�LTIMO' e nenhuma conta seria encontrada, sem erro nenhum.
    const linhas = parseCsvCvm(arquivo);

    expect(linhas.map((l) => l.ORDEM_EXERC)).toEqual(['PENÚLTIMO', 'ÚLTIMO', 'ÚLTIMO']);
  });

  it('indexa cada linha pelo cabeçalho, com os valores como texto', () => {
    const [, receita] = parseCsvCvm(arquivo);

    expect(receita).toMatchObject({
      CD_CVM: '004170',
      DT_REFER: '2025-09-30',
      VERSAO: '1',
      DT_INI_EXERC: '2025-07-01',
      CD_CONTA: '3.01',
      DS_CONTA: 'Receita de Venda de Bens e/ou Serviços',
      VL_CONTA: '56701000.0000000000',
      ST_CONTA_FIXA: 'S',
    });
  });

  it('não deixa o \\r do CRLF no último campo, nem cria linha para a quebra final', () => {
    const linhas = parseCsvCvm(arquivo);

    expect(linhas).toHaveLength(3);
    expect(linhas.every((l) => l.ST_CONTA_FIXA === 'S')).toBe(true);
  });

  it('preenche com texto vazio o campo que falta no fim da linha', () => {
    const curto = path.join(dir, 'curto.csv');
    writeFileSync(curto, Buffer.from('CD_CONTA;DS_CONTA;VL_CONTA\r\n3.01;Receita\r\n', 'latin1'));

    expect(parseCsvCvm(curto)).toEqual([{ CD_CONTA: '3.01', DS_CONTA: 'Receita', VL_CONTA: '' }]);
  });
});
