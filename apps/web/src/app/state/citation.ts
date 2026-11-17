/** Origem de toda citação do corpus: os documentos CVM indexados na base vetorial. */
export const ORIGEM_CVM = 'Base local (CVM)';

/** Uma linha do bloco Fontes, já separada nas partes que a interface mostra. */
export interface Citation {
  // O que vem entre colchetes, tal como aparece no corpo: "VALE3 3T25" ou "web: Título".
  readonly label: string;
  // A CVM não tem link próprio: o arquivo de origem é o ZIP do ano, comum a todas as empresas.
  readonly url: string | null;
  // 'Base local (CVM)', ou o hostname da página na web.
  readonly origin: string;
  // Só na CVM: o trimestre ("3T25") e a data-base ("30/09/2025") do dado.
  readonly period: string | null;
  readonly dataBase: string | null;
}

export interface ParsedAnswer {
  // O texto da resposta, sem o bloco Fontes.
  readonly body: string;
  readonly citations: Citation[];
}

// O bloco é sempre o último da resposta, separado do corpo por uma linha em branco: é o
// formatarResposta, no @hero/agent, que o acrescenta depois do texto do LLM.
const INICIO_FONTES = '\n\nFontes:';

// Os dois formatos de linha do montarFontes, no @hero/agent:
//   - [VALE3 3T25] Vale S.A., data-base 30/09/2025 (CVM)
//   - [web: Vale tem queda no minério] https://noticias.com/vale
const LINHA_CVM = /^- \[(\S+) (\S+)\] .+, data-base (\d{2}\/\d{2}\/\d{4}) \(CVM\)$/;
// O rótulo é guloso (.+) porque um título da web pode ter colchetes: vale o último "] " da linha,
// e o que vem depois dele, sem espaços, é o URL.
const LINHA_WEB = /^- \[(.+)\] (\S+)$/;

/**
 * Separa o corpo da resposta do bloco Fontes no final, e extrai uma Citation por linha do bloco.
 * Sem bloco, o texto todo é o corpo. Uma linha fora dos dois formatos (incluindo "Fontes: nenhum
 * documento recuperado.") não vira citação.
 */
export function parseAnswer(answerText: string): ParsedAnswer {
  const inicio = answerText.lastIndexOf(INICIO_FONTES);
  if (inicio === -1) return { body: answerText.trim(), citations: [] };

  const body = answerText.slice(0, inicio).trim();
  // A primeira linha é o próprio "Fontes:": as citações vêm nas seguintes.
  const linhas = answerText
    .slice(inicio + INICIO_FONTES.length)
    .split('\n')
    .slice(1);

  const citations: Citation[] = [];
  for (const linha of linhas) {
    const citation = lerLinha(linha.trim());
    if (citation) citations.push(citation);
  }
  return { body, citations };
}

function lerLinha(linha: string): Citation | null {
  const cvm = LINHA_CVM.exec(linha);
  if (cvm) {
    const [, ticker, period, dataBase] = cvm;
    return { label: `${ticker} ${period}`, url: null, origin: ORIGEM_CVM, period, dataBase };
  }

  const web = LINHA_WEB.exec(linha);
  if (web) {
    const [, label, url] = web;
    const hostname = hostnameDe(url);
    if (hostname === null) return null;
    return { label, url, origin: hostname, period: null, dataBase: null };
  }

  return null;
}

/**
 * O hostname de um URL http(s), ou null. Outro esquema (javascript:, data:) é recusado: o URL
 * vira um link clicável na interface, e o texto da página veio da web.
 */
function hostnameDe(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}
