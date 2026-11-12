import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerEmpresas } from '../empresas.js';
import { coletarUltimosTrimestres } from './select-quarters.js';
import { paraCanonico } from '../normalize/to-canonical.js';
import { gerarParagrafo } from '../paragraphs/template.js';
import type { DocumentoFinal, IndicadorTrimestral, PeriodoColetado } from '../types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTOS_DIR = path.join(HERE, '../../data/documentos');

function agruparPorTicker(periodos: PeriodoColetado[]): Map<string, PeriodoColetado[]> {
  const porTicker = new Map<string, PeriodoColetado[]>();
  for (const periodo of periodos) {
    const lista = porTicker.get(periodo.empresa.ticker);
    if (lista) lista.push(periodo);
    else porTicker.set(periodo.empresa.ticker, [periodo]);
  }
  return porTicker;
}

/** Liga cada trimestre ao imediatamente anterior da mesma janela (para a comparação QoQ) e gera o parágrafo. */
export function montarDocumentos(indicadores: IndicadorTrimestral[]): DocumentoFinal[] {
  const ordenados = [...indicadores].sort((a, b) => a.period_end.localeCompare(b.period_end));

  return ordenados.map((indicador, i) => {
    const anterior = ordenados[i - 1];
    const comparacoes = anterior
      ? { trimestreAnterior: { valor: anterior.receita_liquida, period: anterior.period } }
      : {};
    return { ...indicador, paragraph: gerarParagrafo(indicador, comparacoes) };
  });
}

export async function coletar(): Promise<void> {
  const empresas = lerEmpresas();
  console.log(`Coletando os últimos 4 trimestres para ${empresas.length} empresas...`);

  const periodos = await coletarUltimosTrimestres(empresas);
  const fetchedAt = new Date().toISOString();
  const porTicker = agruparPorTicker(periodos);

  mkdirSync(DOCUMENTOS_DIR, { recursive: true });

  for (const empresa of empresas) {
    const periodosEmpresa = porTicker.get(empresa.ticker) ?? [];
    if (periodosEmpresa.length === 0) {
      console.warn(`${empresa.ticker}: nenhum trimestre coletado.`);
      continue;
    }

    const indicadores = periodosEmpresa.map((periodo) => paraCanonico(periodo, fetchedAt));
    const documentos = montarDocumentos(indicadores);

    writeFileSync(
      path.join(DOCUMENTOS_DIR, `${empresa.ticker}.json`),
      `${JSON.stringify(documentos, null, 2)}\n`,
    );
    console.log(`${empresa.ticker}: ${documentos.length} trimestre(s) escrito(s).`);
  }
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  coletar().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  });
}
