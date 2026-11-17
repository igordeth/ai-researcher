import type { DocumentoCvm } from '../db/retrieve-similar.js';

/**
 * O documento que a busca do modo DEMO devolve sempre: Vale S.A. no 3T25, copiado do corpus
 * (packages/corpus/data/documentos/VALE.json) com os números reais da CVM.
 *
 * Congelado aqui, e não lido do JSON: o `pnpm collect` troca os trimestres do snapshot pelos mais
 * recentes, e o 3T25 sai dele mais cedo ou mais tarde. A demo continua a mostrar o mesmo documento,
 * com a mesma resposta, enquanto a gravação estiver no ar.
 */
export const DOCUMENTO_VALE_3T25: DocumentoCvm = {
  origem: 'cvm',
  // Na base o id é um UUID gerado pelo Postgres; este documento nunca passa por lá.
  id: 'demo-vale-3t25',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  setor: 'Extração Mineral',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph:
    'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões, alta de 7,0% frente ao ' +
    '3T24. O lucro bruto foi de R$ 20,6 bilhões. O lucro líquido foi de R$ 14,7 bilhões, com ' +
    'margem líquida de 25,9%. O caixa gerado nas operações somou R$ 13,7 bilhões. Ao fim do ' +
    'trimestre, o ativo total era de R$ 485,0 bilhões e o patrimônio líquido, de R$ 224,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  fetchedAt: new Date('2026-11-10T17:24:14.003Z'),
  // Sem embedding de verdade não há distância a medir: 0 é "o mais parecido possível".
  distance: 0,
};
