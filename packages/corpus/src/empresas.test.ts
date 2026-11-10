import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerEmpresas } from './empresas.js';

function csvTemporario(conteudo: string): string {
  const pasta = mkdtempSync(path.join(tmpdir(), 'empresas-'));
  const arquivo = path.join(pasta, 'empresas.csv');
  writeFileSync(arquivo, conteudo, 'utf-8');
  return arquivo;
}

const CABECALHO = 'ticker,razao_social,cd_cvm,setor';
const LINHA_VALE = 'VALE,Vale S.A.,4170,Extração Mineral';

describe('lerEmpresas', () => {
  it('lê o CSV com quebra de linha LF', () => {
    const arquivo = csvTemporario(`${CABECALHO}\n${LINHA_VALE}\n`);

    expect(lerEmpresas(arquivo)).toEqual([
      { ticker: 'VALE', razaoSocial: 'Vale S.A.', cdCvm: '004170', setor: 'Extração Mineral' },
    ]);
  });

  it('lê o CSV com quebra de linha CRLF sem perder o último campo', () => {
    const arquivo = csvTemporario(`${CABECALHO}\r\n${LINHA_VALE}\r\n`);

    expect(lerEmpresas(arquivo)).toEqual([
      { ticker: 'VALE', razaoSocial: 'Vale S.A.', cdCvm: '004170', setor: 'Extração Mineral' },
    ]);
  });
});
