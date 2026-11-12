import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { rotuloDocumento } from '../prompts/rotulo.js';

/**
 * O texto que substitui uma resposta com linguagem recomendatória. Fixo, e escrito de modo a não
 * cair ele próprio no filtro.
 */
export const AVISO_GUARDRAIL =
  'Este sistema não faz recomendações de investimento: informa os indicadores financeiros das ' +
  'empresas, com fonte e data-base, mas não indica compra, venda ou manutenção de posição. Para ' +
  'uma decisão de investimento, procure um profissional habilitado.';

// Uma letra não pode vir colada antes nem depois do termo: "recomendo" casa, "recomendou" não.
// Sem a flag `u` e \p{L}, o \b do JavaScript trata letras acentuadas como separadores.
function termo(padrao: string): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${padrao})(?!\\p{L})`, 'iu');
}

/**
 * O que conta como recomendação. Lista conservadora: um falso positivo troca uma resposta boa pelo
 * aviso, e um falso negativo deixa passar uma recomendação, que é o erro regulatório.
 * "deve investir" fica de fora de propósito: as notícias dizem muito "a empresa deve investir".
 */
const PADROES_RECOMENDACAO: RegExp[] = [
  // Verbo de recomendação na primeira pessoa: quem fala é o sistema.
  termo(
    'recomendo|recomendamos|recomendaria|sugiro|sugerimos|sugeriria|aconselho|aconselhamos|aconselharia',
  ),
  termo('vale a pena (?:comprar|vender|investir)'),
  termo('(?:deve|deveria|devem|deveriam) (?:comprar|vender)'),
  termo('(?:boa|ótima) (?:hora|oportunidade) (?:de|para) (?:comprar|vender|investir)'),
];

export function contemLinguagemRecomendatoria(texto: string): boolean {
  // Espaços e quebras de linha normalizados, para "vale a\npena comprar" não escapar.
  const normalizado = texto.replace(/\s+/g, ' ');
  return PADROES_RECOMENDACAO.some((padrao) => padrao.test(normalizado));
}

// '2025-09-30' → '30/09/2025'. Pela string, e não por Date, para o fuso não mudar o dia.
function formatarDataBase(periodEnd: string): string {
  const [ano, mes, dia] = periodEnd.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * O bloco de fontes: um item por fonte, pela ordem de relevância. Na web, os chunks da mesma
 * página têm o mesmo sourceUrl e viram um item. Na CVM, o sourceUrl é o ZIP do ano, comum a todas
 * as empresas, por isso a fonte é a empresa e o trimestre (ticker + período).
 */
export function montarFontes(documents: RetrievedDoc[]): string {
  const vistas = new Set<string>();
  const itens: string[] = [];

  for (const doc of documents) {
    const chave = doc.origem === 'cvm' ? `cvm:${doc.ticker}:${doc.period}` : `web:${doc.sourceUrl}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    itens.push(
      doc.origem === 'cvm'
        ? `- ${rotuloDocumento(doc)} ${doc.companyName}, data-base ${formatarDataBase(doc.periodEnd)} (CVM)`
        : `- ${rotuloDocumento(doc)} ${doc.sourceUrl}`,
    );
  }

  if (itens.length === 0) return 'Fontes: nenhum documento recuperado.';
  return ['Fontes:', ...itens].join('\n');
}

/**
 * A resposta final: o texto do modelo, ou o aviso de guardrail se o texto recomendar algo, sempre
 * seguido das fontes. A troca é da resposta inteira, e não só da frase: uma recomendação no meio
 * de dados corretos continua a ser uma recomendação.
 */
export function formatarResposta(texto: string, documents: RetrievedDoc[]): string {
  const corpo = contemLinguagemRecomendatoria(texto) ? AVISO_GUARDRAIL : texto.trim();
  return `${corpo}\n\n${montarFontes(documents)}`;
}
