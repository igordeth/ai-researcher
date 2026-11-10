import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Empresa } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EMPRESAS_CSV = path.join(HERE, '../data/empresas.csv');

export function lerEmpresas(csvPath: string = EMPRESAS_CSV): Empresa[] {
  const conteudo = readFileSync(csvPath, 'utf-8');
  // \r?\n e não só \n: no Windows, com core.autocrlf=true, o Git entrega o CSV com CRLF.
  // Separando só por \n, o \r grudava no último campo — o cabeçalho virava "setor\r",
  // registro.setor ficava undefined e o JSON.stringify sumia com o campo sem avisar.
  const [linhaHeader, ...linhas] = conteudo.trim().split(/\r?\n/);
  const header = linhaHeader.split(',');

  return linhas
    .filter((linha) => linha.trim().length > 0)
    .map((linha) => {
      const campos = linha.split(',');
      const registro = Object.fromEntries(header.map((chave, i) => [chave, campos[i]]));
      return {
        ticker: registro.ticker,
        razaoSocial: registro.razao_social,
        cdCvm: registro.cd_cvm.padStart(6, '0'),
        setor: registro.setor,
      };
    });
}
