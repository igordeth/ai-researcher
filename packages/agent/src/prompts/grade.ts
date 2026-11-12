import type { RetrievedDoc } from '../db/retrieve-similar.js';

/**
 * Prompt do nó `grade`: o contexto recuperado responde a pergunta?
 *
 * O corpus só tem números (indicadores trimestrais da CVM). Por isso a regra central: pergunta
 * qualitativa é sempre insuficiente, mesmo com o documento da empresa certa. É essa regra que
 * manda as perguntas do grupo B do dataset para a busca na web.
 *
 * Texto curto de propósito. Uma versão com regras explícitas para cálculos, comparações e formato
 * do missingAspects acertou o mesmo 20/20 no dataset (grupos A e B, gemini-3.5-flash-lite,
 * temperatura 0) com um prompt 25% maior. Só acrescente uma regra com uma pergunta que a exija.
 */
export function gradePrompt({
  question,
  documents,
}: {
  question: string;
  documents: RetrievedDoc[];
}): string {
  const contexto =
    documents.length > 0
      ? documents.map((doc) => `- [${doc.ticker} ${doc.period}] ${doc.paragraph}`).join('\n')
      : '(nenhum documento encontrado)';

  return `Você avalia se o contexto abaixo é suficiente pra responder a pergunta do usuário.

Contexto recuperado (indicadores financeiros trimestrais, CVM):
${contexto}

Pergunta: ${question}

O contexto é só numérico — indicadores como receita, lucro, ativo total, patrimônio líquido e caixa
operacional, por empresa e trimestre. Perguntas qualitativas (motivo por trás de um número, notícia,
fato relevante, guidance, posicionamento de mercado, previsão de preço futuro) nunca são respondidas só
com este contexto — considere insuficiente nesses casos, mesmo que o contexto tenha dados da empresa certa.
Responda se o contexto é suficiente e, se não for, liste os aspectos que faltam.`;
}
