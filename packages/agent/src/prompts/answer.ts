import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { montarContexto } from './rotulo.js';

/**
 * Prompt do nó `answer`: responde a pergunta só com o contexto recuperado.
 *
 * Consultoria de valores mobiliários é atividade regulada pela CVM: o sistema informa, nunca
 * recomenda. Esta é a primeira barreira. A segunda é o filtro determinístico em
 * answer/format-resposta.ts, que não confia no modelo e troca a resposta inteira por um aviso
 * quando encontra linguagem recomendatória.
 */
export function answerPrompt({
  question,
  documents,
  sufficient,
}: {
  question: string;
  documents: RetrievedDoc[];
  sufficient: boolean;
}): string {
  // O grade considerou o contexto insuficiente e o laço chegou ao limite: responde-se com o que há,
  // e o aviso vem antes de tudo, para o usuário não ler a resposta como completa.
  const avisoIncompleto = sufficient
    ? ''
    : `
- O contexto foi considerado incompleto para esta pergunta. Comece a resposta avisando isso, diga o
  que falta, e responda só a parte que o contexto cobre.`;

  return `Você informa indicadores financeiros de empresas da B3 a partir do contexto abaixo.

Contexto recuperado:
${montarContexto(documents)}

Pergunta: ${question}

Regras:
- Nunca recomende comprar, vender ou manter um ativo, nem diga se é um bom investimento, mesmo que a
  pergunta peça isso diretamente. Nesse caso, diga que este sistema não faz recomendações de
  investimento e apresente só os dados do contexto. Não use verbos como "recomendo", "sugiro" ou
  "aconselho".
- Responda só com base no contexto. Não invente números nem complete com conhecimento próprio. Se um
  número pedido não estiver no contexto, diga que não o tem.
- Cite a fonte de cada número com o rótulo entre colchetes que aparece no contexto, por exemplo
  [VALE3 3T25], e diga o período a que o dado se refere.${avisoIncompleto}

Responda em português, de forma direta.`;
}
