import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QUESTION_MAX_LENGTH } from '@hero/contracts';
import { z } from 'zod';

/**
 * Só o que a tool usa do grafo: invocar com a pergunta e ler a resposta final. O grafo compilado
 * do @hero/agent encaixa aqui sem adaptação, e o teste passa um fake sem Postgres nem Vertex AI.
 */
export interface GrafoPerguntavel {
  invoke(input: { question: string }): Promise<{ finalAnswer: string }>;
}

/**
 * Como a tool obtém o grafo. Uma função, e não o grafo pronto: o grafo real só é construído na
 * primeira chamada da tool, e o servidor sobe sem tocar a base nem a Vertex AI.
 */
export type GetGraph = () => Promise<GrafoPerguntavel>;

/**
 * A descrição é lida pelo modelo do cliente MCP para decidir quando chamar a tool e como usar o
 * resultado. É prompt, não documentação: diz o domínio, o que a tool sabe e não sabe, e repete o
 * guardrail, para o cliente não pedir nem repassar a resposta como recomendação.
 */
export const DESCRICAO_PERGUNTAR = `Responde perguntas sobre 20 empresas brasileiras listadas na B3, com dados oficiais da CVM (formulários trimestrais ITR e anuais DFP) dos 4 trimestres mais recentes.

Empresas: Itaú Unibanco (ITUB), Bradesco (BBDC), Banco do Brasil (BBAS), Axia Energia (ELET), Engie Brasil (EGIE), Cemig (CMIG), Petrobras (PETR), Prio (PRIO), Vale (VALE), Gerdau (GGBR), CSN (CSNA), Magazine Luiza (MGLU), Lojas Renner (LREN), Assaí, razão social Sendas Distribuidora (ASAI), Ambev (ABEV), JBS (JBSS), BRF (BRFS), Suzano (SUZB), Klabin (KLBN) e Totvs (TOTS).

Indicadores disponíveis: receita líquida, lucro bruto, lucro líquido, ativo total, patrimônio líquido e caixa operacional, por trimestre. Perguntas qualitativas (motivo de um resultado, notícia, fato relevante, guidance) são complementadas com busca na web, e a resposta avisa quando o contexto encontrado é incompleto.

A resposta vem em português, com a fonte e o período (data-base) de cada número. Repasse as citações ao usuário.

Esta ferramenta informa, nunca recomenda: não diz se vale a pena comprar, vender ou manter uma ação, mesmo que a pergunta peça. Consultoria de valores mobiliários é atividade regulada pela CVM. Não use o resultado para fazer recomendação de investimento.`;

// O que o cliente recebe quando o grafo falha. Fixo: o erro real (base fora do ar, Vertex AI,
// configuração em falta) só vai para o log, e nunca para o modelo do cliente.
export const MENSAGEM_ERRO_PERGUNTAR =
  'Não foi possível responder a esta pergunta agora. Tente novamente em instantes.';

export interface OpcoesServidor {
  getGraph: GetGraph;
  // Para onde vai o erro real. No stdio, o stdout é o canal do protocolo: o padrão é o stderr.
  registrarErro?: (erro: unknown) => void;
}

function registrarNoStderr(erro: unknown): void {
  console.error('Falha na tool perguntar:', erro);
}

/** Cria o servidor MCP com a tool `perguntar`. Não conecta nenhum transporte: quem chama escolhe. */
export function criarServidorMcp({
  getGraph,
  registrarErro = registrarNoStderr,
}: OpcoesServidor): McpServer {
  const servidor = new McpServer({ name: 'ai-researcher', version: '0.0.0' });

  servidor.registerTool(
    'perguntar',
    {
      title: 'Perguntar sobre empresas da B3',
      description: DESCRICAO_PERGUNTAR,
      inputSchema: {
        // O mesmo limite de tamanho do /api/chat, vindo dos contratos.
        pergunta: z
          .string()
          .trim()
          .min(1)
          .max(QUESTION_MAX_LENGTH)
          .describe('A pergunta, em português, sobre uma ou mais das 20 empresas.'),
      },
      // Busca na web: o resultado pode depender de fontes externas ao corpus.
      annotations: { openWorldHint: true },
    },
    async ({ pergunta }) => {
      try {
        const grafo = await getGraph();
        // finalAnswer já vem citada e filtrada pelo guardrail do nó answer.
        const { finalAnswer } = await grafo.invoke({ question: pergunta });
        return { content: [{ type: 'text', text: finalAnswer }] };
      } catch (erro) {
        // Degradação graciosa: a falha vira um resultado de erro da tool, que o cliente sabe
        // tratar, e nunca uma exceção crua com detalhe interno.
        registrarErro(erro);
        return { isError: true, content: [{ type: 'text', text: MENSAGEM_ERRO_PERGUNTAR }] };
      }
    },
  );

  return servidor;
}
