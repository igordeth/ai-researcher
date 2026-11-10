import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocumentoFinal } from '../types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTOS_DIR = path.join(HERE, '../../data/documentos');

const FORMATADOR = new Intl.NumberFormat('pt-BR');

function formatarNumero(valor: number): string {
  return FORMATADOR.format(Math.round(valor));
}

/**
 * Apoio ao B.6 (conferência manual): imprime os 6 indicadores + fonte de cada trimestre
 * coletado, lado a lado com o rótulo do template do plano — para abrir ao lado do release
 * oficial e comparar. Não decide sozinho se bate: isso é julgamento humano.
 *
 * Uso: tsx src/collect/report.ts [TICKER ...]  (sem argumento, mostra as 20 empresas)
 */
function relatorio(tickers: string[]): void {
  const arquivos = readdirSync(DOCUMENTOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => tickers.length === 0 || tickers.includes(f.replace('.json', '')))
    .sort();

  if (arquivos.length === 0) {
    console.error(
      'Nenhum arquivo em data/documentos/ bate com os tickers informados. Rode `pnpm collect` antes.',
    );
    process.exitCode = 1;
    return;
  }

  for (const arquivo of arquivos) {
    const documentos = JSON.parse(
      readFileSync(path.join(DOCUMENTOS_DIR, arquivo), 'utf-8'),
    ) as DocumentoFinal[];

    for (const doc of documentos) {
      console.log(`\n${doc.ticker} — ${doc.period} (encerrado em ${doc.period_end})`);
      console.log(`  fonte: ${doc.source_url}`);
      console.log(`  receita_liquida     R$ ${formatarNumero(doc.receita_liquida)}`);
      console.log(`  lucro_bruto         R$ ${formatarNumero(doc.lucro_bruto)}`);
      console.log(`  lucro_liquido       R$ ${formatarNumero(doc.lucro_liquido)}`);
      console.log(`  ativo_total         R$ ${formatarNumero(doc.ativo_total)}`);
      console.log(`  patrimonio_liquido  R$ ${formatarNumero(doc.patrimonio_liquido)}`);
      console.log(`  caixa_operacional   R$ ${formatarNumero(doc.caixa_operacional)}`);
    }
  }
}

relatorio(process.argv.slice(2));
